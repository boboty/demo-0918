// Small, deterministic implementation of the P02 rules used by this classroom scenario.
// Business records retain P01 field names; the inbox and scope note are scenario inputs.
export const clone = (value) => structuredClone(value);
const byId = (rows, key, id) => rows.find((row) => row[key] === id);
const assert = (condition, message) => { if (!condition) throw new Error(message); };

export function validateScenario(data) {
  const { project, sources, evidence, metrics, events, judgments, inbox } = data;
  assert(project.is_mock && project.project_id, 'Mock 项目缺失');
  for (const item of [...sources, inbox.source]) assert(item.source_id && item.data_origin === 'mock', '来源记录不完整');
  for (const item of [...evidence, inbox.evidence]) {
    assert(byId([...sources, inbox.source], 'source_id', item.source_id), `证据 ${item.evidence_id} 没有来源`);
    const target = item.target_type === 'metric' ? [...metrics, inbox.metric] : item.target_type === 'project_event' ? events : [];
    assert(byId(target, item.target_type === 'metric' ? 'metric_id' : 'event_id', item.target_id), `证据 ${item.evidence_id} 没有目标`);
  }
  for (const metric of [...metrics, inbox.metric]) {
    assert(metric.subject_id === project.project_id, `指标 ${metric.metric_id} 不属于本项目`);
    metric.evidence_ids.forEach((id) => assert(byId([...evidence, inbox.evidence], 'evidence_id', id), `指标 ${metric.metric_id} 缺证据`));
  }
  for (const event of events) event.evidence_ids.forEach((id) => assert(byId(evidence, 'evidence_id', id), `事件 ${event.event_id} 缺证据`));
  for (const judgment of judgments) judgment.dependency_refs.forEach((ref) => assert(byId(ref.target_type === 'metric' ? metrics : events, ref.target_type === 'metric' ? 'metric_id' : 'event_id', ref.target_id), `判断 ${judgment.judgment_id} 缺依赖`));
  assert(inbox.evidence.target_type === 'metric' && inbox.evidence.target_id === inbox.metric.metric_id, '新证据与指标未对齐');
  return true;
}

export function compareMetrics(a, b, scopeConfirmed) {
  // SC-001..004: no automatic equality inference from free-text scope_definition.
  for (const field of ['subject_type', 'subject_id', 'metric_name', 'period', 'lifecycle_stage', 'unit']) {
    if (a[field] !== b[field]) return { outcome: 'not_conflicting', reason: `${field} 不同` };
  }
  if (!scopeConfirmed || a.scope_definition !== b.scope_definition) return { outcome: 'comparison_blocked', reason: '统计范围未被明确核对为一致' };
  if (a.value === b.value) return { outcome: 'same_value', reason: '同口径且数值相同' };
  return { outcome: 'conflicting', reason: '同口径计划投资出现不同数值' };
}

export function metricDisplay(metric, evidence) {
  if (!metric) return { status: 'unknown', detail: '暂无可确认证据' };
  const items = metric.evidence_ids.map((id) => byId(evidence, 'evidence_id', id)).filter(Boolean);
  const strong = items.some((item) => ['A', 'B'].includes(item.evidence_grade) && item.relation === 'supports' && item.human_review_status === 'confirmed');
  if (metric.knowledge_status === 'known' && metric.human_review_status === 'confirmed' && strong) return { status: 'confirmed', detail: `${metric.value} ${metric.unit} · ${metric.evidence_ids.join('/')}` };
  return { status: items.length ? 'pending' : 'unknown', detail: items.length ? `待人工确认 · ${metric.evidence_ids.join('/')}` : '暂无可确认证据' };
}

export function eventDisplay(event, evidence) {
  if (!event) return { status: 'unknown', detail: '暂无可确认证据' };
  const items = event.evidence_ids.map((id) => byId(evidence, 'evidence_id', id)).filter(Boolean);
  const strong = items.some((item) => ['A', 'B'].includes(item.evidence_grade) && item.relation === 'supports' && item.human_review_status === 'confirmed');
  if (event.knowledge_status === 'known' && event.human_review_status === 'confirmed' && strong) return { status: 'confirmed', detail: `${event.event_date || '日期未列'} · ${event.evidence_ids.join('/')}` };
  if (items.some((item) => item.evidence_grade === 'C')) return { status: 'pending', detail: `仅有 C 级线索 · ${event.evidence_ids.join('/')}` };
  return { status: 'pending', detail: `待人工确认 · ${event.evidence_ids.join('/')}` };
}

