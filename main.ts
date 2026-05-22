import {
    App,
    Plugin,
    PluginSettingTab,
    Setting,
    FuzzySuggestModal,
    setIcon,
    getIconIds,
    Platform,
    PluginManifest
} from 'obsidian';

// ============================================================================
// 类型增强 (处理 Obsidian 内部未公开 API)
// ============================================================================

interface SettingTabItem {
    id: string;
    name: string;
    icon?: string;
}

interface InternalSetting {
    open: (...args: any[]) => void;
    settingTabs: SettingTabItem[];
    pluginTabs: SettingTabItem[];
    openTabById: (id: string) => void;
}

interface InternalApp extends App {
    setting: InternalSetting;
    plugins: {
        manifests: Record<string, PluginManifest>;
    };
}

interface PluginRenamerSettings {
    names: Record<string, string>;
    icons: Record<string, string>;
    hidden: Record<string, boolean>;
}

interface SearchItem {
    settingEl: HTMLElement;
    pluginId: string;
    originalName: string;
    getCustomName: () => string;
}

// ============================================================================
// 常量与默认设置
// ============================================================================

const DEFAULT_SETTINGS: PluginRenamerSettings = {
    names: {},
    icons: {},
    hidden: {}
};

// ============================================================================
// 图标搜索选择弹窗
// ============================================================================

class IconPickerModal extends FuzzySuggestModal<string> {
    pluginId: string;
    plugin: PluginRenamer;
    onChoose: (icon: string | null) => void;

    constructor(app: App, pluginId: string, plugin: PluginRenamer, onChoose: (icon: string | null) => void) {
        super(app);
        this.pluginId = pluginId;
        this.plugin = plugin;
        this.onChoose = onChoose;
        this.setPlaceholder("搜索图标 (输入英文, 如 'star', 'settings')...");
    }

    getItems(): string[] {
        return ["恢复默认状态", ...getIconIds()];
    }

    getItemText(item: string): string {
        return item;
    }

    renderSuggestion(match: FuzzyMatch<string>, el: HTMLElement) {
        const iconName = match.item;
        el.style.display = "flex";
        el.style.alignItems = "center";
        el.style.gap = "10px";

        if (iconName === "恢复默认状态") {
            el.createSpan({ text: "🔄 恢复默认 (核心插件恢复原版 / 第三方恢复拼图)" });
            return;
        }

        const iconContainer = el.createDiv();
        setIcon(iconContainer, iconName);
        el.createSpan({ text: iconName });
    }

    onChooseItem(item: string) {
        this.onChoose(item === "恢复默认状态" ? null : item);
    }
}

// ============================================================================
// 主插件逻辑
// ============================================================================

export default class PluginRenamer extends Plugin {
    settings!: PluginRenamerSettings;
    isApplying: boolean = false;
    mutationObserver: MutationObserver | null = null;
    originalSettingOpen?: (...args: any[]) => void;

    // 断言 app 为包含内部 API 的 App
    get internalApp(): InternalApp {
        return this.app as InternalApp;
    }

    async onload() {
        await this.loadSettings();

        this.isApplying = false;
        this.patchSettingOpen();

        this.app.workspace.onLayoutReady(() => {
            if (document.querySelector('.vertical-tab-header')) {
                this.applyToExistingTabs();
                this.setupMutationObserver();
            }
        });

        this.addSettingTab(new PluginRenamerSettingTab(this.app, this));
    }

