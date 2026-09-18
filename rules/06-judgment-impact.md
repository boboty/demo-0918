# 历史研判影响规则

本文件只定义 P02 的业务判断边界；输入不足时按对应规则阻断确认。

## JI-001 仅检查直接依赖

- 输入条件：新记录或变化目标为 Fact、Metric、ProjectEvent
- 判断逻辑：用 target_type+target_id 与 Judgment.dependency_refs 精确匹配；只检查命中的 Judgment
- 输出结果：`dependent_judgments`
- 是否允许 AI 自动执行：是，仅按规则输出或执行允许的状态变化
- 是否要求人工确认：否；后续状态变化按 JI-003
- 示例：MET-001 变化 → 只检查引用 MET-001 的判断
- 例外或边界：文本相似不形成依赖

## JI-002 纯支持证据不触发

- 输入条件：新增 Evidence 支持已依赖对象，value/date/lifecycle_stage/knowledge_status/scope 均未变
- 判断逻辑：只更新证据版本；Judgment 状态保持原值
- 输出结果：`no_review_trigger`
- 是否允许 AI 自动执行：是，仅按规则输出或执行允许的状态变化
- 是否要求人工确认：否
- 示例：MET-001 增加第二条同值证据 → no_review_trigger
- 例外或边界：若新证据构成反驳则转 JI-003

## JI-003 实质变化触发复核

- 输入条件：直接依赖对象的值、日期、阶段、知识状态或统计范围变化，或可靠证据推翻事件
- 判断逻辑：比对前后快照；任一列实质变化则把受影响 active 判断标 review_required
- 输出结果：`review_required`
- 是否允许 AI 自动执行：是，仅按规则输出或执行允许的状态变化
- 是否要求人工确认：是；最终判断由研究员复核
- 示例：依赖 MET-001 从 known→conflicting → review_required
- 例外或边界：无直接依赖不得触发；只是证据数量变化走 JI-002

## JI-004 无关事实不影响

- 输入条件：新对象 ID 不在某 Judgment.dependency_refs
- 判断逻辑：对该 Judgment 不改变状态
- 输出结果：`unaffected`
- 是否允许 AI 自动执行：是，仅按规则输出或执行允许的状态变化
- 是否要求人工确认：否
- 示例：JDG-003 未依赖 EVT-003，新增该事件 → unaffected
- 例外或边界：不按自然语言“可能有关”扩大依赖

## JI-005 AI 草案不成为正式判断

- 输入条件：受影响判断需要新表述或 AI 生成新判断
- 判断逻辑：原 active 转 review_required；AI 新判断仅 draft，不能直接 active
- 输出结果：`draft_requires_review`
- 是否允许 AI 自动执行：可提出候选，不可独立确认
- 是否要求人工确认：是
- 示例：AI 针对北岸冲突提出新表述 → draft
- 例外或边界：AI 不直接改写原判断文本

## JI-006 人工确认版本

- 输入条件：研究员已复核判断及证据版本
- 判断逻辑：人工可维持原文、修改或创建新版本；确认新版本 active 后旧版本 superseded
- 输出结果：`active_and_superseded 或 maintained`
- 是否允许 AI 自动执行：否
- 是否要求人工确认：是
- 示例：研究员确认新版本 v2 → v2 active，v1 superseded
- 例外或边界：未确认 draft 不得升 active

## JI-007 自然语言前提限制

- 输入条件：Judgment.premises 仅为自然语言，未结构化映射来源/假设
- 判断逻辑：不以 premises 文本自动触发更新；仅 dependency_refs 驱动自动影响分析
- 输出结果：`premise_not_auto_evaluated`
- 是否允许 AI 自动执行：是，仅按规则输出或执行允许的状态变化
- 是否要求人工确认：否；前提解释由研究员复核
- 示例：“依赖渠道能力”出现在 premises，但无结构化引用 → 不自动触发
- 例外或边界：结构化前提来源与假设标识留 P04
