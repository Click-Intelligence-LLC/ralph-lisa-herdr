# Herdr Agent 提示真实投递确认修复实施方案

日期：2026-11-17  
开发分支：`fix/herdr-delivery-ack`  
状态：实施基线，尚未完成代码修复与真实验收

## 1. 背景与现场结论

公共版本端到端验收中，Ralph 候选已由协调器正式提交，RLL 状态从 generation 0 推进到 generation 1，轮次切换到 Lisa。Herdr 的 `agent prompt` 请求返回成功，插件也写入了 `accepted` 投递记录并输出 `handed_off`；但 Lisa/Codex Pane 始终停留在空白输入界面，没有显示交接提示，也没有进入工作状态。

现场证据表明：

- Herdr Server 日志中的两次 `agent.prompt` 请求均为 `outcome=ok`；
- 插件 `delivery-<request-id>.json` 被写为 `status=accepted`；
- 协调器记录已经把游标推进到 generation 1、turn Lisa；
- Lisa Agent 仍为 `idle`，Pane 输出没有出现交接正文；
- Lisa 没有可用的原生 Codex 会话引用；
- 未进行人工重放，因此现场证据没有被第二次投递污染。

保留的本机隔离证据根目录为 `/private/tmp/r16pub.s7qrv2`，对应命名 Herdr Server 已停止。该路径是本机诊断证据，不是产品运行依赖。

## 2. 已确认问题与尚未确认问题

### 2.1 已确认的插件缺陷

当前 `integrations/herdr/coordinator.mjs` 中的 `submitPrompt()` 只检查 Herdr 返回的 `agent_prompted` 确认包：

1. Agent 名称是否匹配；
2. Agent 类型是否为预期的 Claude 或 Codex；
3. Workspace、Pane 和项目目录是否匹配。

确认包通过后，代码立即把投递从 `intent` 改为 `accepted`，随后推进插件游标并输出 `handed_off`。代码没有要求目标 Agent 出现任何“实际消费输入”的可观察变化。

因此，当前实现把“Herdr 接受了输入请求”错误等同于“目标 Agent 已经收到并开始处理”。这是本轮必须修复的插件协议缺陷。

### 2.2 尚未确认的底层原因

Lisa 未实际收到输入的底层原因仍需用修复后的诊断结果进一步区分：

- Herdr 0.9.4 在 Codex TUI 上只完成输入排队，没有完成 Enter 提交；
- Codex TUI 或更新提示切换后存在短暂输入时序问题；
- Herdr 对 Codex 的屏幕识别把尚未可接收输入的界面误判为 `idle`；
- 其他尚未观察到的 Herdr/Codex 交互问题。

本修复不预判上述原因，也不使用原始 Pane 输入作为自动降级方案。结果不明确时自动重发可能造成重复交接，必须保持失败关闭。

## 3. 修复目标

修复后的交接必须满足：

1. Herdr 仅返回普通 `agent_prompted` 不足以确认交接成功；
2. 只有 Herdr 在本次提交后观察到目标 Agent 进入 `working` 或 `blocked`，插件才能记录 `accepted`；
3. 接受投递前再次核对 Agent、Workspace、Pane、Terminal 和项目身份；
4. `agent_prompt_stalled`、超时或身份变化时不推进插件游标；
5. 不确定投递不自动重发，保留持久意图供只读核查；
6. 初始 Ralph 提示、普通 Ralph/Lisa 交接、任务更新通知使用同一确认规则；
7. 不放宽候选格式、策略、测试、来源确认、租约、重绑或接续门禁。

## 4. 非目标

本轮不包含：

- 修改 RLL 的业务 generation 或候选提交协议；
- 为不确定提示增加自动重放；
- 根据 Pane 文本中的 `[PASS]`、`[PLAN]` 等字样推进业务状态；
- 绕过 Claude 目录信任、Codex 登录或权限提示；
- 以缺失的原生会话引用冒充已验证会话；
- 修改 Herdr 源码；若最终证明是 Herdr 缺陷，另行提交最小复现和上游问题。

