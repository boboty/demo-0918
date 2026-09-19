import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialMonitor, runMonitor, decide } from './monitor.mjs';

const task = JSON.parse(readFileSync(new URL('./monitor-task.json', import.meta.url), 'utf8'));
const real = JSON.parse(readFileSync(new URL('./real-project.json', import.meta.url), 'utf8'));
const run = () => runMonitor(initialMonitor(task, real), task, real);

test('研究专题有实际定时配置，执行后识别一条新资料', () => {
  assert.equal(task.schedule.cron, '0 8 * * *');
  const { state, changes } = run();
  assert.deepEqual(changes.newSources, ['SRC-010']);
  assert.equal(changes.unchanged, 2);
  assert.equal(changes.acquisition, '已复核资料快照');
  assert.equal(state.sources.length, 2);
});

test('change set 包含新投资、备案与分期信息', () => {
  const { changes } = run();
  assert.deepEqual(changes.additions.map((x) => x.type), ['investment', 'filing', 'phase']);
  assert.equal(changes.additions[0].value, '6143.0100 万美元');
  assert.equal(changes.additions[1].value, '2022-03-24');
  assert.match(changes.additions[2].value, /100MW\/200MWh · 一期 50MW\/100MWh/);
});

test('新公开资料触发直接依赖的模拟历史 Judgment 复核', () => {
  const before = initialMonitor(task, real);
  const { state } = runMonitor(before, task, real);
  assert.equal(before.judgments[0].judgment_status, 'active');
  assert.deepEqual(state.review.affected, ['JDG-001']);
  assert.equal(state.judgments[0].judgment_status, 'review_required');
  assert.equal(state.judgments[0].is_mock, true);
});

test('comparison_blocked 不自动产生统一投资额，也不覆盖两项原记录', () => {
  const { state } = run();
  assert.equal(state.review.comparison.outcome, 'comparison_blocked');
  assert.equal(state.review.comparison.conclusion, '暂无公开可确认的统一投资额');
  assert.deepEqual(state.metrics.filter((x) => x.metric_name === 'planned_investment').map((x) => [x.value, x.unit]), [['3.2', '亿元'], ['6143.0100', '万美元']]);
});

test('人工确认前 draft 不 active；三个动作才分别落实 active 版本', () => {
  const { state } = run();
  assert.equal(state.judgments.find((x) => x.judgment_id === 'JDG-006').judgment_status, 'draft');
  assert.equal(state.judgments.filter((x) => x.judgment_status === 'active').length, 0);
  for (const [action, text, id] of [['accept', undefined, 'JDG-006'], ['edit', '人工修改：暂无法统一投资额。', 'JDG-007'], ['maintain', undefined, 'JDG-001']]) {
    const done = decide(state, action, text);
    assert.equal(done.judgments.find((x) => x.judgment_status === 'active').judgment_id, id);
  }
});
