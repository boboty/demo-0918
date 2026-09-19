import { initialMonitor, runMonitor, decide } from './monitor.mjs';
const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let task, data, state, busy = false;
const source = (id) => data.sources.find((x) => x.source_id === id);
const judgment = (id) => state.judgments.find((x) => x.judgment_id === id);
const link = (id) => `<a href="${esc(source(id).locator)}" target="_blank" rel="noopener noreferrer">${esc(data.research_source_ids[id])} · ${esc(source(id).provider)}</a>`;
function renderTask() {
  $('objectives').innerHTML = task.objectives.map((x) => `<li>${esc(x)}</li>`).join('');
  $('schedule').textContent = `自动更新：${task.schedule.display_time}`;
  $('review-count').textContent = state.judgments.filter((x) => x.judgment_status === 'review_required').length;
  $('last-update').textContent = state.processed ? '本次课堂演示' : '尚未执行';
  $('sources').innerHTML = task.sources.map((x) => `<div class="source-row"><strong>${esc(x.name)}</strong><span>${esc(x.method)}</span><span>最近获取：${esc(state.processed && x.source_id ? '本次快照核对' : x.last_checked)}</span><em>${esc(state.processed && x.source_id === 'SRC-010' ? '发现新资料' : x.status)}</em></div>`).join('');
  [...$('stage-nav').children].forEach((node, index) => node.classList.toggle('active', state.processed && [0, 1, 2, 5].includes(index)));
}
function renderFacts() {
  const met = (name, prefix) => state.metrics.find((x) => x.metric_name === name && x.scope_definition.startsWith(prefix));
  const value = (name, prefix) => { const x = met(name, prefix); return x ? `${x.value} ${x.unit}` : '未知'; };
  const filed = state.events.find((x) => x.event_type === 'approved_or_filed');
  const grid = state.events.find((x) => x.event_type === 'first_grid_connection');
  $('facts').innerHTML = `<div class="fact-line"><span>规模状态轴</span><strong>规划 → 备案 ${filed ? esc(filed.event_date) : '未知'} → 开工未知 → 首批并网 ${grid ? esc(grid.event_date) : '未知'} → 全容量投运未知</strong></div><div class="fact-line"><span>总建设规模</span><strong>${value('power_capacity', '总建设规模')} / ${value('energy_capacity', '总建设规模')}</strong></div><div class="fact-line"><span>一期建设规模</span><strong>${value('power_capacity', '一期建设规模')} / ${value('energy_capacity', '一期建设规模')}</strong></div><div class="fact-line"><span>投资口径线</span><strong>计划投资两项待核对；实际资本开支、已转固资产：未知</strong></div><small>“并网”不推定全容量投运；总规模不等于一期已并网规模。详情见下方证据。</small>`;
}
function renderStory() {
  const { changes, review } = state;
  $('story').hidden = false;
  $('change-list').innerHTML = changes.additions.map((x) => `<div class="change-item"><span>${esc(x.label)}</span><strong>${esc(x.value)}</strong></div>`).join('');
  renderFacts();
  const original = judgment('JDG-001');
  $('impact-title').textContent = `影响 ${review.affected.length} 条历史研判`;
  $('historical').innerHTML = `<div class="history"><span>模拟历史研判 · 基于真实公开资料构造 · DEMO</span><p>“${esc(original.judgment_text)}”</p><strong>状态 → ${esc(original.judgment_status)}</strong><small>新增公开资料出现另一项总投资表述，且当前无法确认两者统计范围一致。原判断依赖 ${esc(review.before.metric_id)} / SRC-C09。</small></div>`;
  $('amounts').innerHTML = [[review.before, '已有资料', 'SRC-009'], [review.after, '本次新资料', 'SRC-010']].map(([x, label, id]) => `<div class="amount"><span>${label}</span><strong>${esc(x.value)} ${esc(x.unit)}</strong><small>${link(id)}</small></div>`).join('<span class="versus">对照</span>');
  $('system-call').innerHTML = `<strong>${esc(review.comparison.conclusion)}</strong><p>${esc(review.comparison.reason)}。不自动覆盖、不自动选择真值，需要复核。</p><small>业务规则输出：${esc(review.comparison.outcome)}</small>`;
  $('evidence-detail').innerHTML = `<p>公开资料原文摘录与关联记录（非本次实时联网）：</p>${['SRC-009', 'SRC-010'].map((id) => `<div><strong>${link(id)}</strong><ul>${state.evidence.filter((e) => e.source_id === id).map((e) => `<li>${esc(e.evidence_id)} · ${esc(e.evidence_text)} → ${esc(e.target_id)}</li>`).join('')}</ul></div>`).join('')}`;
  $('draft-text').textContent = judgment('JDG-006').judgment_text;
  $('draft-badge').textContent = judgment('JDG-006').judgment_status;
  $('impact-badge').textContent = state.decision ? '人工复核已完成' : '需要复核';
  renderDecision(); renderTask();
}
function renderDecision() {
  if (state.decision) {
    const active = state.judgments.find((x) => x.judgment_status === 'active');
    $('decision-body').innerHTML = `<div class="done"><strong>${{ accept: '已确认新研判', edit: '已修改后确认', maintain: '已维持原判断' }[state.decision.action]}</strong><p>${esc(active.judgment_text)}</p><small>${esc(active.judgment_id)} · v${active.version} · active；其余版本保留。</small></div>`;
    return;
  }
  $('decision-body').innerHTML = `<label for="edited-draft">修改草案内容</label><textarea id="edited-draft" rows="4">${esc(judgment('JDG-006').judgment_text)}</textarea><div id="edit-error" role="alert"></div><div class="actions"><button id="accept" class="primary-button" type="button">确认新研判</button><button id="edit" class="outline-button" type="button">修改后确认</button><button id="maintain" class="subtle-button" type="button">维持原判断</button></div><small>操作仅更新本页内存；重置可演示其他分支。</small>`;
  for (const action of ['accept', 'edit', 'maintain']) $(action).addEventListener('click', () => {
    try { state = decide(state, action, $('edited-draft').value, new Date().toISOString().slice(0, 10)); renderStory(); $('decision').scrollIntoView({ behavior: 'smooth' }); }
    catch (error) { $('edit-error').textContent = error.message; }
  });
}
async function update() {
  if (busy || state.processed) return;
  busy = true; $('fetch-now').disabled = true; $('result').hidden = false;
  $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('fetch-progress').innerHTML = '<div class="progress-line current">正在检查 3 个来源…</div>';
  await pause(850); $('fetch-progress').innerHTML += '<div class="progress-line">2 个来源无变化</div>';
  await pause(750);
  const result = runMonitor(state, task, data); state = result.state;
  $('fetch-progress').innerHTML += '<div class="progress-line">1 个来源发现新资料 → 送入情报收件箱</div>';
  $('result-title').textContent = '情报收件箱 · 发现 1 条可能影响既有研判的新资料';
  $('discovery').hidden = false;
  $('discovery').innerHTML = `<span>新资料 · ${esc(data.research_source_ids[result.changes.newSources[0]])}</span><h3>《${esc(source(result.changes.newSources[0]).title)}》</h3><small>${link(result.changes.newSources[0])} · ${esc(result.changes.acquisition)}</small>`;
  await pause(600); renderStory(); busy = false;
}
$('fetch-now').addEventListener('click', update);
$('reset').addEventListener('click', () => { if (busy || !task) return; state = initialMonitor(task, data); $('result').hidden = true; $('story').hidden = true; $('discovery').hidden = true; $('fetch-progress').innerHTML = ''; $('fetch-now').disabled = false; renderTask(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
Promise.all(['./monitor-task.json', './real-project.json'].map((path) => fetch(path, { cache: 'no-store' }).then((r) => { if (!r.ok) throw new Error(`${path} unavailable`); return r.json(); }))).then(([t, d]) => { task = t; data = d; state = initialMonitor(task, data); renderTask(); }).catch((e) => { $('task').innerHTML = `<div class="load-error">演示数据加载失败：${esc(e.message)}。请运行 python3 -m http.server 8765 --directory demo 。</div>`; });