    onunload() {
        this.unpatchSettingOpen();
        this.restoreExistingTabs();
        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
            this.mutationObserver = null;
        }
    }

    async loadSettings() {
        const loadedData = (await this.loadData()) || {};
        this.settings = {
            names: { ...DEFAULT_SETTINGS.names, ...(loadedData.names || {}) },
            icons: { ...DEFAULT_SETTINGS.icons, ...(loadedData.icons || {}) },
            hidden: { ...DEFAULT_SETTINGS.hidden, ...(loadedData.hidden || {}) }
        };
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    patchSettingOpen() {
        if (!this.internalApp.setting) return;
        this.originalSettingOpen = this.internalApp.setting.open;
        const self = this;

        this.internalApp.setting.open = function (this: any, ...args: any[]) {
            const result = self.originalSettingOpen?.apply(this, args);
            self.waitForSettingReady();
            return result;
        };
    }

    unpatchSettingOpen() {
        if (this.internalApp.setting && this.originalSettingOpen) {
            this.internalApp.setting.open = this.originalSettingOpen;
        }
    }

    waitForSettingReady() {
        let attempts = 0;
        const check = () => {
            const header = document.querySelector('.vertical-tab-header');
            if (header) {
                this.applyToExistingTabs();
                this.setupMutationObserver();
            } else if (attempts < 20) {
                attempts++;
                window.setTimeout(check, 50);
            }
        };
        check();
    }

    setupMutationObserver() {
        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
        }

        const header = document.querySelector('.vertical-tab-header');
        if (!header) return;

        const pendingNodes = new Set<HTMLElement>();
        let timeoutId: number | null = null;

        this.mutationObserver = new MutationObserver((mutations) => {
            if (this.isApplying) return;

            let shouldUpdate = false;
            mutations.forEach(m => {
                m.addedNodes.forEach(node => {
                    if (node instanceof HTMLElement) {
                        if (node.classList.contains("vertical-tab-nav-item") && node.hasAttribute("data-setting-id")) {
                            pendingNodes.add(node);
                            shouldUpdate = true;
                        } else if (node.querySelectorAll) {
                            node.querySelectorAll<HTMLElement>(".vertical-tab-nav-item[data-setting-id]").forEach(tab => pendingNodes.add(tab));
                            shouldUpdate = true;
                        }
                    }
                });
            });

            if (shouldUpdate) {
                if (timeoutId !== null) window.clearTimeout(timeoutId);
                timeoutId = window.setTimeout(() => {
                    this.isApplying = true;
                    pendingNodes.forEach(node => this.applyIconToNavItem(node));
                    pendingNodes.clear();
                    this.isApplying = false;
                }, 10);
            }
        });

        this.mutationObserver.observe(header, { childList: true, subtree: true });
    }

    applyToExistingTabs() {
        const header = document.querySelector('.vertical-tab-header');
        if (!header) return;

        this.isApplying = true;
        header.querySelectorAll<HTMLElement>(".vertical-tab-nav-item[data-setting-id]").forEach(tabEl => {
            this.applyIconToNavItem(tabEl);
        });
        this.isApplying = false;
    }

    applyIconToNavItem(tabEl: HTMLElement) {
        const pluginId = tabEl.getAttribute("data-setting-id");
        if (!pluginId) return;

        const manifests = this.internalApp.plugins.manifests;
        const isThirdParty = !!manifests[pluginId];
        const isSelf = pluginId === this.manifest.id;

        // 置顶自身
        if (isSelf && tabEl.parentElement && tabEl.parentElement.firstElementChild !== tabEl) {
            tabEl.parentElement.prepend(tabEl);
        }

        const customName = this.settings.names[pluginId];
        let targetIcon: string | null | undefined = this.settings.icons[pluginId];

        if (targetIcon === undefined) {
            targetIcon = isThirdParty ? 'puzzle' : null;
        }

        // 1. 处理名称
        if (customName && customName.trim() !== "") {
            if (!tabEl.dataset.originalName) {
                const walker = document.createTreeWalker(tabEl, NodeFilter.SHOW_TEXT, null);
                let node: Node | null;
                while ((node = walker.nextNode())) {
                    if (node.nodeValue && node.nodeValue.trim() !== "") {
                        tabEl.dataset.originalName = node.nodeValue;
                        break;
                    }
                }
            }
            if (tabEl.getAttribute('aria-label') !== customName) {
                tabEl.setAttribute('aria-label', customName);
            }
            const walker = document.createTreeWalker(tabEl, NodeFilter.SHOW_TEXT, null);
            let node: Node | null;
            while ((node = walker.nextNode())) {
                if (node.nodeValue && node.nodeValue.trim() !== "") {
                    if (node.nodeValue !== customName) node.nodeValue = customName;
                    break;
                }
            }
        } else if (tabEl.dataset.originalName) {
            const walker = document.createTreeWalker(tabEl, NodeFilter.SHOW_TEXT, null);
            let node: Node | null;
            while ((node = walker.nextNode())) {
                if (node.nodeValue && node.nodeValue.trim() !== "") {
                    node.nodeValue = tabEl.dataset.originalName;
                    break;
                }
            }
            tabEl.setAttribute('aria-label', tabEl.dataset.originalName);
            delete tabEl.dataset.originalName;
        }

        // 2. 处理显示与隐藏
        if (this.settings.hidden[pluginId] && !isSelf) {
            tabEl.style.display = "none";
        } else {
            tabEl.style.display = isThirdParty ? "flex" : "";
            tabEl.style.alignItems = isThirdParty ? "center" : "";

            if (isSelf && this.settings.hidden[pluginId]) {
                delete this.settings.hidden[pluginId];
                this.saveSettings();
            }
        }

        // 3. 处理图标
        let customIconEl = tabEl.querySelector<HTMLElement>('.vertical-tab-nav-item-icon.custom-icon');
        let nativeIconEl = tabEl.querySelector<HTMLElement>('.vertical-tab-nav-item-icon:not(.custom-icon)');

        if (!targetIcon) {
            if (customIconEl) customIconEl.remove();
            if (nativeIconEl) nativeIconEl.style.display = '';
            return;
        }

        if (!customIconEl) {
            if (nativeIconEl) nativeIconEl.style.display = 'none';

            customIconEl = document.createElement('div');
            customIconEl.classList.add("vertical-tab-nav-item-icon", "custom-icon");

            if (isThirdParty) {
                customIconEl.style.marginRight = '8px';
                customIconEl.style.display = 'flex';
                customIconEl.style.alignItems = 'center';
                customIconEl.style.justifyContent = 'center';
            }

            const firstNode = tabEl.firstChild;
            firstNode ? tabEl.insertBefore(customIconEl, firstNode) : tabEl.appendChild(customIconEl);
        } else if (nativeIconEl) {
            nativeIconEl.style.display = 'none';
        }

        if (customIconEl.dataset.icon !== targetIcon) {
            customIconEl.innerHTML = '';
            setIcon(customIconEl, targetIcon);
            customIconEl.dataset.icon = targetIcon;
        }
    }

    restoreExistingTabs() {
        const header = document.querySelector('.vertical-tab-header');
        const allTabs = header
            ? header.querySelectorAll<HTMLElement>(".vertical-tab-nav-item[data-setting-id]")
            : document.querySelectorAll<HTMLElement>(".vertical-tab-nav-item[data-setting-id]");

        allTabs.forEach(tabEl => {
            if (tabEl.dataset.originalName) {
                const walker = document.createTreeWalker(tabEl, NodeFilter.SHOW_TEXT, null);
                let node: Node | null;
                while ((node = walker.nextNode())) {
                    if (node.nodeValue && node.nodeValue.trim() !== "") {
                        node.nodeValue = tabEl.dataset.originalName;
                        break;
                    }
                }
                tabEl.setAttribute('aria-label', tabEl.dataset.originalName);
                delete tabEl.dataset.originalName;
            }

            let customIconEl = tabEl.querySelector<HTMLElement>('.vertical-tab-nav-item-icon.custom-icon');
            if (customIconEl) customIconEl.remove();

            let nativeIconEl = tabEl.querySelector<HTMLElement>('.vertical-tab-nav-item-icon:not(.custom-icon)');
            if (nativeIconEl) nativeIconEl.style.display = '';

            tabEl.style.display = '';
            tabEl.style.alignItems = '';
        });
    }
}

