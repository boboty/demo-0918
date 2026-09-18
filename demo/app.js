import { initialState, processIntelligence, decide, eventDisplay, metricDisplay } from './rules.mjs';

let data;
let state;
const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const labels = { known: 'known · 已确认', pending_confirmation: 'pending · 待确认', conflicting: 'conflicting · 冲突', unknown: 'unknown · 未知' };
const badge = (status) => `<span class="status ${status === 'pending_confirmation' ? 'pending' : status}">${labels[status] || esc(status)}</span>`;
const sourceFor = (id) => state.sources.find((row) => row.source_id === id);
const evidenceFor = (id) => state.evidence.find((row) => row.evidence_id === id);
const evidenceLine = (ids) => ids.map((id) => { const item = evidenceFor(id); const source = item && sourceFor(item.source_id); return `${id} · ${source?.title || '来源缺失'} · ${item?.evidence_grade || '?'} 级`; }).join('；');
const metric = (name) => state.metrics.filter((row) => row.metric_name === name && row.subject_id === data.project.project_id);
const judgment = (id) => state.judgments.find((row) => row.judgment_id === id);

function renderInbox() {
  const { source, evidence, metric: incoming } = data.inbox;
  $('inbox-status').className = `pill ${state.processed ? 'neutral' : 'blue'}`;
  $('inbox-status').textContent = state.processed ? '已处理' : '1 条新情报';
  $('inbox-body').innerHTML = `<div class="inbox-item"><div class="inbox-meta"><span class="new-dot"></span>${state.processed ? '已进入事实台账' : '未处理'}<span class="divider">·</span>${esc(source.publish_date)}</div><h3>${esc(source.title)}</h3><p class="quote">“${esc(evidence.evidence_text)}”</p><div class="source-line"><span>${esc(evidence.evidence_id)} → ${esc(incoming.metric_id)}</span><span>${esc(source.source_type)}</span><span>${esc(evidence.evidence_grade)} 级 · Mock</span></div><button id="process" class="primary-button" type="button" ${state.processed ? 'disabled' : ''}>${state.processed ? '情报已处理 ✓' : '处理这条情报 →'}</button></div>`;
  $('process').addEventListener('click', () => {
    if (state.processed) return;
    const result = processIntelligence(state, data);
    state = result.state;
    render();
    $('review').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function renderLedger() {
  const p = data.project;
  const stages = [
    ['规划', 'planned', null],
    ['核准 / 备案', 'approved_or_filed', 'EVT-001'],
    ['开工', 'construction_started', 'EVT-002'],
    ['首批并网', 'first_grid_connection', null],
    ['全容量投运', 'full_operation', null]
  ];
  const timeline = stages.map(([label, type, eventId], index) => {
    const event = eventId ? state.events.find((row) => row.event_id === eventId) : state.events.find((row) => row.event_type === type);
    const display = type === 'planned' ? metricDisplay(metric('power_capacity')[0], state.evidence) : eventDisplay(event, state.evidence);
    const short = { confirmed: '已确认', pending: '待确认', unknown: '未知' }[display.status];
    return `<div class="milestone ${display.status}"><div class="milestone-line"><span>${index + 1}</span></div><strong>${label}</strong><span class="stage-status ${display.status}">${short}</span><small>${esc(display.detail)}</small></div>`;
  }).join('');
  const facts = [
    ['功率规模', metric('power_capacity')],
    ['储能容量', metric('energy_capacity')],
    ['计划投资 <span>非实际资本开支</span>', metric('planned_investment')]
  ];
  const factHtml = facts.map(([title, rows]) => `<div class="fact ${rows.length > 1 ? 'investment' : ''}"><div class="fact-label">${title}</div><strong>${rows.map((row) => `${esc(row.value)} ${esc(row.unit)}`).join(' / ')}</strong>${badge(rows[0].knowledge_status)}<small>${rows.map((row) => evidenceLine(row.evidence_ids)).join('；')}</small>${rows.length > 1 ? '<p class="fact-note">两条 Metric 原值及证据并列保留，未自动选定金额。</p>' : ''}</div>`).join('');
  $('ledger-body').innerHTML = `<div class="project-title"><h3>${esc(p.canonical_name)}</h3><span>${esc(p.project_type === 'independent_storage' ? '独立储能' : p.project_type)} · ${esc(p.region)}</span></div><div class="mini-heading">生命周期轴 <small>由 Event 与 Evidence 推导展示</small></div><div class="timeline">${timeline}</div><div class="fact-grid">${factHtml}</div><div class="evidence-note"><strong>证据链</strong><span>来源编号对应 Source / Evidence 记录。开工仅有 C 级线索；并网与投运暂无可确认证据。</span></div>`;
}

function renderReview() {
  const original = judgment('JDG-001');
  const draft = judgment('JDG-006');
  const final = state.decision;
  $('judgment-status').className = `pill ${original.judgment_status === 'review_required' ? 'amber' : 'green'}`;
  $('judgment-status').textContent = original.judgment_status === 'review_required' ? '需要复核' : final ? '复核已完成' : '有效判断';
  const originalState = `v${original.version} · ${original.judgment_status}`;
  const reviewInfo = state.review ? `<div class="trigger"><strong>复核触发原因 · ${esc(state.review.comparison.outcome)}</strong><p>${esc(state.review.comparison.reason)}；${esc(state.review.before.metric_id)} 的知识状态由 ${esc(state.review.before.knowledge_status)} 变为 ${esc(state.review.after.knowledge_status)}。</p><small>${esc(data.inbox.scope_review_note)} · 直接依赖 ${esc(state.review.affected.join(', '))}</small></div>` : '<div class="quiet-note">处理新情报后，此处会显示受影响的历史判断、触发原因与独立的 AI 草案。</div>';
  const draftHtml = draft ? `<div class="draft-block"><div class="block-top"><strong>AI 草案 <em>预置演示文本</em></strong><span>${esc(draft.judgment_status)}</span></div><p>${esc(draft.judgment_text)}</p><small>${esc(draft.judgment_id)} · v${draft.version}</small></div>` : '';
  const active = final ? state.judgments.find((row) => row.judgment_status === 'active') : null;
  const finalHtml = active ? `<div class="final-callout"><strong>${final.action === 'maintain' ? '原判断已维持' : '新判断已确认'}</strong><p>${esc(active.judgment_text)}</p><small>${esc(active.judgment_id)} · v${active.version} · active</small></div>` : '';
  $('review-body').innerHTML = `<div class="judgment-block"><div class="block-top"><strong>历史判断原文</strong><span>${originalState}</span></div><p>${esc(original.judgment_text)}</p><small>${esc(original.judgment_id)} · 原文始终保留</small></div>${reviewInfo}${draftHtml}${finalHtml}`;
}

function renderDecision() {
  if (!state.processed) { $('decision-body').innerHTML = '<div class="empty-decision"><span>↳</span><p>先处理收件箱中的新情报，随后由研究员作出确认。</p></div>'; return; }
  if (state.decision) { $('decision-body').innerHTML = `<div class="decision-done"><div class="done-icon">✓</div><h3>${{ accept: '新草案已确认', edit: '修改后已确认', maintain: '已维持原判断' }[state.decision.action]}</h3><p>人工决策已写入本页 Judgment 记录。可重置后演示另一分支。</p></div>`; return; }
  $('decision-body').innerHTML = `<p class="decision-intro">核对证据后选择一项。新版本只在人工确认后成为 active。</p><label for="edited-draft">修改草案内容</label><textarea id="edited-draft" rows="4">${esc(judgment('JDG-006').judgment_text)}</textarea><div id="edit-error" class="edit-error" role="alert"></div><div class="action-stack"><button class="primary-button" id="accept" type="button">确认新草案</button><button class="outline-button" id="edit" type="button">修改后确认</button><button class="subtle-button" id="maintain" type="button">维持原判断</button></div><small class="decision-foot">演示交互仅更新本页内存状态。</small>`;
  for (const action of ['accept', 'edit', 'maintain']) $(action).addEventListener('click', () => {
    try { state = decide(state, action, $('edited-draft').value); render(); $('review').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    catch (error) { $('edit-error').textContent = error.message; $('edited-draft').focus(); }
  });
}

function renderPremises() {
  $('premises-body').innerHTML = `<div class="premise-list">${data.premises.map((item) => `<div class="premise"><span class="premise-state ${item.status === '满足' ? 'yes' : item.status === '不满足' ? 'no' : 'unsure'}">${esc(item.status)}</span><strong>${esc(item.text)}</strong><small>${item.researcher_hypothesis ? '<b>研究员假设</b>' : `来源 · ${esc(item.evidence_ids.filter((id) => state.evidence.some((row) => row.evidence_id === id)).join(' / '))}`}</small></div>`).join('')}</div>`;
}
function renderProgress() {
  $('step-1').className = !state.processed ? 'current' : 'complete';
  $('step-2').className = state.processed && !state.decision ? 'current' : state.decision ? 'complete' : '';
  $('step-3').className = state.decision ? 'current' : '';
}
function render() { renderProgress(); renderInbox(); renderLedger(); renderReview(); renderDecision(); renderPremises(); }
$('reset').addEventListener('click', () => { state = initialState(data); render(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
fetch('./data.json').then((response) => { if (!response.ok) throw new Error('data.json unavailable'); return response.json(); }).then((fixture) => { data = fixture; state = initialState(data); render(); }).catch((error) => { document.querySelector('.content').innerHTML = `<div class="load-error">演示数据加载失败：${esc(error.message)}。请运行 python3 -m http.server 8765 --directory demo 。</div>`; });
