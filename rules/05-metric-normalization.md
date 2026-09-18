# 同口径比较规则

本文件只定义 P02 的业务判断边界；输入不足时按对应规则阻断确认。

## MN-001 指标名一致

- 输入条件：两条 Metric 待数值比较
- 判断逻辑：metric_name 相同才继续；power_capacity 只比 power_capacity，energy_capacity 只比 energy_capacity
- 输出结果：`comparable_by_metric 或 comparison_blocked`
- 是否允许 AI 自动执行：是，仅按规则输出或执行允许的状态变化
- 是否要求人工确认：否
- 示例：100 MW 与 200 MWh → comparison_blocked
- 例外或边界：MW 与 MWh 不互换

## MN-002 确定性单位换算

- 输入条件：metric_name、口径和阶段已可比，单位不同且换算明确
- 判断逻辑：保留原 value/unit；GW×1000→MW，GWh×1000→MWh，记录换算表达后比较
- 输出结果：`converted_comparison`
- 是否允许 AI 自动执行：是，仅按规则输出或执行允许的状态变化
- 是否要求人工确认：否；不明确单位需人工补充
- 示例：0.1 GW = 100 MW，可比较
- 例外或边界：P02 只规定换算，不实现生产级框架；币种与价格基期不可臆换

## MN-003 生命周期阶段一致

- 输入条件：容量指标的 lifecycle_stage 待比较
- 判断逻辑：阶段相同才做同口径数值比较；不同可并列展示并标出阶段
- 输出结果：`comparable_by_stage 或 comparison_blocked`
- 是否允许 AI 自动执行：是，仅按规则输出或执行允许的状态变化
- 是否要求人工确认：否
- 示例：planned 100 MW 与 full_operation 50 MW → comparison_blocked
- 例外或边界：阶段不可仅从 scope_definition 猜测

## MN-004 组织范围一致

- 输入条件：比较对象的 subject_type、层级和 scope_definition 已知
- 判断逻辑：同层级同统计范围才直接比较；跨集团/平台/SPV/项目须标出差异并阻断直接同口径结论
- 输出结果：`comparable_by_scope 或 comparison_blocked`
- 是否允许 AI 自动执行：是，仅按规则输出或执行允许的状态变化
- 是否要求人工确认：否
- 示例：集团 2000 MW 与平台 1500 MW → comparison_blocked
- 例外或边界：可并列展示，但不能当同口径高低结论

## MN-005 投资口径一致

- 输入条件：两条投资 Metric 待比较
- 判断逻辑：planned_investment、agreement_amount、budget、disclosed_capex、capitalized_asset 必须同名且 scope_definition 一致
- 输出结果：`comparable_by_investment_scope 或 comparison_blocked`
- 是否允许 AI 自动执行：是，仅按规则输出或执行允许的状态变化
- 是否要求人工确认：否
- 示例：计划投资 8 亿与已披露资本开支 5 亿 → comparison_blocked
- 例外或边界：不得合成一个“投资金额”

## MN-006 项目类型保留

- 输入条件：独立储能与配储项目并列研究
- 判断逻辑：比较路径、经营或收益时保留 Project.project_type；类型不同则标注差异，不推出完全同类结论
- 输出结果：`type_difference_disclosed`
- 是否允许 AI 自动执行：是，仅按规则输出或执行允许的状态变化
- 是否要求人工确认：否；路径解释由研究员确认
- 示例：北岸独立储能与南岭配储并列 → 标明类型
- 例外或边界：类型不同仍可并列展示

## MN-007 未知值不聚合

- 输入条件：Metric.knowledge_status=unknown
- 判断逻辑：展示“未知/暂无可确认数据”，排除平均与合计，不能以 0 代入
- 输出结果：`excluded_unknown`
- 是否允许 AI 自动执行：是，仅按规则输出或执行允许的状态变化
- 是否要求人工确认：否
- 示例：南岭经营结果 unknown → 不参与均值
- 例外或边界：空值不代表 0

## MN-008 冲突值不聚合

- 输入条件：Metric.knowledge_status=conflicting 且未人工确认采用值
- 判断逻辑：保留候选值，禁止作为唯一值进入平均或合计
- 输出结果：`excluded_conflicting`
- 是否允许 AI 自动执行：是，仅按规则输出或执行允许的状态变化
- 是否要求人工确认：是；选择分析基线须人工确认
- 示例：北岸计划投资 8/9 亿均 conflicting → 不聚合
- 例外或边界：不得静默挑高等级记录
