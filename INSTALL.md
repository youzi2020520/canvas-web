# Canvas-Codex 安装说明

仓库地址：https://github.com/youzi2020520/canvas-codex.git

## 一句话安装（推荐）

把下面整段复制到 Codex 对话中即可：

```text
请从 https://github.com/youzi2020520/canvas-codex.git 安装 Canvas-Codex。请阅读仓库中的 INSTALL.md，克隆仓库到本机长期保留的位置，运行 npm ci、npm run install:personal 和 codex plugin add codex-canvas@personal。安装完成后请提示我新建 Codex 任务，再输入 @Codex-Canvas 打开画布。
```

当前仓库尚未发布 GitHub Release，因此安装器会从 `main` 安装。后续发布稳定版本后，安装流程会切换为固定到 Release tag。

## 手动安装

下面使用 `~/src/codex-canvas` 作为示例路径；它不是固定要求，可以换成任意你会长期保留的目录。

```bash
mkdir -p ~/src
git clone https://github.com/youzi2020520/canvas-codex.git ~/src/canvas-codex
cd ~/src/canvas-codex
npm ci
npm run install:personal
codex plugin add codex-canvas@personal
```

`npm run install:personal` 会创建或更新 `~/plugins/codex-canvas`，并把插件条目写进 `~/.agents/plugins/marketplace.json`。它还会 best-effort 尝试安装 `rapidocr_onnxruntime`，用于 `Edit Text` 本地 OCR；这一步通常需要几十秒到几分钟，取决于 Python、pip、网络和 wheel 缓存。如果安装失败，personal plugin 仍会安装完成，`Edit Text` 会回退到 Codex 视觉识别。

若要跳过 RapidOCR 安装：

```bash
CODEX_CANVAS_SKIP_OCR_INSTALL=1 npm run install:personal
```

或者：

```bash
npm run install:personal -- --skip-ocr
```

## 安装 personal plugin

默认的 personal marketplace 会从 `~/.agents/plugins/marketplace.json` 自动发现，不需要另外注册 marketplace。运行：

```bash
codex plugin add codex-canvas@personal
```

安装后新建一个 Codex 任务，再使用 `@Codex-Canvas` 打开画布，让新版 skills 和 MCP server 从新缓存加载。也可以尝试输入 `/canvas`；如果当前 Codex 版本没有把插件 skill 暴露成 slash command，可以使用 `$canvas` 或直接说“打开 Codex-Canvas 画布”。

## 更新

Codex-Canvas 的稳定更新以 `vX.Y.Z` Git tag 和已完成产物上传的 GitHub Release 为边界。Settings 会确认 Release 同时包含插件包、`release-manifest.json` 和 `SHA256SUMS`，并验证 manifest commit 与 tag 一致；`main` 上尚未发布的提交不会被当作更新。

- 打开画布时只检查是否有新 Release，不会静默修改本地代码。
- 在画布的 **Settings → Version** 点击更新，会把 personal marketplace 指向的源码安全 fast-forward 到最新稳定 tag，安装锁定依赖，然后重新执行 `codex plugin add codex-canvas@personal`，让 Codex 创建新的版本缓存。
- 更新完成后必须关闭旧画布，并新建一个 Codex 任务；仅刷新网页不能重载 MCP server 和 skills。
- 如果曾用不同端口手动启动多个 Canvas server，更新前先关闭其他实例；当前实例会在仍有图片、文字或聊天操作运行时拒绝更新。

也可以通过 CLI 检查或安装：

```bash
node ./bin/codex-canvas.mjs update --check
node ./bin/codex-canvas.mjs update
```

源码目录有未提交修改、本地提交、分支分叉，或 Release tag 与 manifest 版本不一致时，自动更新会停止并显示原因，不会覆盖本地工作。

所有 `0.1.1` 及更早的安装都需要做一次手动 bootstrap，因为旧 cache 里的更新器无法安全迁移自己。最稳妥的方式是保留旧目录，另外创建一个干净的长期 clone：

```bash
git clone https://github.com/youzi2020520/canvas-codex.git ~/src/canvas-codex-stable
cd ~/src/canvas-codex-stable
npm run checkout:stable
npm ci
npm run install:personal -- --skip-ocr
codex plugin add codex-canvas@personal
```

安装器会把 personal marketplace 的 symlink/junction 从旧 clone 切换到这个稳定 clone。关闭仍在运行的旧画布，然后新建 Codex 任务。确认新版正常后，旧 clone 才可以自行归档或删除。首个采用新机制的稳定版是 `v0.2.0`。

## 可选依赖

其他可选本地依赖可以按需安装；它们用于本地 OCR、Edit Elements 拆层和背景处理，不是打开画布的硬性前置条件：

```bash
npm run setup:deps
```

快速去背景还可选用轻量本地分割依赖。未安装时会自动回退到原有 AI 精细抠图：

```bash
python3 -m pip install --user --no-deps rembg==2.0.50
python3 -m pip install --user onnxruntime==1.16.3 pooch scipy tqdm
```

第一次去背景会自动缓存约 5 MB 的 `u2netp` 模型；之后运行不再下载模型。可设置
`CODEX_CANVAS_REMOVE_BG_MODEL` 切换 rembg 模型，或设置
`CODEX_CANVAS_REMOVE_BG_ALPHA_MATTING=1` 开启更慢的边缘 alpha matting。

单独检查或安装 OCR：

```bash
npm run doctor:ocr
npm run setup:ocr
```

单独检查或安装 Edit Elements 本地图像处理依赖：

```bash
npm run doctor:image-deps
npm run setup:image-deps
```

## 安装器行为

`npm run install:personal` 写入的插件条目形如：

```json
{
  "name": "codex-canvas",
  "source": {
    "source": "local",
    "path": "./plugins/codex-canvas"
  },
  "policy": {
    "installation": "AVAILABLE",
    "authentication": "ON_INSTALL"
  },
  "category": "Productivity"
}
```

安装器只会创建或更新指向当前仓库的 symlink/junction；如果 `~/plugins/codex-canvas` 已经是普通文件或目录，命令会拒绝覆盖并提示先移除该路径。

测试或临时安装可以设置：

```bash
CODEX_CANVAS_PERSONAL_HOME=/path/to/home npm run install:personal
```

这样会写入该目录下的 `plugins/codex-canvas` 和 `.agents/plugins/marketplace.json`，不影响真实用户目录。
