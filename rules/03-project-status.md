# 项目状态规则

本文件只定义 P02 的业务判断边界；输入不足时按对应规则阻断确认。

## PS-001 规划

- 输入条件：证据明确描述规划、方案或投资计划，主体已对齐
- 判断逻辑：记录 planned 事件候选；确认是否存在明确计划陈述和可用证据
- 输出结果：`planned`
- 是否允许 AI 自动执行：可提出候选，不可独立确认
- 是否要求人工确认：是；事件确认由研究员完成
- 示例：虚构南岭项目“拟配置 50 MW” → planned 候选
- 例外或边界：signed 不能自动推出 planned；计划不等于实施

## PS-002 核准或备案

- 输入条件：证据明确描述核准、备案或批复已经发生
- 判断逻辑：仅该完成语义可确认 approved_or_filed，日期按来源明示记录
- 输出结果：`approved_or_filed`
- 是否允许 AI 自动执行：可提出候选，不可独立确认
- 是否要求人工确认：是；关键状态首次确认由研究员完成
- 示例：政府信息明确“已完成备案” → approved_or_filed
- 例外或边界：受理申请或拟备案不满足

## PS-003 开工

- 输入条件：证据明确“已开工”“正式开工”或“施工启动”
- 判断逻辑：已发生语义且 A/B 证据可提出确认；计划/拟/预计只能 pending_confirmation
- 输出结果：`construction_started 或 pending_confirmation`
- 是否允许 AI 自动执行：可提出候选，不可独立确认
- 是否要求人工确认：是；关键状态首次确认由研究员完成
- 示例：B 级官方信息称“正式开工” → construction_started；A 级“计划开工” → pending_confirmation
- 例外或边界：C 单独支持仍按 EG-003 待确认；D 不推动

## PS-004 首批并网

- 输入条件：证据明确首批或首次并网已经发生
- 判断逻辑：已发生语义且 A/B 证据支持时提出确认
- 输出结果：`first_grid_connection`
- 是否允许 AI 自动执行：可提出候选，不可独立确认
- 是否要求人工确认：是
- 示例：B 级官方动态“首批设备已并网” → first_grid_connection
- 例外或边界：计划并网和全容量投运不能反推首批并网日期

## PS-005 全容量投运

- 输入条件：证据明确全容量投运、全部投产、全容量并网或等价已发生事实
- 判断逻辑：A/B 支持时可提出确认；仅 C 时 pending_confirmation；仅 D 时 lead_only
- 输出结果：`full_operation、pending_confirmation 或 lead_only`
- 是否允许 AI 自动执行：可提出候选，不可独立确认
- 是否要求人工确认：是；正式确认由研究员完成
- 示例：B 级动态“全容量投运” → full_operation；C 级单独同句 → pending_confirmation
- 例外或边界：operation/operating_result_disclosed 不替代 full_operation

## PS-006 不补造中间事件

- 输入条件：可靠证据直接确认后期事件，但中间事件缺证据
- 判断逻辑：仅写有明确证据的事件；推导展示状态可到后期，不生成缺失事件或日期
- 输出结果：`confirmed_later_event_without_invented_intermediates`
- 是否允许 AI 自动执行：是，仅按规则输出或执行允许的状态变化
- 是否要求人工确认：否；新增中间事件仍须证据与人工确认
- 示例：仅有全容量投运证据 → 不生成开工日期
- 例外或边界：signed 是前期商业事件；operation 与经营披露是投运后证据

## PS-007 冲突状态

- 输入条件：同一事件出现反驳证据，或新证据与已确认事件矛盾
- 判断逻辑：保留原事件和全部证据，禁止覆盖；标记人工复核
- 输出结果：`review_required`
- 是否允许 AI 自动执行：是，仅按规则输出或执行允许的状态变化
- 是否要求人工确认：是；只有人工可解决冲突
- 示例：原“已开工”后出现明确“尚未开工” → review_required
- 例外或边界：不能让 AI 自行选择来源并改写原 Event

## PS-008 当前展示状态推导

- 输入条件：同一 Project 的 ProjectEvent，以及各事件的 `event_type`、`human_review_status`、`knowledge_status` 和未决冲突信息
- 判断逻辑：主生命周期顺序为 `planned → approved_or_filed → construction_started → first_grid_connection → full_operation`。只从 `human_review_status=confirmed`、`knowledge_status=known` 且该阶段无未决冲突的主生命周期事件中取最高阶段，作为当前正式展示状态；`pending_confirmation`、`review_required`、`unreviewed` 的事件不得提升正式状态，但较高阶段有此类记录时单独提示“存在待确认的新阶段”。若较高阶段出现未决冲突，即使原事件曾确认，也将该阶段暂从正式展示推导中排除，维持此前最高无争议的 confirmed 阶段，并显示 `review_required` 提示
- 输出结果：`formal_display_status` 为最高可用 confirmed 主阶段；可附 `pending_new_stage` 或 `review_required` 提示。无可用 confirmed 主事件时，正式展示状态为 `unknown`
- 是否允许 AI 自动执行：是，仅从已人工确认的事件推导展示结果，不创建或确认新业务事实
- 是否要求人工确认：否；但候选事件确认和冲突解除仍由研究员完成
- 示例：confirmed `construction_started` + pending `full_operation` → 正式展示 `construction_started`，另提示 `full_operation` 待确认
- 例外或边界：只有可靠确认的 `full_operation` 时可直接展示该阶段，不补造备案、开工或首批并网事件；`signed` 不参与主顺序；`operation` 与 `operating_result_disclosed` 不替代或高于 `full_operation`；更高阶段冲突未决时正式展示保持此前最高无争议 confirmed 阶段