## 5. 目标投递状态机

```text
正式 RLL 回执或初始任务
            |
            v
校验目标席位当前为 ready
            |
            v
持久化 delivery intent
            |
            v
herdr agent prompt <target> <message>
  --wait
  --until working
  --until blocked
  --timeout <bounded-ms>
            |
      +-----+------------------------------+
      |                                    |
      v                                    v
观察到 working/blocked            stalled / timeout / error
      |                                    |
      v                                    v
再次核对席位身份                    保留 intent
      |                             phase=needs_reconcile
      v                             不推进游标、不重发
delivery=accepted
      |
      v
推进插件游标并输出 handed_off
```

`blocked` 可以作为“提示已经触发 Agent 处理”的证据，但它不表示任务完成。控制页和状态查询仍应显示 Agent 需要人工处理阻断。

## 6. 具体代码改造

### 6.1 `coordinator.mjs`

改造 `submitPrompt()`：

1. 保留现有的投递前 `verifySeat()`；
2. 保留先持久化 `intent`、后调用 Herdr 的顺序；
3. 把调用改为带边界等待的 `agent prompt --wait`；
4. 仅接受返回状态为 `working` 或 `blocked` 的本次活动确认；
5. 校验返回 Agent 的 target、kind、Workspace、Pane、Terminal、项目路径；
6. 再通过 `agent get` 核对席位没有被替换；
7. 全部通过后才把投递写成 `accepted`；
8. 只有 `accepted` 才允许调用方推进 `cursor_generation`、`cursor_receipt_id` 和 `cursor_turn`。

建议的 Herdr 调用形态：

```bash
herdr agent prompt <target> <message> \
  --wait \
  --until working \
  --until blocked \
  --timeout 7000
```

外层子进程超时必须略大于 Herdr 自身超时，避免插件先杀掉仍在返回诊断的 Herdr CLI。

### 6.2 错误归一化与安全诊断

Herdr 返回以下结果时，统一进入投递未确认路径：

- `agent_prompt_stalled`；
- `timeout` 或本地子进程 `ETIMEDOUT`；
- Agent 已退出、被替换或重新命名；
- Workspace、Pane、Terminal、项目目录变化；
- 返回结构不符合预期。

插件对外使用稳定错误码 `PROMPT_DELIVERY_UNCONFIRMED`，并保存受限诊断：

- Herdr 原始错误类别；
- 目标角色；
- 投递前和返回后的 Agent 状态；
- 可用时记录 `revision`、`state_change_seq`、`completion_seq`；
- 身份未匹配字段名。

不得保存：

- 任务正文或提示全文；
- 原生 Claude/Codex 会话 ID；
- API Key、登录信息或环境变量；
- 未脱敏的终端输出。

### 6.3 恢复检查

现有恢复协议已经把遗留 `intent` 视为 `DELIVERY_OUTCOME_UNCERTAIN`。本轮保持这一安全边界，并补充验证：

- 未确认投递不得出现在完整 accepted 投递链中；
- `recovery-check` 必须报告投递结果不确定；
- `rebind-check` 和 `continuation-check` 不得越过该 intent；
- 不提供自动“再试一次”按钮或隐式重发。

## 7. 测试方案

### 7.1 回归测试先行

先增加一个会在旧实现上失败的场景：

- 假 Herdr 在普通 `agent prompt` 下返回 `agent_prompted`；
- 只有调用带 `--wait` 时才模拟真实状态观察；
- 模拟目标始终没有进入 `working/blocked`，返回 `agent_prompt_stalled`；
- 断言插件进入 `needs_reconcile`；
- 投递文件保持 `intent`；
- generation 游标不推进；
- 不输出 `handed_off`；
- 后续轮询和重复启动均不产生第二次 prompt。

### 7.2 单元与集成场景

至少覆盖：

