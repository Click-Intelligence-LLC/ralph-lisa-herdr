# Herdr Agent 提示真实投递确认验收记录

日期：2026-11-17  
分支：`fix/herdr-delivery-ack`  
结论：本次有界真实验收通过；插件不再仅凭普通 `agent_prompted` 回包认定交接成功。

## 验收范围

本次验证当前修复分支的以下能力：

- 初始 Ralph 提示必须产生可观察 Agent 活动；
- Ralph -> Lisa 和 Lisa -> Ralph 的回执驱动交接必须实际进入目标 Pane；
- 每份正式回执最多产生一份投递记录；
- 完成共识后协调器释放租约，不再发送多余交接；
- `FINAL.txt` 满足一次性任务的精确内容要求。

本次不验证 Server 重启接续、长期运行、Herdr 0.9.5、其他 Agent 版本或不受控网络故障。

## 隔离环境

- 临时根：`/private/tmp/hdack.cu1ozy`
- 项目：`/private/tmp/hdack.cu1ozy/project`
- 命名 Herdr Server：`hdack-cu1ozy`
- Herdr：0.9.4
- CLI：0.3.16，由当前仓库 checkout 构建
- 插件：0.1.9，本地链接当前修复分支
- XDG config/state/cache：全部位于上述临时根

隔离 doctor 返回 `ready`，确认 Herdr、RLL host contract、Claude/Codex 集成及两席登录状态可用。默认 Herdr 会话和其他项目未参与本次测试。

首次启动前，当前执行 Shell 继承了外部 Herdr Pane 的 `HERDR_ENV`、Workspace、Pane 和 socket 环境。启动器因此尝试在隔离 Server 查询外部 Workspace，返回 `HERDR_COMMAND_FAILED`。当时项目尚未初始化，没有 launch intent、租约、Agent 或投递记录。清除这些继承变量并显式指定命名 Server 后，正式验收启动成功。该环境隔离问题没有通过重复使用半启动请求掩盖。

## 人工提示边界

- 用户只授权信任 `/private/tmp/hdack.cu1ozy/project`；仅在该 Ralph/Claude Pane 确认目录信任。
- Lisa/Codex 显示 0.167.2 -> 0.169.0 更新提示；用户单独允许选择 `2. Skip`。本次没有更新 Codex。
- 之后没有人工重发业务提示、手工提交候选或修改 RLL 轮次。

## 真实运行结果

任务要求项目根目录的 `FINAL.txt` 内容必须且只能是：

```text
Confirmed Herdr delivery acceptance.
```

文件最终为 36 字节，无尾随换行；`printf 'Confirmed Herdr delivery acceptance.' | cmp - FINAL.txt` 返回 exit code 0。策略检查最终返回 `Ready to proceed`。

协调器从 generation 0 自动运行至 generation 8。generation 1 至 7 都需要向下一席发送正式交接，并各自只有一份 `accepted` 投递：

| Generation | 目标角色 | 现场结果 |
|---:|---|---|
| 1 | Lisa | Lisa Pane 显示 Ralph 回执交接，进入 working 并提交计划评审 |
| 2 | Ralph | Ralph Pane 显示 Lisa 回执交接，进入 working 并创建交付文件 |
| 3 | Lisa | Lisa Pane 收到实现评审交接并工作 |
| 4 | Ralph | Ralph Pane 收到修改意见并补齐测试证据 |
| 5 | Lisa | Lisa Pane 收到修订交接并再次评审 |
| 6 | Ralph | Ralph Pane 收到通过结果并提交共识 |
| 7 | Lisa | Lisa Pane 收到 Ralph 共识并提交正式共识 |

第 8 份正式回执来自 Lisa，满足完成策略。协调器没有再向 Ralph 发送无意义的最终交接，而是归档 `finished-*` 记录并释放宿主租约。

最终状态：

- `status=completed`
- `host_state=unclaimed`
- `binding_state=stale`
- `generation=8`
- `phase=completed`
- `error=null`
- `delivery_diagnostic=null`
- 初始投递为 `accepted`
- 七份交接投递全部为 `accepted`
- 正式回执共八份

## 自动测试证据

- 插件 Node 测试：67/67 通过；
- CLI 测试：531/531 通过；
- npm 发布文件校验：`verified ralph-lisa-loop@0.3.16: 98 release files`；
- 回归场景明确覆盖 `agent_prompt_stalled`、timeout、错误 Pane、暂停、Server 重启、非零游标重绑及任务更新路径；
- `agent_prompt_stalled` 和 timeout 均保留一份 `intent`，进入 `needs_reconcile`，不输出 `handed_off`，不自动重发。

CLI 全量测试输出中有一条 tmux 创建命令因当前沙箱权限返回 `Operation not permitted`，该错误属于测试中预期捕获的子进程场景；测试汇总仍为 531/531 通过。首次包校验因沙箱不允许写用户 npm cache 而失败，改用独立 `/private/tmp` npm cache 后通过，没有修改全局 npm 权限或缓存。

## 结论边界

本次证明在真实 Herdr 0.9.4、Claude 和 Codex 的这个隔离会话中：

1. 普通 API 排队成功不再直接推进插件游标；
2. 只有 Herdr 观察到目标 Agent 活动并通过后置席位核对，投递才成为 `accepted`；
3. Lisa 和 Ralph 的 Pane 都实际收到了与正式回执对应的交接；
4. 完成路径没有重复投递。

它不能证明旧失败的最底层原因一定属于 Herdr 或 Codex，也不能替代其他 Herdr 版本、系统和长期运行测试。若后续再次出现 `PROMPT_DELIVERY_UNCONFIRMED`，应保留 intent、`delivery_diagnostic`、目标 Pane 和只读宿主快照，先归因再决定是否向 Herdr 上游提交最小复现；不得自动重发。
