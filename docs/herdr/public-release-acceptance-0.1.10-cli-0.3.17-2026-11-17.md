# Herdr 插件 0.1.10 / CLI 0.3.17 公共来源验收

日期：2026-11-17  
结论：通过。本次从公共 npm registry 和公司 GitHub 固定标签安装后，完成了一次
真实 Ralph/Claude 与 Lisa/Codex 全自动双向交接及共识闭环。

## 1. 验收对象

| 项目 | 验收值 |
|---|---|
| npm 包 | `ralph-lisa-loop@0.3.17` |
| npm dist-tag | `latest=0.3.17` |
| npm tarball | `https://registry.npmjs.org/ralph-lisa-loop/-/ralph-lisa-loop-0.3.17.tgz` |
| npm SHA-1 | `7e81d705483bcbcf91cc748cbb55acd28e1eb556` |
| npm SHA-512 integrity | `sha512-blJhYY3xPK5X4QUpQFP4iSBlpLHWbqThY0/OP7OV5zUQbx9dJ9MVY2FvNnGLhp8nDP8wci5YkgbSPc4dQ82SdQ==` |
| npm 文件数 | 98 |
| Herdr 插件 | `ralph-lisa.loop` 0.1.10 |
| GitHub ref | `v0.1.10` |
| 解析提交 | `8899526dd3498d927befa6b7b5239b0014ca0ae1` |
| Herdr | 0.9.4 |

npm registry 返回的版本、tarball、integrity、shasum 和文件数与发布者回执完全
一致。独立下载 tarball 后重新计算 SHA-1 和 SHA-512，结果相同。

## 2. 隔离边界

- 临时根：`/private/tmp/r317.eSswSi`；
- npm prefix：`/private/tmp/r317.eSswSi/npm`；
- npm cache：`/private/tmp/r317.eSswSi/npm-cache`；
- XDG config/state/cache：全部位于临时根；
- 项目：`/private/tmp/r317.eSswSi/project`；
- 命名 Herdr Server：`r317-eswsi`。

没有使用本地开发插件 link、开发 checkout 中的命令或默认 Herdr Server 执行安装、
启动和双 Agent 任务。隔离目录在验收后保留用于复核；命名 Server 已正常停止。

首次空插件列表检查遗漏清除当前终端继承的 `HERDR_SOCKET_PATH`，该只读命令因此
查询到了默认 Server 的本地 link。它没有安装、更新、卸载或修改默认插件。清除
`HERDR_SOCKET_PATH` 后重新检查，同一隔离 XDG 环境插件列表为空；后续所有安装和
运行命令都显式清除该变量并指定命名 Server。首次只读误查询不计作隔离安装证据。

## 3. 公共 npm 安装

使用公共 registry 和隔离 prefix 安装：

```bash
npm install -g --prefix /private/tmp/r317.eSswSi/npm \
  ralph-lisa-loop@0.3.17 --ignore-scripts --no-audit --no-fund
```

结果：

- 安装命令 exit code 0；
- `ralph-lisa --version` 返回 `ralph-lisa-loop v0.3.17`；
- `herdr-rll --help` 正常，包含 `setup`、任务启动和 `status`；
- 没有调用当前仓库的 `cli/dist` 作为启动入口。

## 4. `herdr-rll setup` 公共插件安装

隔离插件列表为空后，从公共 npm 包执行 `herdr-rll setup`。返回：

- `status=ready`；
- `herdr_version=0.9.4`；
- 插件 id `ralph-lisa.loop`；
- 插件版本 0.1.10；
- `requested_ref=v0.1.10`；
- `resolved_commit=8899526dd3498d927befa6b7b5239b0014ca0ae1`；
- 插件已启用；
- RLL CLI 0.3.17 与 host contract 通过；
- Claude/Codex 集成存在且两席均已登录。

Herdr 托管 checkout 的 `git rev-parse HEAD` 同样返回 `8899526...`。插件列表确认
source kind 为 `github`，owner/repo 为
`Click-Intelligence-LLC/ralph-lisa-herdr`，subdir 为 `integrations/herdr`；不是
local link。

## 5. 真实双 Agent 任务

任务要求项目根目录创建 `PUBLIC-ACCEPTANCE.txt`，文件内容必须且只能是：

```text
Public Herdr 0.1.10 delivery verified.
```

启动方式来自公共 npm prefix：