| 场景 | 预期 |
|---|---|
| 提示后进入 `working` | 投递 accepted，游标推进一次 |
| 提示后进入 `blocked` | 投递 accepted，状态仍提示需人工处理 |
| `agent_prompt_stalled` | intent 保留，needs_reconcile，不重发 |
| Herdr timeout / 进程 timeout | intent 保留，不推进游标 |
| 返回错误 Agent target | `PROMPT_ACK_MISMATCH` 或归一化未确认 |
| Workspace/Pane/Terminal 变化 | 失败关闭，不接受投递 |
| 快速状态变化 | 以 Herdr `--wait` 的本次活动观察结果为准 |
| 初始 Ralph 提示 | 使用同一真实投递确认规则 |
| Ralph -> Lisa | 每份正式回执恰好一次已确认交接 |
| Lisa -> Ralph | 每份正式回执恰好一次已确认交接 |
| 任务更新通知 | 未确认时不归档任务更新请求 |
| 恢复/重绑/接续 | intent 阻断自动接续和自动重放 |

### 7.3 全量回归

运行插件全部 Node 测试、CLI 构建和包校验，重点确认：

- 多项目并行能力不回退；
- full-auto 自动候选授权不受影响；
- managed shutdown、暂停/恢复、重绑/接续测试仍通过；
- GitHub Actions 的 Node 18/20/22 任务全部通过。

## 8. 真实 Herdr 验收

代码测试通过后，使用新的隔离环境，不复用本次失败会话：

1. 新建短路径临时根目录；
2. 使用独立 XDG config/state/cache；
3. 启动新的命名 Herdr Server；
4. 从待验收分支安装或链接插件；
5. 新建一次性 RLL 项目；
6. 仅对该临时目录处理 Claude 信任提示；
7. 启动 Ralph/Claude 与 Lisa/Codex；
8. 让 Ralph 产生一份合法计划候选并正式提交；
9. 同时核对：
   - Herdr prompt 等待返回真实活动；
   - Lisa Pane 显示本次回执交接提示；
   - Lisa 状态进入 `working` 或 `blocked`；
   - 插件随后才写 `accepted` 和输出 `handed_off`；
   - generation、turn、receipt 和插件游标一致；
10. 再完成一次 Lisa -> Ralph 回交；
11. 停止协调器和命名 Server，确认无重复投递；
12. 清理临时环境前先提交脱敏验收记录。

若真实测试仍出现 `agent_prompt_stalled`：

- 结论应为“插件成功阻止假交接”；
- 保留只读证据，不重发；
- 用最小独立 Herdr/Codex 复现判断是否需要上报 Herdr；
- 不把该结果写成双 Agent 交接通过。

## 9. 分支、提交与回滚

开发分支固定为 `fix/herdr-delivery-ack`，不在发布标签或主分支直接修改。

计划提交切片：

1. `docs: define confirmed Herdr prompt delivery plan`
2. `test: reproduce unobserved Herdr prompt delivery`
3. `fix: require observed agent activity before handoff`
4. `test: cover prompt delivery confirmation failures`
5. `docs: record real Herdr delivery acceptance`

每个切片本地通过对应测试后提交并推送。最终通过 CI 和真实验收后再创建 PR；未经审阅不直接合并主分支，也不立即发布 npm 或插件标签。

回滚时可以按上述提交边界逐项回退。若新等待策略在真实环境产生不可接受的误阻断，优先回滚业务代码提交，保留测试、现场证据和实施文档，不能恢复“API 返回 ok 即视为真实交接”的旧判定。

## 10. 完成标准

本修复只有同时满足以下条件才算完成：

- 旧实现可复现的假成功已被自动测试覆盖；
- 所有投递入口使用同一真实活动确认；
- 未确认投递不推进游标且不自动重放；
- 本地插件与 CLI 全量测试通过；
- GitHub CI 全部通过；
- 新隔离真实 Herdr 会话完成 Ralph -> Lisa -> Ralph 双向交接；
- Lisa Pane 的实际显示和 Agent 活动与插件 `accepted/handed_off` 一致；
- 脱敏验收文档、提交 SHA 和剩余风险均已记录。