export function processIntelligence(current, input) {
  const state = clone(current);
  if (state.processed) return { state, outcome: 'already_processed' };
  validateScenario(input);
  const { source, evidence, metric, scope_equivalence_confirmed } = input.inbox;
  assert(evidence.evidence_grade === 'A' && evidence.human_review_status === 'confirmed' && source.source_type === 'internal_ledger', '新台账摘录未完成核对');
  const oldMetric = state.metrics.find((row) => row.metric_name === metric.metric_name && row.subject_id === metric.subject_id && row.metric_id !== metric.metric_id);
  assert(oldMetric, '没有可比较的历史指标');
  const before = clone(oldMetric);
  const comparison = compareMetrics(oldMetric, metric, scope_equivalence_confirmed);
  state.sources.push(clone(source));
  state.evidence.push(clone(evidence));
  state.metrics.push(clone(metric));
  const newMetric = byId(state.metrics, 'metric_id', metric.metric_id);
  if (comparison.outcome === 'conflicting') {
    // SC-004/005: preserve both claims and evidence; a higher grade never chooses the winner.
    for (const item of [oldMetric, newMetric]) {
      item.knowledge_status = 'conflicting';
      item.human_review_status = 'review_required';
    }
  }
  const changed = ['value', 'period', 'lifecycle_stage', 'scope_definition', 'knowledge_status'].some((field) => before[field] !== oldMetric[field]);
  const affected = [];
  if (changed) {
    for (const judgment of state.judgments) {
      if (judgment.judgment_status === 'active' && judgment.dependency_refs.some((ref) => ref.target_type === 'metric' && ref.target_id === oldMetric.metric_id)) {
        judgment.judgment_status = 'review_required';
        judgment.human_review_status = 'review_required';
        affected.push(judgment.judgment_id);
      }
    }
  }
  if (affected.length) state.judgments.push(clone(input.draft_template)); // JI-005: draft stays separate.
  state.processed = true;
  state.review = { comparison, affected, before, after: clone(oldMetric) };
  return { state, outcome: affected.length ? 'review_required' : comparison.outcome };
}

export function decide(current, action, editedText, date = '2025-04-05') {
  const state = clone(current);
  assert(state.processed && state.review?.affected.length, '没有待复核判断');
  assert(['accept', 'edit', 'maintain'].includes(action), '未知人工操作');
  const original = byId(state.judgments, 'judgment_id', state.review.affected[0]);
  const draft = byId(state.judgments, 'judgment_id', 'JDG-006');
  assert(original?.judgment_status === 'review_required' && draft?.judgment_status === 'draft', '复核版本状态不正确');
  if (action === 'maintain') {
    original.judgment_status = 'active';
    original.human_review_status = 'confirmed';
    original.last_reviewed_at = date;
    draft.judgment_status = 'superseded';
  } else {
    let next = draft;
    if (action === 'edit') {
      assert(editedText?.trim() && editedText.trim() !== draft.judgment_text, '请先修改草案');
      draft.judgment_status = 'superseded';
      next = { ...clone(draft), judgment_id: 'JDG-007', judgment_text: editedText.trim(), judgment_status: 'draft' };
      state.judgments.push(next);
    }
    original.judgment_status = 'superseded';
    next.judgment_status = 'active';
    next.human_review_status = 'confirmed';
    next.last_reviewed_at = date;
    next.evidence_version = 'mock-pack-v2';
  }
  state.decision = { action, date };
  return state;
}

export function initialState(data) {
  validateScenario(data);
  return { sources: clone(data.sources), evidence: clone(data.evidence), metrics: clone(data.metrics), events: clone(data.events), judgments: clone(data.judgments), processed: false, review: null, decision: null };
}
