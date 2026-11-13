# Herdr 插件 0.1.9 与 CLI 0.3.15 发布准备

## 1. 当前结论

发布候选已经具备创建固定标签和交给 npm 维护者发布的条件，但本文件提交时仍处于**发布准备**状态：尚未创建 `v0.1.9` 或 `cli-v0.3.15` 标签，尚未发布 npm `ralph-lisa-loop@0.3.15`，也尚未执行发布后公共来源冒烟测试。

插件和全局 CLI 是同一产品的两个入口，但分发方式不同：

- Herdr 插件从公开 GitHub 仓库的 `integrations/herdr` 安装；
- 全局 `herdr-rll` 和原有 `ralph-lisa` 命令由 npm 包 `ralph-lisa-loop` 提供。

二者必须分别发布、分别安装验证，不能用其中一个成功推断另一个已经可用。

## 2. 发布候选

| 项目 | 值 |
|---|---|
| 仓库 | `Click-Intelligence-LLC/ralph-lisa-herdr` |
| 默认分支 | `main` |
| 已验证运行时基线 | `4cce15e9acffbc8346c790e0a650885dbf8a10c6` |
| 插件 ID / 版本 | `ralph-lisa.loop` / `0.1.9` |
| CLI 包 / 版本 | `ralph-lisa-loop` / `0.3.15` |
| Herdr 最低版本 | `0.9.4` |
| Node.js 范围 | `>=18` |
| 计划插件标签 | `v0.1.9` |
| 计划 CLI 标签 | `cli-v0.3.15` |

发布准备 PR 合并后，必须重新读取远端 `main` 的完整 SHA，并让两个标签指向该同一发布提交。不得直接把上表的基线 SHA 当作最终标签目标；发布准备文档的合并提交也应包含在标签中。

## 3. 主要变化

- 一个 Herdr Server 可同时运行多个 RLL 项目；每个会话拥有唯一 Ralph/Claude 与 Lisa/Codex Agent target。
- 候选、任务更新、自动交接、重绑和接续按 Host Binding 中持久化的 target 路由，不再依赖全局固定名称。
- 失败启动仅在同任务、同模式、同会话、同 Workspace、零游标和 Host 未认领等严格条件下复用原请求。
- CLI 要求插件至少为 `0.1.9`，避免新 CLI 把会话级 target 交给不理解该契约的旧插件。
- 从 Herdr Pane 启动时，Workspace ID 按 Herdr 的不透明稳定句柄处理，支持实际出现的 `wB`，同时保留长度、控制字符、Server 回读和项目归属门禁。
- 多项目测试桩使用原子 JSON 写入，避免 Node 18 并发读取半写文件；运行时代码不受该测试修复影响。

## 4. 发布前证据

### 4.1 GitHub 与自动化

- 多项目功能 PR #3 已合并为 `72ff34d0252b29ce205dac8139075f5eca1bfdfe`。
- Node 18 暴露的测试桩并发写入问题由 PR #4 修复，最终 `main` 为 `4cce15e9acffbc8346c790e0a650885dbf8a10c6`。
- 最终主分支 CI 运行 `43391815373`：Node 18、20、22 全部成功。
- 本地 CLI 全量测试为 526/526；Herdr 插件全量测试为 66/66。
- 真实 Herdr 验收中，同一命名 Server 的两个项目保留四个唯一 Agent target，并分别完成自动交接和最终共识；详细证据见 `multi-project-agent-isolation-acceptance-2026-11-13.md`。

### 4.2 CLI 发布包

从 `main@4cce15e` 使用隔离 npm cache 构建：

| 检查 | 结果 |
|---|---|
| `node cli/scripts/verify-package.mjs` | `ralph-lisa-loop@0.3.15`，96 个发布文件通过 |
| tarball | `ralph-lisa-loop-0.3.15.tgz` |
| 大小 / 解包大小 | 120495 / 596190 字节 |
| SHA-1 | `e188e7f102698b6130adb7a3f86fd49cae5682a8` |
| SHA-256 | `21e184e787a26440d2ec67e3e9a9ba6c88c55a3b5a010561648badc7a5882d19` |
| npm integrity | `sha512-rV9lybeprG4PE3nlrgDagqQcJ/k5p4FuN/PtfFXvQF1X8/sn9nrOTin16wwflWsoNdsfK7sU8AWgY2ZieBJqnQ==` |
| 隔离 prefix 安装 | 成功；只安装 1 个包 |
| `ralph-lisa --version` | `ralph-lisa-loop v0.3.15` |
| `herdr-rll --help` | 成功，显示任务启动和 `status` 用法 |
| 包元数据 | 两个 `bin`、MIT、Node `>=18`、公司仓库地址均正确 |

本机默认 `~/.npm` 存在历史 root-owned cache 文件，首次包检查被 `EPERM` 阻断。验收没有执行 `sudo chown`，而是改用 `/private/tmp` 下的隔离 cache；因此上述结果不依赖修改用户全局 npm 环境。

### 4.3 GitHub 插件安装

