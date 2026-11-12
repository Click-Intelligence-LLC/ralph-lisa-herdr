# `ralph-lisa-loop@0.3.14` npm 发布与验收

> 2026-11-12 更新：`0.3.14` 已由 npm 维护者从公司仓库标签 `cli-v0.3.14` 发布。以下“发布前证据”和维护者命令保留为发布过程记录；用户现在可以从公共 npm 安装。发布后的现场结果见 [验收记录](npm-cli-public-acceptance-2026-11-12.md)。

## 目标与边界

同一个产品保留两个入口：Herdr 内的任务输入页，以及项目目录中的 `herdr-rll --full-auto "任务"`。Herdr 插件从 GitHub 安装时会构建仓内 CLI，但不会创建全局命令；`herdr-rll` 由 npm 包提供。现有 `ralph-lisa` 命令继续保留。

本次仅发布已有 npm 包 `ralph-lisa-loop` 的新版本 `0.3.14`，不创建第二个包。公司仓库保留上游 MIT 许可与来源声明。插件版本仍为 `0.1.8`，其代码没有随这次 CLI 分发准备而修改。

## 发布前证据

- npm 公共仓库目前的 `latest` 为 `0.3.13`，只有 `ralph-lisa` 可执行入口；`0.3.14` 在准备时尚未发布。
- 本地 CLI 回归：520/520 通过；Herdr 插件回归：60/60 通过。测试在清除当前 Herdr Pane 的 `HERDR_*` 环境变量后运行，避免测试夹具误用真实 Pane。
- `node cli/scripts/verify-package.mjs`：0.3.14 的 94 个发布文件检查通过。
- 本地 tarball：`ralph-lisa-loop-0.3.14.tgz`，SHA-256 `fb8b786f26de3a55a7d7651e60109b4330d8a834ad195c6db73e9e4d4c506c41`。在独立 npm prefix 中安装后，`ralph-lisa --version` 返回 `0.3.14`，`herdr-rll --help` 成功；两个 `bin` 均在安装的 `package.json` 中。
- 以上是本地构建和安装证据，不代表 npm 公共仓库已发布，也不替代发布后的端到端测试。

## npm 维护者执行

在公司仓库 `Click-Intelligence-LLC/ralph-lisa-herdr` 的固定标签 `cli-v0.3.14` 创建且 CI 通过后，npm 包维护者在自己的机器执行：

```bash
git fetch origin --tags
git switch --detach cli-v0.3.14
npm whoami
npm view ralph-lisa-loop@0.3.14 version
npm ci --prefix cli --ignore-scripts --no-audit --no-fund
npm run build --prefix cli
node cli/scripts/verify-package.mjs
cd cli
npm publish --access public
```

发布前 `npm view ralph-lisa-loop@0.3.14 version` 应返回未找到版本；如果版本已存在，停止，不要重发或覆盖。`npm whoami` 必须显示拥有该包发布权限的账号。`npm publish` 可能要求 npm 登录或一次性验证码，由维护者本人完成。不要从未核对的本地分支、旧 `v0.1.8` 标签或上游仓库发布。

## 发布后由我们验收

1. 核查 npm 上的 `0.3.14`、`latest`、两个 `bin`、仓库地址与 tarball 完整性。
2. 从公共 npm 仓库安装到新的隔离 prefix，确认 `ralph-lisa --version` 和 `herdr-rll --help`，并检查全局 PATH 说明。
3. 从公司 GitHub 仓库安装插件到新的隔离 Herdr 环境，运行 doctor；在新临时项目验证 `herdr-rll --full-auto "任务"` 能启动、状态可查、双席交接有回执。目录信任和账号余额等外部提示需要在测试记录里单列。
4. 把实际 npm 包版本、完整性、固定 Git 提交、CI 运行和真实验收结果回填到发布记录，再将 README 的“发布后”提示改为正式安装说明。

发布前曾禁止用户安装尚不存在的 `0.3.14`；现已确认公共 npm 的 `latest` 为 `0.3.14`，两个命令入口均在包元数据中。
