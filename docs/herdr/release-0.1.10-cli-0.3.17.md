# Herdr 插件 0.1.10 / CLI 0.3.17 发布清单

日期：2026-11-17  
发布分支：`release/herdr-v0.1.10-cli-v0.3.17`  
基线：`main` 合并提交 `04b67e40c5b178167df62daacd4aa570308322a6`  
状态：发布候选本地验证通过；尚未创建标签、发布 npm 或完成公共来源验收。

## 1. 发布目的

本次补丁发布把 Herdr 提示投递确认修复交付给公开用户。旧插件 0.1.9
只要收到普通 `agent_prompted` 回包就可能推进本地游标；0.1.10 改为等待目标
Agent 进入 `working` 或 `blocked`，核对 Agent、Workspace、Pane 和项目目录，
再执行一次席位检查，全部通过后才把投递写为 `accepted`。

投递无法确认时，协调器保留一份 `intent`，返回
`PROMPT_DELIVERY_UNCONFIRMED` 并进入 `needs_reconcile`。它不会推进 generation，
也不会自动重发不确定的提示。

## 2. 固定版本映射

| 组件 | 当前公开版 | 本次候选版 | 固定关系 |
|---|---:|---:|---|
| Herdr 插件 | 0.1.9 | 0.1.10 | Git 标签 `v0.1.10` |
| npm CLI | 0.3.16 | 0.3.17 | npm 标签 `latest`，Git 标签 `cli-v0.3.17` |
| `herdr-rll setup` | 安装 `v0.1.9` | 安装 `v0.1.10` | 公司仓固定来源，不接受任意仓库 |

两个 Git 标签必须指向同一个最终 `main` 提交。npm 0.3.17 必须从该提交的
`cli/` 目录发布，不能从发布分支的中间提交发布。

## 3. 已完成的代码与文档更新

- `integrations/herdr/herdr-plugin.toml`：插件版本改为 0.1.10；
- `cli/package.json` 与 lockfile：CLI 版本改为 0.3.17；
- `cli/src/herdr/setup.ts`：固定插件 ref 改为 `v0.1.10`，最低接受版本改为
  0.1.10；
- 安装器测试：验证准确执行 `plugin install ... --ref v0.1.10 --yes`；
- README 和安装说明：公开命令同步为 0.3.17 / v0.1.10；
- 历史验收文档保持原版本号，不回写过去证据。

## 4. 发布前验证结果

在发布分支本地执行：

```bash
npm ci --prefix cli --ignore-scripts --no-audit --no-fund
npm run build --prefix cli
node --test cli/dist/test/herdr-setup.test.js
npm test --prefix cli
node --test integrations/herdr/*.test.mjs
env npm_config_cache=/private/tmp/rll-release-0317-npm-cache \
  node cli/scripts/verify-package.mjs
```

结果：

- 安装器专项测试：5/5 通过；
- CLI 全量测试：531/531 通过；
- Herdr 插件测试：67/67 通过；
- npm 发布内容校验：`verified ralph-lisa-loop@0.3.17: 98 release files`；
- `git diff --check` 通过。

修复代码在版本提升前已经使用真实 Herdr 0.9.4、Claude 与 Codex 完成一次
隔离验收：generation 0 至 8 自动运行，七次正式交接均实际进入目标 Pane，
最终共识完成且没有多余交接。该结果证明修复提交的真实行为，不等于尚未
发布的 0.1.10 / 0.3.17 已通过公共来源安装验收。

## 5. 合并和标签步骤

1. 推送发布分支并创建指向 `main` 的发布 PR；
2. 等待 Node 18、20、22 三组 GitHub Actions 全部成功；
3. 核对 PR 无冲突、版本映射和安装命令没有旧引用；
4. 合并发布 PR；
5. 拉取最新 `main` 并记录最终完整提交 SHA；
6. 在同一提交创建带说明标签：

```bash
git tag -a v0.1.10 -m "Herdr plugin v0.1.10"
git tag -a cli-v0.3.17 -m "Ralph-Lisa Loop CLI v0.3.17"
git push origin v0.1.10 cli-v0.3.17
```

标签创建前必须确认远端不存在同名标签。已发布标签不得移动或覆盖。

## 6. npm 维护者发布步骤

npm 维护者应在最终标签提交的 `cli/` 目录执行：

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run build
node scripts/verify-package.mjs
npm publish
```

发布后回传并核对：

- `npm view ralph-lisa-loop version` 为 0.3.17；
- `npm view ralph-lisa-loop dist-tags --json` 的 `latest` 为 0.3.17；
- tarball URL、SHA-512 integrity、shasum；
- npm 发布来源对应 `cli-v0.3.17` 的最终提交；
- npm 账户或令牌只由有权限的维护者使用，不写入仓库或验收文档。

## 7. 发布后公共来源验收

使用新的临时 npm prefix、XDG config/state/cache、命名 Herdr Server 和空项目，
不得复用本地 link 或开发 checkout 的插件注册。

验收顺序：

1. 从 npm registry 安装 `ralph-lisa-loop@0.3.17`；
2. 确认 `ralph-lisa --version` 返回 0.3.17，`herdr-rll --help` 正常；
3. 执行 `herdr-rll setup`；
4. 确认注册来源为公司 GitHub 仓、`requested_ref=v0.1.10`、
   `version=0.1.10`，且 checkout HEAD 与远端标签解析提交一致；
5. 确认插件 doctor 为 `ready`；
6. 在空项目执行一个短的 `herdr-rll --full-auto` 任务；
7. 现场确认 Ralph 和 Lisa 至少各收到一次正式交接，最终状态完成；
8. 核对投递记录数量与 generation 一致，不存在仅 enqueue 成功就推进的记录；
9. 停止命名 Server 并清理隔离目录，不操作默认 Herdr 会话。

Claude 对新临时目录的信任、Agent 登录、更新选择或外部 API 余额仍属于人工或
外部前置条件。验收中必须分别记录，不能把人工处理写成插件自动能力。

## 8. 失败与回退原则

- 标签或 npm 发布前发现问题：停止发布，修复后重新走 PR 和 CI；
- `v0.1.10` 标签已推送但 npm 未发布：不要移动标签，评估创建 0.1.11 / 0.3.18；
- npm 0.3.17 已发布后发现阻断问题：不能覆盖 npm 版本，发布新的补丁版本；
- 公共验收出现不确定投递：保留 `intent`、`delivery_diagnostic`、目标 Pane 和
  只读宿主快照，禁止盲目重发；
- 0.1.9 / 0.3.16 保持可追溯，不删除旧标签或改写其历史。

## 9. 发布完成判定

只有下列条件全部满足，才能宣布 0.1.10 / 0.3.17 已发布并可供公众使用：

- 发布 PR 已合并且 GitHub CI 全部通过；
- 两个固定标签存在并指向同一最终提交；
- npm `latest=0.3.17`，tarball 与 integrity 可核验；
- `herdr-rll setup` 从公共 npm 包安装到公共 `v0.1.10`；
- 独立隔离的真实双 Agent 公共来源验收完成；
- 验收记录已提交并推送。
