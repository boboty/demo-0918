# 衡策课堂 Demo

在仓库根目录运行：

```bash
python3 -m http.server 8765 --directory demo
```

打开 <http://127.0.0.1:8765>。先看舟山定海的公开证据：总建设规模与一期分开列出，两条投资声称值保留原币种，业务函数因币种不同且统计范围未获确认而输出 `comparison_blocked`。然后沿页面提示进入完全独立的北岸 Mock 项目，演示新情报 → 事实冲突 → 判断复核 → AI 草案 → 人工确认。右上角可重置交互。

`real-project.json` 只含 PRJ-C03 已复核的 SRC-C09、SRC-C10 对应资料，不使用 SRC-C11。为遵守未修改的 P01 Schema，业务记录使用 `PRJ-003`、`SRC-009`、`SRC-010`，外层 `research_project_id` 与 `research_source_ids` 保留研究资料编号。真实记录均标记 `is_mock=false`；北岸 Mock 记录保存在独立的 `data.json`，两者不混用。

`rules.mjs` 执行投资口径阻断、证据关联、Mock 同口径冲突、直接依赖复核与 Judgment 版本处理。新草案引用 `MET-005`、`MET-006` 和原备案 Event，人工确认后保留依赖。AI 文本预置；交互只改变浏览器内存。

自动验收：

```bash
python3 demo/validate.py && node --test demo/rules.test.mjs
```

规则实现覆盖本课堂场景所需的 P02 子集，不是通用规则引擎。