在独立 XDG 目录和命名 Server `rp19-619erl` 中：

- 安装前插件列表为空；
- 从 `Click-Intelligence-LLC/ralph-lisa-herdr/integrations/herdr` 固定 `4cce15e9acffbc8346c790e0a650885dbf8a10c6` 安装成功；
- 预览和注册均显示插件 `0.1.9`、10 个 action、6 个 pane、3 条构建命令；
- 注册项的 `requested_ref`、`resolved_commit` 和托管 checkout HEAD 均指向同一固定提交；
- `doctor` 返回 `ready`：Herdr `0.9.4`、同仓 CLI `0.3.15` Host contract 正常、Claude/Codex 集成与登录检查通过；
- 本轮没有启动 Ralph 或 Lisa Agent。

该结果证明固定提交的公开 GitHub 安装和构建可用，不等于 `v0.1.9` 标签或市场安装已经验证。

### 4.4 当前公共分发状态

- npm `latest` 仍为 `0.3.14`，`0.3.15` 尚不存在；公共版本列表中另有历史 `3.0.0`，但它不是 `latest`。
- 远端尚无 `v0.1.9` 或 `cli-v0.3.15` 标签。
- GitHub 仓库为 public、MIT，默认分支为 `main`，topics 包含 `herdr`、`herdr-plugin`、`ralph-lisa-loop`。
- README 继续把 `0.3.14` 标为当前公开 npm 版本，这是发布前的正确文案；只有公共 `0.3.15` 验收通过后才能改为正式安装说明。

## 5. 发布执行清单

### 5.1 合并发布准备

1. 将本发布准备分支通过 PR 合并到 `main`。
2. 等待合并提交的 Node 18/20/22 CI 全部成功。
3. 读取远端 `main` 完整 SHA，记为 `RELEASE_SHA`。
4. 确认 `RELEASE_SHA` 包含 `4cce15e`、本发布记录，以及插件 `0.1.9` / CLI `0.3.15` 元数据。

### 5.2 创建固定标签

由有仓库写权限的维护者执行：

```bash
git fetch origin main --tags
git switch --detach <RELEASE_SHA>
git tag -a v0.1.9 -m "Herdr plugin v0.1.9"
git tag -a cli-v0.3.15 -m "CLI npm release candidate 0.3.15"
git push origin v0.1.9 cli-v0.3.15
```

推送后必须从远端回读两个 tag，确认都解析到同一个 `RELEASE_SHA`。若任一 tag 已存在但目标不同，停止，不覆盖、不强推。

### 5.3 npm 维护者发布

由拥有 `ralph-lisa-loop` npm 发布权限的维护者执行：

```bash
git fetch origin --tags
git switch --detach cli-v0.3.15
npm whoami
npm view ralph-lisa-loop@0.3.15 version
npm ci --prefix cli --ignore-scripts --no-audit --no-fund
npm run build --prefix cli
node cli/scripts/verify-package.mjs
cd cli
npm publish --access public
```

`npm view ralph-lisa-loop@0.3.15 version` 在发布前应返回未找到；若版本已存在，停止，不重发。登录、OTP 或其他身份验证必须由 npm 维护者本人完成。

## 6. 发布后验收

发布后必须重新使用公共来源，不复用本地 tarball 或本地 link：

1. 回读 npm `latest`、`0.3.15` 的 `bin`、repository、tarball、integrity。
2. 在全新隔离 prefix 安装 `ralph-lisa-loop@0.3.15`，验证两个命令入口。
3. 在全新隔离 Herdr XDG 环境通过 `--ref v0.1.9` 安装插件，核对 resolved commit、版本和 `doctor`。
4. 在新临时项目从外部终端执行一次 `herdr-rll --full-auto "任务"`。
5. 从 Herdr Pane 内执行一次启动，确认 `wB` 一类不透明 Workspace ID 不再触发 `WORKSPACE_ID_INVALID`。
6. 同一 Server 启动两个项目，确认四个唯一 Agent target 和各自状态、交接、完成回执。
7. 回读 Herdr 市场条目，确认索引到插件 `0.1.9`；市场索引不替代直接安装测试。
8. 验收通过后更新 README，把公共 CLI 安装命令从 `0.3.14` 改为 `0.3.15`，并提交发布后记录。

## 7. 停止与回滚条件

出现下列任一情况时停止发布或停止继续推广：

- tag 与计划发布提交不一致；
- npm 包内容、完整性或两个 `bin` 与本记录不一致；
- 插件固定 tag 安装不能解析到同一发布提交；
- doctor、双项目隔离、自动交接或不透明 Workspace ID 回归失败；
- npm 或 Herdr 市场仍提供旧版本但 README 已提前宣传新版本。

在 npm `0.3.15` 发布前，公开 CLI 继续保持 `0.3.14`；在插件 `v0.1.9` 公共验收前，用户不应被要求从未验证的 tag 安装。已发布的 npm 版本不可覆盖，若发布后发现阻断缺陷，应准备新补丁版本而不是重写 `0.3.15`。
