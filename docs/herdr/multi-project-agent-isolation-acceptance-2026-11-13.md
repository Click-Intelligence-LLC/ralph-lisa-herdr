# Herdr 多项目 Agent 隔离真实验收（2026-11-13）

## 1. 结论

在同一个隔离的 Herdr Server 中，两个不同项目同时保留各自的 Ralph/Claude 与 Lisa/Codex，共四个唯一 Agent target。两个项目均完成了至少一次 Ralph→Lisa→Ralph 双向自动交接，未观察到跨项目提示、候选、回执、generation 或恢复接管。

多项目隔离目标通过。本次验收同时发现并修复了两个只在真实恢复链路出现的问题：重绑预检错误回退到旧固定 Agent 名，以及 Host 快照子进程已经输出 JSON 但超时未退出时被误判为活动快照不一致。修复后，项目 A 在不影响项目 B 的情况下完成显式租约回收、重绑、非零游标接续和有界运行观察。

这不是干净虚拟机或发布后公共版本验收，也不证明长期无人值守稳定性。项目 A 的旧租约候选在暂停后才落盘，恢复时被安全保留为过期候选，没有自动提交；因此本记录不把项目 A 的业务任务本身标为完成。

## 2. 验收范围与隔离边界

| 项目 | 实际值 |
|---|---|
| 仓库 | `Click-Intelligence-LLC/ralph-lisa-herdr` |
| 分支 | `feat/herdr-multi-project-seats` |
| 初始验收提交 | `8037ae8` |
| 重绑 target 修复 | `bce1047` |
| Host 超时重试修复 | `1f13228` |
| 隔离根目录 | `/private/tmp/rmp-R7vJWG` |
| 命名 Server | `rll-mp-r7vjwg` |
| 项目 A | `/private/tmp/rmp-R7vJWG/project-a` |
| 项目 B | `/private/tmp/rmp-R7vJWG/project-b` |

验收使用独立 `XDG_CONFIG_HOME`、`XDG_STATE_HOME`、`XDG_CACHE_HOME`、显式 `HERDR_CONFIG_PATH` 和命名 Server。插件从公司 GitHub 仓库固定提交安装；真实任务和 Agent 均未使用默认 Herdr Server，`super-rll` 未操作。清理阶段发生过一次默认插件注册误卸载，已按清理前记录的同一来源和固定提交原样恢复，详见第 9 节。

## 3. 席位与绑定证据

同一个 Server 中实际存在四个唯一 target：

| 项目 | RLL 角色 | Herdr Agent target |
|---|---|---|
| A | Ralph | `ralph_77a1662df9464430` |
| A | Lisa | `lisa_77a1662df9464430` |
| B | Ralph | `ralph_c5c44987eb9d44bb` |
| B | Lisa | `lisa_c5c44987eb9d44bb` |

每个项目的 Host Binding、插件启动记录和投递链均保存本项目 target。项目 B 在项目 A 两个 Agent Pane 仍存在时正常启动，没有出现旧版的 `AGENT_IDENTITY_MISMATCH`。

## 4. 双项目交接结果

1. 项目 A 完成 Ralph→Lisa 和 Lisa→Ralph，generation 从 0 前进到 2。
2. 项目 B 完成 Ralph→Lisa 和 Lisa→Ralph，generation 从 0 前进到 2。
3. 项目 A 继续推进时，项目 B 的 generation 和投递记录保持不变。
4. 项目 B 后续完成至 generation 6，Host 正常释放为 `unclaimed`；生成的 `README.md` 为精确的 19 字节正文 `Project B isolated.`。
5. 未观察到 A 的提示进入 B Pane、B 的候选被 A 提交，或任一项目使用另一项目的 target。

候选自动提交继续明确记录 `source_verification=unverified`。本次只验证会话授权的自动轮次和隔离，不把 Herdr 的 Agent 观察当作候选作者身份密码学证明。

## 5. 项目 A 恢复与接续

### 5.1 暂停后的边界

项目 A 在 Lisa 工作期间暂停。旧协调器停止后，一份候选在旧租约上下文中才被登记。恢复链没有把这份候选自动转换为新租约的可提交候选，也没有重放交接提示。最终 A 保持 generation 3、candidate count 4，`README.md` 未生成。

这是预期的失败关闭行为：恢复保证不重复提交和不跨租约猜测，不保证自动接纳暂停窗口内的迟到候选。

### 5.2 真实问题一：重绑预检丢失动态 target

首次真实重绑时，`rebind-check` 内部调用 `seat-preflight` 没有带入持久化的会话级 target，因而回退查询旧名称 `ralph`/`lisa` 并返回 `AGENT_MISSING`。

提交 `bce1047` 修复为：从恢复计划读取两席 target，通过受限环境传给预检，重绑和接续继续以 Binding target 为准。插件全量测试 64/64 通过，远端 Node 18/20/22 CI 通过。

### 5.3 真实问题二：已输出快照的子进程超时

第一次非零游标接续后，Host snapshot 子进程打印了有效 JSON，但未在 10 秒内退出；`spawnSync` 返回 `ETIMEDOUT`。旧逻辑把这类结果归入 `ACTIVE_SNAPSHOT_MISMATCH`，协调器退出。