```bash
herdr-rll --full-auto "在当前目录创建 PUBLIC-ACCEPTANCE.txt，内容必须且只能是 Public Herdr 0.1.10 delivery verified.，运行精确内容校验，并完成 Ralph-Lisa 评审共识。"
```

启动请求：`d22db96e-03c4-461b-a73e-79bc993f7bf6`。RLL session：
`16dee6ec-4d2d-40eb-9d74-1e2d25384dab`。Workspace 为 `w1`。

### 5.1 目录信任与同请求重试

Ralph/Claude 首次启动停在新临时目录信任提示。只有在用户明确授权
`/private/tmp/r317.eSswSi/project` 后，才在该 Pane 选择信任。

等待人工确认期间，首次协调器达到 `AGENT_READY_TIMEOUT`，状态保持：

- host `unclaimed`；
- binding `unbound`；
- generation 为 null；
- Lisa 尚未启动；
- 没有初始任务投递。

信任后 Ralph 已就绪并取得原生会话。再次执行同一公开启动命令时，CLI 使用已有
request/session/Workspace 进入严格 preclaim retry：请求 ID 与 session ID 均未变化，
没有创建第二个 RLL 任务，也没有重复初始提示。重试返回 `status=started`。

### 5.2 自动轮次结果

两席最终都有有效原生会话，并在同一项目中交替进入 `working`：

| Generation | 正式提交角色 | 下一步结果 |
|---:|---|---|
| 0 -> 1 | Ralph | Lisa 实际进入 `working` |
| 1 -> 2 | Lisa | Ralph 实际进入 `working` |
| 2 -> 3 | Ralph | Lisa 实际进入 `working` |
| 3 -> 4 | Lisa | Ralph 实际进入 `working` |
| 4 -> 5 | Ralph | Lisa 实际进入 `working` |
| 5 -> 6 | Lisa | 满足完成策略，直接归档完成 |

持久证据为：

- 初始 Ralph 投递 1 份，状态 `accepted`；
- generation 1 至 5 各有且只有 1 份投递记录，全部 `accepted`；
- 6 份正式回执连续推进 generation 0 至 6；
- 每份回执 `source_confirmation=session_authorized_auto`；
- 每份回执如实记录 `source_verification=unverified`；
- 第 6 份 Lisa 回执触发完成，没有向 Ralph 发送多余的 generation 6 交接；
- 没有人工重发业务提示或手工提交候选。

最终 `herdr-rll status`：

- `status=completed`；
- `launch_result=started`；
- `host_state=unclaimed`；
- `binding_state=stale`；
- `generation=6`；
- `turn=ralph`。

完成归档记录为 `phase=completed`、`initial_status=accepted`、
`cursor_generation=6`、`auto_commit=true`，没有 `delivery_diagnostic`。

## 6. 交付文件验证

结果文件大小为 38 字节，SHA-256 为：

```text
e9020ce4cceff880555e0d7f9f74f4cdc000e03049053006171321d386bb1c59
```

以下精确比较返回 exit code 0，因此文件没有额外标题、空格或尾随换行：

```bash
printf 'Public Herdr 0.1.10 delivery verified.' | \
  cmp - /private/tmp/r317.eSswSi/project/PUBLIC-ACCEPTANCE.txt
```

## 7. 清理与边界

- 命名 Server `r317-eswsi` 已通过 Herdr API 正常停止；
- 停止后 `status server` 返回 `not running`；
- 默认 Herdr Server、默认插件注册和其他项目未被修改；
- 临时隔离根暂时保留，便于复核本验收记录；
- 本次没有验证其他操作系统、Herdr 0.9.5、长期运行或 Server 重启接续；
- 本次证明 0.3.17 + 0.1.10 的公共来源安装和这一真实会话闭环，不代表所有外部
  Agent 服务、网络和模型版本永远可用。

## 8. 最终判定

本次满足发布清单的公共来源完成条件：

1. npm 0.3.17 的公开元数据与包摘要可复核；
2. `herdr-rll setup` 从公共 GitHub 标签安装了 0.1.10；
3. npm CLI、插件 tag 和托管 checkout 对应同一发布提交；
4. Ralph 和 Lisa 都实际收到交接并工作；
5. 投递数量与 generation 连续一致，没有 enqueue 假成功或重复交接；
6. 任务文件精确正确，最终状态完成且租约释放。

因此 Herdr 插件 0.1.10 / CLI 0.3.17 可以标记为公共发布验收通过。
