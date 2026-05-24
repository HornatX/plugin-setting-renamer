# Plugin Renamer (设置选项自定义/插件更名器)

A highly elegant customization tool for Obsidian. It lets you declutter and beautify your Obsidian Settings sidebar by custom-naming tabs, swapping Lucide icons, and hiding unused setting panels with a sleek dashboard.

插件还在测试当中,如果有bug或错误,加群讨论
QQ交流群:1094620986

[简体中文说明](#简体中文)

---

## 🌟 Key Features

### 1. Dynamic Renaming
- Custom-rename any tab in your Obsidian Settings sidebar (including Obsidian's native Core Settings, Core Plugins, and Community Plugins) to suit your personal workspace terminology.

### 2. Swap Tab Icons
- Swap out default setting icons with any icon from Obsidian's native library of over 1,000 Lucide icons.
- Built-in fuzzy-search modal (`IconPickerModal`) makes searching and previewing icons incredibly easy.

### 3. Hide Unwanted Panels (Declutter Sidebar)
- Hide unused or rarely configured plugin setting tabs to keep your settings workspace completely clean.
- **Fail-safe Lock Protection**: Includes a safety mechanism that prevents you from hiding the Renamer plugin itself, ensuring you are never locked out of your settings.

### 4. Interactive Control Panel
- Features a beautiful, responsive grid-layout setting tab that groups options into **Options (Core Settings)**, **Core Plugins**, and **Third-Party Plugins**.
- Includes a live debounced search bar to filter settings quickly by ID, custom name, or original name.
- Click the jump icon next to any item to navigate straight to that plugin's setup panel.

### 5. Safe & Revertible (No Side-Effects)
- Uses a smart `MutationObserver` and live-patching to safely hook into the settings view without altering any files on disk.
- Automatically restores all native setting names and icons to their absolute defaults the moment the plugin is turned off or unloaded.

---

## ⚙️ Settings Schema
All your custom configurations are saved inside a lightweight config file (`data.json`) in your plugin folder:
- `names`: Map of plugin IDs to custom names.
- `icons`: Map of plugin IDs to custom Lucide icon keys.
- `hidden`: Map of plugin IDs to hidden booleans.

---

## 📥 Installation

### Method 1: Community Plugins (Recommended)
Once approved, install it directly from the Obsidian plugin store:
1. Go to **Settings** > **Community plugins** > **Browse**.
2. Search for `Plugin Renamer`.
3. Click **Install**, then **Enable**.

### Method 2: Manual Installation
1. Go to the [Releases](https://github.com/hornatx/obsidian-plugin-renamer/releases) page and download `main.js` and `manifest.json`.
2. Navigate to your Obsidian vault's plugin directory: `<vault>/.obsidian/plugins/`.
3. Create a new folder named `obsidian-plugin-renamer` and move the downloaded files inside.
4. Go to Obsidian **Settings** > **Community plugins**, and toggle the plugin on.

---

## 简体中文

**Plugin Renamer（设置选项与插件更名器）** 是一款针对 Obsidian 的设置侧边栏净化与美化工具。它允许您彻底定制和精简 Obsidian 的设置菜单，支持自定义任意侧边栏名称、替换内置 Lucide 图标、并能彻底隐藏不需要的插件面板。

---

## 🌟 核心功能

### 1. 选项卡自由重命名
- 自由更改 Obsidian 设置侧边栏内任何选项卡的名称（包括软件内置的 **核心设置**、**核心插件**、以及所有已安装的 **第三方社区插件**）。

### 2. 侧边栏图标替换
- 支持将侧边栏默认的拼图（puzzle）或核心设置图标，替换为 Obsidian 原生集成的上千款精美 Lucide 图标。
- 内置模糊搜索弹窗（`IconPickerModal`），支持通过英文关键字（如 'star', 'settings' 等）实时查找和预览图标。

### 3. 隐藏不常用面板（净化侧边栏）
- 彻底屏蔽您极少配置的插件面板，大幅精简和净化庞杂的设置项。
- **安全防呆保护**：内置防锁死机制，绝对禁止隐藏“更名器”插件自身，防止误操作导致无法重新配置。

### 4. 极简网格管理面板
- 提供直观、响应式的网格仪表盘，将所有设置项划分为 **选项（系统核心设置）**、**核心插件** 和 **第三方插件** 进行统一管理。
- 配备防抖实时搜索框，支持通过插件 ID、原始名称、或自定义名称模糊查找。
- 每项配置旁提供跳转按钮，可一键切换到目标插件的详细配置面板。

### 5. 无痕安全卸载（零副作用）
- 基于微沙盒的 `MutationObserver` 动态监听和实时钩子拦截技术，完全不修改您其他插件的本地文件。
- 卸载或关闭本插件时，所有侧边栏图标、原版名称将瞬间**无痕恢复至系统出厂状态**。

---

## 📥 安装方法

### 社区插件安装（推荐）
待本插件正式上架社区商店后：
1. 打开 Obsidian **设置** > **社区插件** > **浏览**。
2. 搜索并选择 `Plugin Renamer`。
3. 点击 **安装** 随后选择 **启用**。

### 手动安装
1. 前往 [Releases](https://github.com/hornatx/obsidian-plugin-renamer/releases) 页面下载最新的 `main.js` 和 `manifest.json` 文件。
2. 打开您的本地库，进入目录 `.obsidian/plugins/`，并创建一个名为 `obsidian-plugin-renamer` 的新文件夹。
3. 将下载的两个文件放入该文件夹中。
4. 在 Obsidian **设置** > **社区插件** 中重新加载并开启该插件。