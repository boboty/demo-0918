# 衡策·新能源战略研究台｜课堂薄切片

在仓库根目录运行 `python3 -m http.server 8765 --directory demo`，打开 <http://127.0.0.1:8765>。

本演示遵守 `docs/01-product-definition.md` V1.2 Final：研究专题中的定时/手动更新只是“情报进入”的入口，不是爬虫或独立监测产品。六个工作区保留在界面中；舟山 PRJ-C03 运行情报进入、事实还原、同口径核对和研判复核，路径研究与集团对照明确标为本次未展开。项目状态轴、MW/MWh、投资口径与未知状态仍在事实台账中。

点击“立即更新”，`monitor.mjs` 对比 checked-in 的 previous/current 已复核资料快照，识别 SRC-C10，关联真实公开来源与摘录，并调用 `rules.mjs` 的 `comparePublicInvestment`。币种和统计范围阻断统一投资额；基于历史 Judgment 对 MET-024 的直接依赖标记 `review_required`。预置 AI 文本为 `draft`，人工确认、修改或维持后才更新本页内存中的 active 版本。点击“重置演示”可重走分支。

`real-project.json` 中 SRC-C09/C10 是已独立复核的真实公开资料，链接可从界面打开；`monitor-task.json` 保存专题、来源目录、真实的 `0 8 * * *` 定时配置、前后快照和显式 `is_mock=true` 的课堂模拟历史研判。课堂执行不实时联网、不运行后台 scheduler，亦不声称龙源电力官网本轮有实际抓取记录。原北岸 Mock 规则用例仍保留，但不再是主页面叙事。

运行全部验收：

```bash
python3 demo/validate.py
node --test demo/*.test.mjs
python3 tools/validate_p01.py
python3 tools/validate_p02.py
```
