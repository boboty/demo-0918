import { clone, comparePublicInvestment, decide } from './rules.mjs';

const find = (rows, key, id) => rows.find((row) => row[key] === id);

export function initialMonitor(task, publicData) {
  if (!task.schedule.enabled || !task.schedule.cron || !task.schedule.display_time) throw new Error('监测计划未配置');
  const previousIds = task.snapshots.previous.source_ids;
  return {
    sources: clone(publicData.sources.filter((row) => previousIds.includes(row.source_id))),
    evidence: clone(publicData.evidence.filter((row) => previousIds.includes(row.source_id))),
    metrics: clone(publicData.metrics.filter((row) => row.evidence_ids.some((id) => publicData.evidence.some((e) => e.evidence_id === id && previousIds.includes(e.source_id))))),
    events: clone(publicData.events.filter((row) => row.evidence_ids.some((id) => publicData.evidence.some((e) => e.evidence_id === id && previousIds.includes(e.source_id))))),
    judgments: clone(task.judgments), processed: false, review: null, decision: null, changes: null
  };
}

export function runMonitor(current, task, publicData) {
  const state = clone(current);
  if (state.processed) return { state, changes: state.changes };
  const previous = task.snapshots.previous.source_ids;
  const incoming = task.snapshots.current.source_ids.filter((id) => !previous.includes(id));
  if (!incoming.length) return { state, changes: { newSources: [], additions: [], unchanged: previous.length } };
  const newSources = publicData.sources.filter((row) => incoming.includes(row.source_id));
  if (newSources.length !== incoming.length) throw new Error('新来源快照不完整');
  const newEvidence = publicData.evidence.filter((row) => incoming.includes(row.source_id));
  const newMetrics = publicData.metrics.filter((row) => row.evidence_ids.some((id) => newEvidence.some((e) => e.evidence_id === id)));
  const newEvents = publicData.events.filter((row) => row.evidence_ids.some((id) => newEvidence.some((e) => e.evidence_id === id)));
  const oldInvestment = state.metrics.find((row) => row.metric_name === 'planned_investment');
  const newInvestment = newMetrics.find((row) => row.metric_name === 'planned_investment');
  if (!oldInvestment || !newInvestment) throw new Error('投资资料不完整');
  const comparison = comparePublicInvestment(oldInvestment, newInvestment, publicData.scope_equivalence_confirmed);
  const additions = [
    { type: 'investment', label: '新增投资表述', value: `${newInvestment.value} ${newInvestment.unit}`, evidence_id: newInvestment.evidence_ids[0] },
    ...newEvents.filter((row) => row.event_type === 'approved_or_filed').map((row) => ({ type: 'filing', label: '新增备案信息', value: row.event_date, evidence_id: row.evidence_ids[0] }))
  ];
  const title = newSources[0].title;
  const phase = title.match(/总规模|([0-9]+MW\/[0-9]+MWh).*?一期([0-9]+MW\/[0-9]+MWh)/);
  if (phase?.[1]) additions.push({ type: 'phase', label: '新增项目分期信息', value: `总规模 ${phase[1]} · 一期 ${phase[2]}`, source_id: newSources[0].source_id });
  state.sources.push(...clone(newSources)); state.evidence.push(...clone(newEvidence));
  state.metrics.push(...clone(newMetrics)); state.events.push(...clone(newEvents));
  const affected = [];
  if (comparison.outcome === 'comparison_blocked' || comparison.outcome === 'conflicting') {
    for (const judgment of state.judgments) {
      if (judgment.judgment_status === 'active' && judgment.dependency_refs.some((ref) => ref.target_type === 'metric' && ref.target_id === oldInvestment.metric_id)) {
        judgment.judgment_status = 'review_required';
        judgment.human_review_status = 'review_required';
        affected.push(judgment.judgment_id);
      }
    }
  }
  if (affected.length) state.judgments.push(clone(task.draft_template));
  state.review = { comparison, affected, before: clone(oldInvestment), after: clone(newInvestment) };
  state.processed = true;
  state.changes = { newSources: incoming, additions, unchanged: task.sources.length - incoming.length, acquisition: '已复核资料快照' };
  return { state, changes: state.changes };
}

export { decide };
