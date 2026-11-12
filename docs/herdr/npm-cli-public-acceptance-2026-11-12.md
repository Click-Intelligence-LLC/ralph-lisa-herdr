# npm 0.3.14 与公司 Herdr 插件：发布后验收（2026-11-12）

## 固定来源与隔离

- npm 公共仓库：`ralph-lisa-loop@0.3.14`，`latest=0.3.14`，`bin` 包含 `ralph-lisa` 与 `herdr-rll`；包的 `repository` 指向 `Click-Intelligence-LLC/ralph-lisa-herdr/cli`。
- 公共 tarball：`https://registry.npmjs.org/ralph-lisa-loop/-/ralph-lisa-loop-0.3.14.tgz`；下载文件计算的 SHA-512 integrity 与 npm 元数据一致：`sha512-u+n71CDfHEg/bUoHk2Bi/YqX3fcZ4LxtT0xP1BvXpmBFNAow26ozRnhEq9cHV6VyIKT06CYtchSi7MBpw2kR4A==`。
- 插件从公司 GitHub 固定标签 `cli-v0.3.14` 安装，解析到 `c2a170f50dd579fc45c7509aae41ad122080434a`；插件 id `ralph-lisa.loop`、版本 `0.1.8`。公司 `main` 的 [Node 18/20/22 CI](https://github.com/Click-Intelligence-LLC/ralph-lisa-herdr/actions/runs/42997570656) 全部通过。
- 本次使用 `/private/tmp/hpub-Clp7tn` 下独立 npm prefix、XDG config/state/cache、新项目和命名 Herdr Server `rllpubclp7`。未修改默认插件注册、默认 Herdr 会话或 `super-rll`。

## 已观察到的结果

| 层次 | 证据与结果 |
|---|---|
| 公共 npm 安装 | 从公共 npm 安装到隔离 prefix，`ralph-lisa --version` 返回 `0.3.14`，`herdr-rll --help` 正常。不是从本地 checkout 或预构建 tarball 安装。 |
| 公司 GitHub 插件 | 安装与三条构建命令退出 0；隔离插件列表只有公司来源的 `ralph-lisa.loop`，`resolved_commit` 与标签一致。真实插件 doctor 动作退出 0、`status=ready`：Herdr 0.9.4、同仓 CLI 0.3.14、host contract、Claude/Codex 集成及登录检查通过。 |
| 启动与阻断处理 | npm 安装的 `herdr-rll --full-auto --project <隔离项目> <任务>` 创建一个 RLL 会话。Claude 首次目录信任与 Codex 0.167.0 的更新选择页分别阻断启动；用户仅对本次临时目录授权信任，并授权跳过 Codex 更新。旧协调器超时退出，宿主仍 `unclaimed`、游标空。确认原进程已退出、两席就绪且项目未投递后，以同一个启动请求重开协调器。结果 `started`、generation 0、初始提示一份 `accepted`；未重新创建任务。 |
| 双席自动轮次 | Ralph 的首轮 `[PLAN]` 自动提交到 generation 1，单次交给 Lisa；Lisa 的 `[PASS]` 自动提交到 generation 2，单次交回 Ralph；Ralph 的 `[CODE]` 自动提交到 generation 3，单次交给 Lisa；Lisa 对成品的 `[PASS]` 自动提交到 generation 4，单次交回 Ralph。余额恢复后，Ralph 的 `[CONSENSUS]` 自动提交到 generation 5 并交给 Lisa；Lisa 的 `[CONSENSUS]` 自动提交到 generation 6。六份正式回执均为 `source_confirmation=session_authorized_auto`、`source_verification=unverified`。初始提示及 generation 1–5 的五份交接投递各有一份 `accepted`；generation 6 没有再次交接。 |
| 自动完成 | `herdr-rll status` 返回 `completed`；插件完成归档为 `phase=completed`、游标 6。RLL 宿主快照为 `host_state=unclaimed`、`binding_state=stale`、generation 6、候选数 6。协调器 Pane 已关闭。 |
| 交付文件 | 临时项目 `README.md` 的独立读回恰为 `Public npm Herdr acceptance passed.\n`，36 字节、一行，SHA-256 `ea045ad1b2c94f906d54ced0ba358ec4f39273bb0e5e0125f1c8c2944a4c378a`。Lisa 在第二轮和最终共识评审中也独立核查该文件。 |

## 验收边界与人工介入

- Ralph 在首轮计划候选之前遇到一次模型连接中断。本次在确认 `generation=0`、候选数 0 后，测试控制端向同一 Ralph Pane 补发了一次“续做当前轮次”提示。
- Ralph 在 generation 4 准备最终 `[CONSENSUS]` 候选时收到 DeepSeek API `402 Insufficient Balance`。用户确认余额恢复后，测试控制端再次只对同一 Ralph Pane 提示续做；恢复前后游标保持 4、候选数保持 4，没有另起同项目任务，也没有代 Ralph 提交候选。最终完成因而是**同一会话的真实接续完成**，不是完全无人值守完成。
- 第二轮 `[CODE]` 回执的策略结果为 `warn`（`test-results`、`file-line-ref`），不是 `pass`；当前策略允许该警告下自动提交。测试门禁为 `not_enabled`。本次对 README 的独立检查只证明文件内容，不等同于启用了自动测试门禁。

候选来源始终由协议标为 `unverified`；本记录不声称 Herdr 独立证明了作者身份。

## 收尾

完成后只对本次隔离环境卸载插件，插件列表返回空；命名 Server 正常停止，`status server --json` 返回 `running=false`。测试项目和临时根目录保留用于本机复核。默认 Herdr 会话与 `super-rll` 未操作；没有做默认环境的前后文件差异审计。
