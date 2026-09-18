import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clone, initialState, processIntelligence, decide, compareMetrics, eventDisplay } from './rules.mjs';

const fixture = JSON.parse(readFileSync(new URL('./data.json', import.meta.url), 'utf8'));
const setup = () => initialState(fixture);

test('完整链路：来源与证据进入、双 Metric 冲突、直接依赖复核、草案隔离、人工确认版本', () => {
  const before = setup();
  assert.equal(before.judgments[0].judgment_status, 'active');
  const { state, outcome } = processIntelligence(before, fixture);
  assert.equal(outcome, 'review_required');
  assert.equal(before.metrics.length, 3, '原快照不能被修改');
  assert.ok(state.sources.some((x) => x.source_id === 'SRC-004'));
  assert.ok(state.evidence.some((x) => x.evidence_id === 'EVD-005' && x.target_id === 'MET-006'));
  assert.deepEqual(state.metrics.filter((x) => ['MET-005', 'MET-006'].includes(x.metric_id)).map((x) => [x.value, x.knowledge_status]), [[8, 'conflicting'], [9, 'conflicting']]);
  assert.equal(state.judgments.find((x) => x.judgment_id === 'JDG-001').judgment_status, 'review_required');
  assert.equal(state.judgments.find((x) => x.judgment_id === 'JDG-006').judgment_status, 'draft');
  const done = decide(state, 'accept');
  assert.equal(done.judgments.find((x) => x.judgment_id === 'JDG-001').judgment_status, 'superseded');
  assert.equal(done.judgments.find((x) => x.judgment_id === 'JDG-006').judgment_status, 'active');
});

test('统计范围未确认时阻断自动冲突与复核', () => {
  const data = clone(fixture);
  data.inbox.scope_equivalence_confirmed = false;
  const { state, outcome } = processIntelligence(setup(), data);
  assert.equal(outcome, 'comparison_blocked');
  assert.equal(state.metrics.find((x) => x.metric_id === 'MET-005').knowledge_status, 'pending_confirmation');
  assert.equal(state.judgments[0].judgment_status, 'active');
});

test('不同口径不判冲突，同值不触发复核', () => {
  const a = fixture.metrics.find((x) => x.metric_id === 'MET-005');
  const b = fixture.inbox.metric;
  assert.equal(compareMetrics(a, { ...b, metric_name: 'disclosed_capex' }, true).outcome, 'not_conflicting');
  assert.equal(compareMetrics(a, { ...b, value: 8 }, true).outcome, 'same_value');
  const data = clone(fixture);
  data.inbox.metric.value = 8;
  const { state } = processIntelligence(setup(), data);
  assert.equal(state.judgments[0].judgment_status, 'active');
});

test('只有直接依赖的 active 判断进入复核', () => {
  const data = clone(fixture);
  const unrelated = { ...clone(data.judgments[0]), judgment_id: 'JDG-008', dependency_refs: [{ target_type: 'project_event', target_id: 'EVT-002' }] };
  data.judgments.push(unrelated);
  const { state } = processIntelligence(initialState(data), data);
  assert.equal(state.judgments.find((x) => x.judgment_id === 'JDG-008').judgment_status, 'active');
});

test('C 级开工线索不确认事件；无事件保持 unknown', () => {
  assert.equal(eventDisplay(fixture.events.find((x) => x.event_id === 'EVT-002'), fixture.evidence).status, 'pending');
  assert.equal(eventDisplay(undefined, fixture.evidence).status, 'unknown');
});

test('人工修改与维持原判断各自更新真实 Judgment 记录', () => {
  const reviewed = processIntelligence(setup(), fixture).state;
  const edited = decide(reviewed, 'edit', '研究员核对后确认两项金额仍需进一步澄清。');
  assert.equal(edited.judgments.find((x) => x.judgment_id === 'JDG-007').judgment_status, 'active');
  assert.equal(edited.judgments.find((x) => x.judgment_id === 'JDG-006').judgment_status, 'superseded');
  const maintained = decide(reviewed, 'maintain');
  assert.equal(maintained.judgments.find((x) => x.judgment_id === 'JDG-001').judgment_status, 'active');
  assert.equal(maintained.judgments.find((x) => x.judgment_id === 'JDG-006').judgment_status, 'superseded');
  assert.throws(() => decide(reviewed, 'edit', reviewed.judgments.find((x) => x.judgment_id === 'JDG-006').judgment_text));
});
