# 衡策课堂 Demo

在仓库根目录运行：

```bash
python3 -m http.server 8765 --directory demo
```

打开 <http://localhost:8765>。按“处理这条情报”→查看两条计划投资 Metric 保留原值并进入 conflicting、直接依赖的 Judgment 进入 review_required → 查看独立 draft → 选择人工决策。右上角可重置。

业务记录使用 P01 的 Project、Source、Evidence、Metric、ProjectEvent、Judgment 字段，存放于 `data.json`。新情报在处理前是独立输入，处理时由 `rules.mjs` 校验引用、核对同口径、判断冲突、比对依赖与生成草案。项目状态由 Event 和 Evidence 推导。AI 文本预置，人工确认才生成或启用正式 Judgment 版本。所有记录都是明确标注的 Mock 数据，交互仅改变浏览器内存。

自动验收：

```bash
python3 demo/validate.py && node --test demo/rules.test.mjs
```

覆盖 P01 Schema 字段、证据关联、同口径冲突与阻断、直接依赖、C 级生命周期边界、三种人工决定。规则仅实现本课堂场景所需的 P02 子集，不是通用规则引擎。