// ============================================================================
// 设置页面
// ============================================================================

class PluginRenamerSettingTab extends PluginSettingTab {
    plugin: PluginRenamer;

    constructor(app: App, plugin: PluginRenamer) {
        super(app, plugin);
        this.plugin = plugin;
    }

    get internalApp(): InternalApp {
        return this.app as InternalApp;
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();
        const isPhone = Platform.isPhone;

        const topHeaderContainer = containerEl.createDiv();
        topHeaderContainer.style.display = 'flex';
        topHeaderContainer.style.justifyContent = 'space-between';
        topHeaderContainer.style.alignItems = 'flex-start';
        topHeaderContainer.style.flexWrap = 'wrap';
        topHeaderContainer.style.gap = '15px';
        topHeaderContainer.style.marginBottom = '25px';

        const titleArea = topHeaderContainer.createDiv();
        titleArea.createEl('h2', { text: '⚙️ 插件名称与图标自定义', cls: 'setting-item-heading' }).style.border = 'none';
        titleArea.createEl('p', { text: '点击眼睛隐藏/显示，中间改图标，右侧改名称。', cls: "setting-item-description" });

        const searchInput = topHeaderContainer.createEl('input', {
            type: 'search',
            placeholder: '🔍 搜索 插件名 / 自定义名 / ID...'
        });
        searchInput.style.flex = '1';
        searchInput.style.minWidth = '250px';
        searchInput.style.maxWidth = '350px';

        const settingTabs = this.internalApp.setting.settingTabs || [];
        const pluginTabs = this.internalApp.setting.pluginTabs || [];
        const manifests = this.internalApp.plugins.manifests || {};

        const corePluginTabs = pluginTabs.filter(tab => !manifests[tab.id]);
        const communityPluginTabs = pluginTabs.filter(tab => !!manifests[tab.id]);

        const sortByOriginalName = (a: SettingTabItem, b: SettingTabItem) => {
            const nameA = manifests[a.id]?.name || a.name || a.id;
            const nameB = manifests[b.id]?.name || b.name || b.id;
            return nameA.localeCompare(nameB);
        };
        corePluginTabs.sort(sortByOriginalName);
        communityPluginTabs.sort(sortByOriginalName);

        const searchItems: SearchItem[] = [];
        const groups: { headingEl: HTMLElement, gridContainer: HTMLElement }[] = [];

        const createGridContainer = (parentEl: HTMLElement) => {
            const gridEl = parentEl.createDiv();
            gridEl.style.display = 'grid';
            gridEl.style.gridTemplateColumns = isPhone ? '1fr' : 'repeat(2, minmax(0, 1fr))';
            gridEl.style.gap = '15px';
            gridEl.style.marginBottom = '30px';
            return gridEl;
        };

        const renderSettingItem = (gridContainer: HTMLElement, tab: SettingTabItem, isThirdParty: boolean) => {
            const pluginId = tab.id;
            const isSelf = pluginId === this.plugin.manifest.id;

            const originalName = manifests[pluginId]?.name || tab.name || pluginId;
            const fallbackIcon = isThirdParty ? 'puzzle' : (tab.icon || 'box');
            const isHidden = this.plugin.settings.hidden[pluginId];

            const setting = new Setting(gridContainer)
                .setName(originalName)
                .setDesc(`ID: ${pluginId}`);

            if (isSelf) {
                setting.settingEl.style.backgroundColor = 'var(--background-primary)';
                setting.setDesc(`ID: ${pluginId} (本插件)`);
            }

            setting.nameEl.empty();
            setting.nameEl.style.display = 'flex';
            setting.nameEl.style.alignItems = 'center';
            setting.nameEl.style.overflow = 'hidden';

            const currentIcon = this.plugin.settings.icons[pluginId];
            const displayIcon = currentIcon !== undefined ? currentIcon : fallbackIcon;

            const iconEl = document.createElement('span');
            iconEl.style.marginRight = '8px';
            iconEl.style.display = 'inline-flex';
            iconEl.style.alignItems = 'center';
            iconEl.style.flexShrink = '0';
            setIcon(iconEl, displayIcon || 'image');

            const nameSpan = document.createElement('span');
            nameSpan.textContent = this.plugin.settings.names[pluginId] || originalName;

            if (isPhone) {
                nameSpan.style.whiteSpace = 'normal';
                nameSpan.style.wordBreak = 'break-word';
            } else {
                nameSpan.style.whiteSpace = 'nowrap';
                nameSpan.style.overflow = 'hidden';
                nameSpan.style.textOverflow = 'ellipsis';
            }
            nameSpan.style.flex = '1 1 auto';

            setting.nameEl.appendChild(iconEl);
            setting.nameEl.appendChild(nameSpan);

            setting.addExtraButton(btn => {
                btn.setIcon('settings')
                    .setTooltip("跳转到该面板设置")
                    .onClick(() => {
                        if (this.internalApp.setting && typeof this.internalApp.setting.openTabById === 'function') {
                            this.internalApp.setting.openTabById(pluginId);
                        }
                    });
            });

            if (isSelf) {
                setting.addExtraButton(btn => {
                    btn.setIcon('lock')
                        .setTooltip("防呆保护：不允许隐藏本插件自身")
                        .setDisabled(true);
                    setting.settingEl.style.opacity = '1';
                });
            } else {
                setting.addExtraButton(btn => {
                    btn.setIcon(isHidden ? 'eye-off' : 'eye')
                        .setTooltip(isHidden ? "取消隐藏 (在侧边栏显示)" : "在侧边栏中隐藏此面板")
                        .onClick(async () => {
                            if (this.plugin.settings.hidden[pluginId]) {
                                delete this.plugin.settings.hidden[pluginId];
                                btn.setIcon('eye').setTooltip("隐藏面板");
                                setting.settingEl.style.opacity = '1';
                            } else {
                                this.plugin.settings.hidden[pluginId] = true;
                                btn.setIcon('eye-off').setTooltip("取消隐藏");
                                setting.settingEl.style.opacity = '0.5';
                            }
                            await this.plugin.saveSettings();
                            this.plugin.applyToExistingTabs();
                        });
                });
            }

            setting.addExtraButton(btn => {
                btn.setIcon(displayIcon || 'image')
                    .setTooltip("更改侧边栏图标")
                    .onClick(() => {
                        new IconPickerModal(this.app, pluginId, this.plugin, async (selectedIcon) => {
                            if (selectedIcon === null) {
                                delete this.plugin.settings.icons[pluginId];
                            } else {
                                this.plugin.settings.icons[pluginId] = selectedIcon;
                            }

                            const newIcon = selectedIcon || fallbackIcon || 'image';
                            btn.setIcon(newIcon);
                            setIcon(iconEl, newIcon);

                            await this.plugin.saveSettings();
                            this.plugin.applyToExistingTabs();
                        }).open();
                    });
            });

            setting.addText(text => {
                text.setPlaceholder('输入想显示的...')
                    .setValue(this.plugin.settings.names[pluginId] || '')
                    .onChange(async (value) => {
                        this.plugin.settings.names[pluginId] = value;
                        await this.plugin.saveSettings();
                        nameSpan.textContent = value.trim() !== "" ? value : originalName;
                        this.plugin.applyToExistingTabs();
                    });

                text.inputEl.style.width = isPhone ? 'auto' : '90px';
                if (isPhone) {
                    text.inputEl.style.flex = '1';
                    text.inputEl.style.minWidth = '100px';
                }
            });

            setting.settingEl.style.border = '1px solid var(--background-modifier-border)';
            setting.settingEl.style.borderRadius = '8px';
            setting.settingEl.style.padding = '12px 15px';
            setting.settingEl.style.margin = '0';

            if (!isSelf) {
                setting.settingEl.style.backgroundColor = 'var(--background-secondary)';
            }

            setting.infoEl.style.flex = '1 1 auto';
            setting.infoEl.style.overflow = 'hidden';
            setting.infoEl.style.minWidth = '0';

            if (isHidden && !isSelf) {
                setting.settingEl.style.opacity = '0.5';
            }

            searchItems.push({
                settingEl: setting.settingEl,
                pluginId: pluginId.toLowerCase(),
                originalName: originalName.toLowerCase(),
                getCustomName: () => (this.plugin.settings.names[pluginId] || '').toLowerCase()
            });
        };

        const mainContentEl = containerEl.createDiv();

        if (settingTabs.length > 0) {
            const heading = new Setting(mainContentEl).setName('选项').setHeading();
            const grid = createGridContainer(mainContentEl);
            groups.push({ headingEl: heading.settingEl, gridContainer: grid });
            settingTabs.forEach(tab => renderSettingItem(grid, tab, false));
        }

        if (corePluginTabs.length > 0) {
            const heading = new Setting(mainContentEl).setName('核心插件').setHeading();
            const grid = createGridContainer(mainContentEl);
            groups.push({ headingEl: heading.settingEl, gridContainer: grid });
            corePluginTabs.forEach(tab => renderSettingItem(grid, tab, false));
        }

        if (communityPluginTabs.length > 0) {
            const heading = new Setting(mainContentEl).setName('第三方插件').setHeading();
            const grid = createGridContainer(mainContentEl);
            groups.push({ headingEl: heading.settingEl, gridContainer: grid });
            communityPluginTabs.forEach(tab => renderSettingItem(grid, tab, true));
        }

        let searchTimeout: number;
        searchInput.addEventListener('input', (e) => {
            window.clearTimeout(searchTimeout);
            searchTimeout = window.setTimeout(() => {
                const target = e.target as HTMLInputElement;
                const query = target.value.toLowerCase().trim();

                searchItems.forEach(item => {
                    const customName = item.getCustomName();
                    const match = item.pluginId.includes(query) ||
                        item.originalName.includes(query) ||
                        customName.includes(query);
                    item.settingEl.style.display = match ? 'flex' : 'none';
                });

                groups.forEach(group => {
                    const hasVisible = Array.from(group.gridContainer.children).some(el => (el as HTMLElement).style.display !== 'none');
                    group.headingEl.style.display = hasVisible ? '' : 'none';
                    group.gridContainer.style.display = hasVisible ? 'grid' : 'none';
                });
            }, 150);
        });
    }
}