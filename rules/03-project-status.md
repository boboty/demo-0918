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

- 输入条件：正式确认过的 ProjectEvent 后来出现针对该事件的 `Evidence.relation=contradicts`
- 判断逻辑：保留原 `event_type`、`event_date`、原证据和已确认记录；关联新的反驳 Evidence，将 Event 的 `human_review_status` 标为 `review_required`。该标记表示原正式状态受挑战，不表示原事件已失效；不得自动撤销或降低原正式状态
- 输出结果：`review_required`；原正式展示阶段保持，等待人工复核
- 是否允许 AI 自动执行：是，仅按规则输出或执行允许的状态变化
- 是否要求人工确认：是；只有人工可解决冲突
- 示例：原已确认 `full_operation`，后有证据反驳 → `human_review_status=review_required`，正式展示仍为 `full_operation` 并提示复核
- 例外或边界：AI 不判断原事件失效；从未正式确认的新阶段仍只是候选，不适用“保留原正式状态”

## PS-008 当前展示状态推导

- 输入条件：同一 Project 的主生命周期 ProjectEvent、关联 Evidence，以及受挑战 Event 在新反驳证据进入前的人工确认记录
- 判断逻辑：主生命周期顺序为 `planned → approved_or_filed → construction_started → first_grid_connection → full_operation`。A：`human_review_status=confirmed`、`knowledge_status=known` 且无复核争议的 Event 正常参与排序，最高阶段为 `formal_display_status`。B：若最高阶段在反驳证据进入前已正式确认，后来按 PS-007 变为 `review_required`，该阶段仍保留为 `formal_display_status`，同时输出 `status_review_required=true`；不得自动回退。C：从未正式确认的新高阶段，即使存在候选 Evidence 或 `review_required`，也不得提升正式展示状态，只提示该阶段待确认。若无法核实某个 `review_required` Event 曾经正式确认，不得把它当作 B 类正式状态
- 输出结果：`formal_display_status` 为最高已确认阶段，或原已确认但受挑战的最高阶段；B 类另有 `status_review_required=true`，C 类另有 `pending_new_stage`。没有任何可核实的已确认主阶段时为 `unknown`
- 是否允许 AI 自动执行：是，仅按可核实的人工确认记录推导展示结果，不创建、撤销或确认业务事实
- 是否要求人工确认：推导本身否；受挑战状态的有效性和新候选阶段仍须研究员确认
- 示例：原 confirmed `full_operation` 后关联 contradicts Evidence → 仍展示 `full_operation`，提示正在复核；confirmed `construction_started` + 从未确认的 `full_operation` 候选 → 仍展示 `construction_started`
- 例外或边界：只有可靠确认的 `full_operation` 时可直接展示该阶段，不补造中间事件；`signed`、`operation`、`operating_result_disclosed` 不参与主顺序。P01 当前 Event 记录只有现时审核状态，不能单凭现时 `review_required` 推断其曾被确认；B 类必须有可核实的前次确认记录，否则按 C 类处理并交人工核对