提交 `1f13228` 将 `ETIMEDOUT` 与 `HOST_BUSY` 一样视为可重试的只读 Host 结果：本轮不接受可能不完整的输出、不推进游标，下一个轮询周期重新读取。其他错误仍失败关闭。插件聚焦测试 32/32、全量测试 65/65 通过，远端 Node 18/20/22 CI 全部通过。

### 5.4 修复后复验

修复后仅对项目 A 执行第二次显式恢复：

- 旧协调器和旧 Agent 进程已退出后，按证据回收旧租约；
- Claude 原生会话直接恢复；Codex 在同一原生会话引用重新出现后才进入重绑；
- `rebind-check` 使用 A 的动态 target，通过后建立替代租约并保持 `rebound_paused`；
- `continuation-check` 通过后，从 generation 3 接续，未重放历史提示；
- 12 秒有界观察中，A 心跳序号从 19 前进到 22，协调器保持 active；
- 同期 B 保持 `unclaimed`、generation 6，未新增提示或回执。

随后通过插件停止 A；A Host 为 `unclaimed`、Binding 为 `stale`、generation 3。B 仍为 `unclaimed`、generation 6。

## 6. 自动化验证

| 验证层 | 结果 |
|---|---|
| CLI 聚焦测试 | 失败启动安全接续 11/11 通过 |
| CLI 全量测试 | 524/524 通过 |
| 插件全量测试 | 最终 65/65 通过 |
| npm 内容检查 | 96 个发布文件通过 |
| GitHub CI | 运行时代码 `1f13228` 与分支头 `faab748` 的 Node 18/20/22 均全部通过；最终验收运行 `43354005553` |
| 真实 Herdr | 同 Server 四 target、双项目双向交接、单项目恢复隔离通过 |
| 待发布运行时提交安装 | `24c194f7bd6ec858b96cb7a7c6e591ce4657e97a` 安装成功；插件 `0.1.9`；doctor `ready`；同仓 CLI `0.3.15` |
| CLI 本地 tarball 隔离安装 | `ralph-lisa-loop-0.3.15.tgz` 安装到全新 prefix；`ralph-lisa --version` 与 `herdr-rll --help` 通过 |

CLI 本地 tarball 的 SHA-256 为 `9a5e6ba404051048e0700a3ff9470e0a8d55e1531934f756833b37173b36c278`，npm integrity 为 `sha512-BoupYy/P2XOW3ZRC6mWGF2UUUkWzb4A6CDA6GNWUEXEsCRP7enN3VC720Kba1SEAyIGEktrdJJkm0PTbcqqVBg==`。该 tarball 是发布前本地构建物，不是 npm 公共仓库回包。

## 7. 已通过与未证明

已通过：

- 新会话使用会话级唯一 Agent target；
- 启动、候选、任务更新、提示投递和恢复按 Binding target 路由；
- 同 Server 两个项目可同时保留四个 Agent；
- 两个项目各自完成至少一次双向交接；
- 恢复项目 A 时项目 B 状态不变；
- 旧租约迟到候选不会被新租约自动提交；
- 旧固定 target 记录的兼容回归通过。

仍未证明：

- 干净 macOS 虚拟机的首次安装体验；
- 长时间、多于两个项目的压力与稳定性；
- 插件 `0.1.9` 和 npm `0.3.15` 发布后的公共来源冒烟；
- 暂停窗口内迟到候选的产品化恢复交互；
- 候选文本的独立作者身份验证。

## 8. 发布判断

代码、真实验收、版本号一致性、待发布运行时提交的 GitHub 固定提交安装、CLI 本地 tarball 隔离 prefix 安装和分支头 Node 18/20/22 CI 均已完成。本记录之后只允许追加验收文档；若再修改运行时代码或版本元数据，必须重新安装复验。发布前仍需 PR 审阅和合并。发布动作本身仍需维护者创建 tag、发布 npm，并在发布后从公共来源重新执行冒烟测试。

## 9. 清理与默认环境恢复

两个命名测试 Server `rll-mp-r7vjwg`、`rmpf-kl32ns` 均已停止，未发现指向测试目录或命名 Server 的残留进程。临时目录 `/private/tmp/rmp-R7vJWG` 和 `/private/tmp/rmpf.Kl32ns` 已永久删除。

预发布安装环境停机后执行 `plugin uninstall` 时，Herdr CLI 实际连接了默认注册表，短暂移除了默认 `ralph-lisa.loop`。发现后没有启动默认任务或升级默认版本，而是按清理前只读记录恢复：

- 来源：`yueweilu/Ralph-Lisa-Loop/integrations/herdr`
- requested/ref 与 resolved commit：`fa8e8bb0383ab990efbbabb442deea18d570bee2`
- 插件版本：`0.1.8`
- enabled：`true`

恢复后 `herdr plugin list --json` 与上述来源、提交和版本一致。默认 Server 未因本次清理停止或重启。该事件也说明：仅设置 XDG 目录不足以保证停机后的插件管理命令仍连接预期注册表；隔离操作必须同时使用显式 `HERDR_CONFIG_PATH`、命名 Server，并在卸载前核对命令实际连接目标。
