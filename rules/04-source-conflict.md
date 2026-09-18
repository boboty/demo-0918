# 来源冲突规则

本文件只定义 P02 的业务判断边界；输入不足时按对应规则阻断确认。

值冲突比较先核对六个维度：subject、metric_name/fact_type、period/effective_period、lifecycle_stage、scope_definition 所表达的统计范围、unit。`scope_definition` 的来源措辞可以不同；要比较其所指统计范围，不按整段字符串是否相等判定。任一维度缺失且无法从原始证据核对时，输出 `comparison_blocked` 并补充口径，不直接判定冲突。

## SC-001 不同阶段不构成值冲突

- 输入条件：同主体同指标，但 lifecycle_stage 不同
- 判断逻辑：先比阶段；不同则并列保留，不置 conflicting
- 输出结果：`not_conflicting`
- 是否允许 AI 自动执行：是，仅按规则输出或执行允许的状态变化
- 是否要求人工确认：否
- 示例：planned 100 MW 与 full_operation 50 MW → not_conflicting
- 例外或边界：阶段缺失时先补口径，不推断相同阶段

## SC-002 不同指标不构成值冲突

- 输入条件：同主体同期间，但 metric_name 或 fact_type 不同
- 判断逻辑：指标类型不同则不执行值冲突比较
- 输出结果：`not_conflicting`
- 是否允许 AI 自动执行：是，仅按规则输出或执行允许的状态变化
- 是否要求人工确认：否
- 示例：计划投资 8 亿元与 disclosed_capex 5 亿元 → not_conflicting
- 例外或边界：同名自然语言描述须先规范到指标名

## SC-003 不同统计范围不构成值冲突

- 输入条件：集团、平台、SPV、项目主体或 scope_definition 不同
- 判断逻辑：先核对 subject、统计范围与单位；不同则并列保留
- 输出结果：`not_conflicting`
- 是否允许 AI 自动执行：是，仅按规则输出或执行允许的状态变化
- 是否要求人工确认：否
- 示例：集团 2000 MW 与平台 1500 MW → not_conflicting
- 例外或边界：范围未知时输出 comparison_blocked，不猜同口径

## SC-004 同口径不同值

- 输入条件：subject、指标/事实类型、期间、阶段、scope_definition 所指统计范围和单位均一致，数值不同
- 判断逻辑：保留每条原始记录及 Evidence，各自标记 conflicting，不生成无值汇总记录
- 输出结果：`conflicting`
- 是否允许 AI 自动执行：是，仅按规则输出或执行允许的状态变化
- 是否要求人工确认：是；采用何值须人工确认
- 示例：虚构北岸同期间同口径计划投资 8/9 亿元 → 两条 conflicting Metric
- 例外或边界：先做确定性单位换算；不同投资口径走 SC-002

## SC-005 高等级不抹除低等级

- 输入条件：已确认真冲突且来源等级不同
- 判断逻辑：保留全部来源和冲突；AI 可提示较高等级可作核查基线，不能自动改为 known
- 输出结果：`review_required`
- 是否允许 AI 自动执行：可提出候选，不可独立确认
- 是否要求人工确认：是
- 示例：A 级台账 9 亿与 C 级研究报告 8 亿 → review_required
- 例外或边界：高等级不等于该值必然正确

## SC-006 AI 冲突职责

- 输入条件：AI 识别到疑似不一致
- 判断逻辑：只输出冲突候选、可能原因与核查方向；不删除、改写来源或选定正确值
- 输出结果：`conflict_candidate`
- 是否允许 AI 自动执行：可提出候选，不可独立确认
- 是否要求人工确认：是；实际冲突与采用口径均需确认
- 示例：AI 提醒核对北岸 8/9 亿元来源 → conflict_candidate
- 例外或边界：缺关键维度时先要求补齐，不直接判真冲突
