import {
    App,
    Plugin,
    PluginSettingTab,
    Setting,
    FuzzySuggestModal,
    setIcon,
    getIconIds,
    Platform,
    PluginManifest,
    Modal,
    FuzzyMatch,
    ButtonComponent,
    ExtraButtonComponent
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
    categories: Record<string, string[]>;
    collapsed: Record<string, boolean>;
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
    hidden: {},
    categories: {},
    collapsed: {}
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
// 分类管理弹窗 (已美化 & 增加重命名功能)
// ============================================================================

class CategoryManagerModal extends Modal {
    plugin: PluginRenamer;
    refreshMainTab: () => void;
    currentView: 'list' | 'edit' = 'list';
    editingCategory: string | null = null;
    renamingCategory: string | null = null; // 用于追踪正在重命名的分类
    tempCategoryName: string = '';

    constructor(app: App, plugin: PluginRenamer, refreshMainTab: () => void) {
        super(app);
        this.plugin = plugin;
        this.refreshMainTab = refreshMainTab;
    }

    onOpen() {
        this.display();
    }

    onClose() {
        this.contentEl.empty();
        this.refreshMainTab();
    }

    display() {
        this.contentEl.empty();
        if (this.currentView === 'list') {
            this.renderList();
        } else {
            this.renderEdit();
        }
    }

    renderList() {
        this.titleEl.setText('📁 管理插件分类');

        // 美化：新建分类卡片区域
        const createSection = this.contentEl.createDiv({
            attr: { style: 'background: var(--background-secondary); padding: 15px; border-radius: 8px; margin-bottom: 25px; border: 1px solid var(--background-modifier-border);' }
        });
        
        createSection.createEl('h4', { text: '✨ 新建分类', attr: { style: 'margin-top: 0; margin-bottom: 10px; color: var(--text-normal);' } });

        const createSetting = new Setting(createSection)
            .setName('分类名称')
            .setDesc('创建一个新的分类模块以归纳插件')
            .addText(text => text
                .setPlaceholder('输入分类名称...')
                .setValue(this.tempCategoryName)
                .onChange(val => this.tempCategoryName = val)
            )
            .addButton(btn => btn
                .setButtonText('创建分类')
                .setCta()
                .onClick(async () => {
                    const name = this.tempCategoryName.trim();
                    if (name && !this.plugin.settings.categories[name]) {
                        this.plugin.settings.categories[name] = [];
                        await this.plugin.saveSettings();
                        this.tempCategoryName = '';
                        this.display();
                    }
                })
            );
        createSetting.settingEl.style.border = 'none';
        createSetting.settingEl.style.padding = '0';

        const catKeys = Object.keys(this.plugin.settings.categories);
        if (catKeys.length > 0) {
            this.contentEl.createEl('h4', { text: '📂 现有分类', attr: { style: 'margin-bottom: 15px; padding-bottom: 5px; border-bottom: 1px solid var(--background-modifier-border); color: var(--text-normal);' } });
            
            // 美化：列表容器
            const listContainer = this.contentEl.createDiv({
                attr: { style: 'display: flex; flex-direction: column; gap: 12px; max-height: 45vh; overflow-y: auto; padding-right: 5px;' }
            });

            for (const cat of catKeys) {
                const itemDiv = listContainer.createDiv({
                    attr: { style: 'border: 1px solid var(--background-modifier-border); border-radius: 8px; padding: 12px 15px; background: var(--background-primary); transition: all 0.2s ease;' }
                });

                // 如果当前正处于重命名状态
                if (this.renamingCategory === cat) {
                    let newCatName = cat;
                    const renameSetting = new Setting(itemDiv)
                        .setName('修改名称')
                        .addText(text => text
                            .setValue(cat)
                            .onChange(val => newCatName = val)
                        )
                        .addButton(btn => btn
                            .setButtonText('保存')
                            .setCta()
                            .onClick(async () => {
                                newCatName = newCatName.trim();
                                if (newCatName && newCatName !== cat && !this.plugin.settings.categories[newCatName]) {
                                    // 迁移数据
                                    this.plugin.settings.categories[newCatName] = this.plugin.settings.categories[cat];
                                    delete this.plugin.settings.categories[cat];
                                    
                                    // 迁移折叠状态
                                    if (this.plugin.settings.collapsed[cat] !== undefined) {
                                        this.plugin.settings.collapsed[newCatName] = this.plugin.settings.collapsed[cat];
                                        delete this.plugin.settings.collapsed[cat];
                                    }
                                    
                                    await this.plugin.saveSettings();
                                }
                                this.renamingCategory = null;
                                this.display();
                            })
                        )
                        .addButton(btn => btn
                            .setButtonText('取消')
                            .onClick(() => {
                                this.renamingCategory = null;
                                this.display();
                            })
                        );
                    renameSetting.settingEl.style.border = 'none';
                    renameSetting.settingEl.style.padding = '0';
                } 
                // 正常显示状态
                else {
                    const viewSetting = new Setting(itemDiv)
                        .setName(cat)
                        .setDesc(`包含 ${this.plugin.settings.categories[cat].length} 个插件`)
                        .addButton(btn => btn
                            .setIcon('pencil')
                            .setTooltip('修改分类名称')
                            .onClick(() => {
                                this.renamingCategory = cat;
                                this.display();
                            })
                        )
                        .addButton(btn => btn
                            .setIcon('list')
                            .setTooltip('管理分类内的插件')
                            .onClick(() => {
                                this.editingCategory = cat;
                                this.currentView = 'edit';
                                this.display();
                            })
                        )
                        .addButton(btn => btn
                            .setIcon('trash')
                            .setTooltip('删除该分类（插件将被移回原列表）')
                            .setWarning()
                            .onClick(async () => {
                                delete this.plugin.settings.categories[cat];
                                delete this.plugin.settings.collapsed[cat];
                                await this.plugin.saveSettings();
                                this.display();
                            })
                        );
                    viewSetting.settingEl.style.border = 'none';
                    viewSetting.settingEl.style.padding = '0';
                }
            }
        } else {
            this.contentEl.createEl('p', { 
                text: '当前没有自定义分类。上方创建后，分类会显示在此处。', 
                attr: { style: 'text-align: center; color: var(--text-muted); margin-top: 20px; padding: 25px; background: var(--background-secondary); border-radius: 8px; border: 1px dashed var(--background-modifier-border);' } 
            });
        }
    }

    renderEdit() {
        this.titleEl.setText(`📝 编辑分类插件: ${this.editingCategory}`);

        const headerDiv = this.contentEl.createDiv({ attr: { style: 'background: var(--background-secondary); padding: 10px 15px; border-radius: 8px; border: 1px solid var(--background-modifier-border); margin-bottom: 20px;' } });
        const topSetting = new Setting(headerDiv)
            .setName('勾选要加入此分类的插件')
            .setDesc('提示：已在其他分类中的插件会自动隐藏。')
            .addButton(btn => btn
                .setButtonText('返回列表')
                .onClick(() => {
                    this.currentView = 'list';
                    this.editingCategory = null;
                    this.display();
                })
            );
        topSetting.settingEl.style.border = 'none';
        topSetting.settingEl.style.padding = '0';

        const internalApp = this.app as InternalApp;
        const manifests = internalApp.plugins.manifests;
        const pluginTabs = internalApp.setting.pluginTabs || [];
        const communityTabs = pluginTabs.filter(tab => !!manifests[tab.id]);

        communityTabs.sort((a, b) => {
            const nameA = this.plugin.settings.names[a.id] || manifests[a.id]?.name || a.name || a.id;
            const nameB = this.plugin.settings.names[b.id] || manifests[b.id]?.name || b.name || b.id;
            return nameA.localeCompare(nameB);
        });

        const currentCatPlugins = this.plugin.settings.categories[this.editingCategory!] || [];

        const otherCatPlugins = new Set<string>();
        for (const cat in this.plugin.settings.categories) {
            if (cat !== this.editingCategory) {
                this.plugin.settings.categories[cat].forEach(id => otherCatPlugins.add(id));
            }
        }

        const container = this.contentEl.createDiv({ 
            attr: { style: 'max-height: 50vh; overflow-y: auto; padding: 15px; border: 1px solid var(--background-modifier-border); border-radius: 8px; display: flex; flex-direction: column; gap: 5px;' }
        });

        let availableCount = 0;

        for (const tab of communityTabs) {
            if (otherCatPlugins.has(tab.id)) continue; 
            
            availableCount++;
            const originalName = manifests[tab.id]?.name || tab.name || tab.id;
            const customName = this.plugin.settings.names[tab.id];
            const displayName = customName ? `${customName} (${originalName})` : originalName;

            const row = new Setting(container)
                .setName(displayName)
                .addToggle(toggle => toggle
                    .setValue(currentCatPlugins.includes(tab.id))
                    .onChange(async (val) => {
                        let list = this.plugin.settings.categories[this.editingCategory!];
                        if (val) {
                            if (!list.includes(tab.id)) list.push(tab.id);
                        } else {
                            list = list.filter(id => id !== tab.id);
                        }
                        this.plugin.settings.categories[this.editingCategory!] = list;
                        await this.plugin.saveSettings();
                    })
                );
            row.settingEl.style.padding = '8px 10px';
            row.settingEl.style.borderBottom = '1px solid var(--background-modifier-border)';
            row.settingEl.style.borderTop = 'none';
        }

        if (availableCount === 0) {
            container.createEl('p', { text: '没有可用的插件了，其他插件都已被分配完毕。', attr: { style: 'text-align: center; color: var(--text-muted); padding: 20px 0;' } });
        }
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
            hidden: { ...DEFAULT_SETTINGS.hidden, ...(loadedData.hidden || {}) },
            categories: { ...DEFAULT_SETTINGS.categories, ...(loadedData.categories || {}) },
            collapsed: { ...DEFAULT_SETTINGS.collapsed, ...(loadedData.collapsed || {}) }
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

        if (isSelf && tabEl.parentElement && tabEl.parentElement.firstElementChild !== tabEl) {
            tabEl.parentElement.prepend(tabEl);
        }

        const customName = this.settings.names[pluginId];
        let targetIcon: string | null | undefined = this.settings.icons[pluginId];

        if (targetIcon === undefined) {
            targetIcon = isThirdParty ? 'puzzle' : null;
        }

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
        titleArea.createEl('p', { text: '点击眼睛隐藏/显示，中间改图标，右侧改名称。可分类管理。', cls: "setting-item-description" });

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
        const groups: { title: string, headingEl: HTMLElement, gridContainer: HTMLElement, toggleBtn?: ExtraButtonComponent }[] = [];

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

        // 重新设计的渲染控制函数，增加按需开关折叠和齿轮按钮的能力
        const renderSection = (title: string, tabs: SettingTabItem[], isThirdParty: boolean, options: { showCategoryBtn?: boolean, allowCollapse?: boolean } = {}) => {
            const { showCategoryBtn = false, allowCollapse = true } = options;
            
            if (tabs.length === 0 && !showCategoryBtn) return; 

            const headingSetting = new Setting(mainContentEl).setName(title).setHeading();
            const grid = createGridContainer(mainContentEl);
            
            // 是否读取折叠状态（只有允许折叠的模块才生效，第三方模块禁止折叠）
            let isCollapsed = allowCollapse ? (this.plugin.settings.collapsed[title] || false) : false;
            grid.style.display = isCollapsed ? 'none' : 'grid';

            // 恒定存在的分类管理按钮 (齿轮)
            if (showCategoryBtn) {
                headingSetting.addExtraButton(btn => {
                    btn.setIcon('folder-cog')
                        .setTooltip('分类管理')
                        .onClick(() => {
                            new CategoryManagerModal(this.app, this.plugin, () => this.display()).open();
                        });
                });
            }

            let currentToggleBtn: ExtraButtonComponent | undefined;
            
            // 仅在允许折叠时添加折叠按钮
            if (allowCollapse) {
                headingSetting.addExtraButton(btn => {
                    currentToggleBtn = btn;
                    btn.setIcon(isCollapsed ? 'chevron-right' : 'chevron-down')
                        .setTooltip(isCollapsed ? '展开' : '折叠')
                        .onClick(async () => {
                            isCollapsed = !isCollapsed;
                            this.plugin.settings.collapsed[title] = isCollapsed;
                            await this.plugin.saveSettings();
                            btn.setIcon(isCollapsed ? 'chevron-right' : 'chevron-down')
                               .setTooltip(isCollapsed ? '展开' : '折叠');
                            grid.style.display = isCollapsed ? 'none' : 'grid';
                        });
                });
            }

            groups.push({ title, headingEl: headingSetting.settingEl, gridContainer: grid, toggleBtn: currentToggleBtn });
            tabs.forEach(tab => renderSettingItem(grid, tab, isThirdParty));
        };


        if (settingTabs.length > 0) {
            renderSection('选项', settingTabs, false);
        }

        if (corePluginTabs.length > 0) {
            renderSection('核心插件', corePluginTabs, false);
        }

        const categories = this.plugin.settings.categories || {};
        
        const assignedIds = new Set<string>();
        for (const cat in categories) {
            categories[cat].forEach(id => assignedIds.add(id));
        }

        for (const catName in categories) {
            const ids = categories[catName];
            const catTabs = communityPluginTabs.filter(tab => ids.includes(tab.id));
            renderSection(catName, catTabs, true);
        }

        // 剩余未分类的第三方插件
        const otherTabs = communityPluginTabs.filter(tab => !assignedIds.has(tab.id));
        
        // 渲染第三方插件区域 (标题永远固定为“第三方插件”，携带管理按钮，并且不可折叠)
        renderSection('第三方插件', otherTabs, true, { 
            showCategoryBtn: true, 
            allowCollapse: false 
        });

        // ======================= 搜索逻辑 =======================
        let searchTimeout: number;
        searchInput.addEventListener('input', (e) => {
            window.clearTimeout(searchTimeout);
            searchTimeout = window.setTimeout(() => {
                const target = e.target as HTMLInputElement;
                const query = target.value.toLowerCase().trim();
                const isSearching = query.length > 0;

                searchItems.forEach(item => {
                    const customName = item.getCustomName();
                    const match = item.pluginId.includes(query) ||
                        item.originalName.includes(query) ||
                        customName.includes(query);
                    item.settingEl.style.display = match ? 'flex' : 'none';
                });

                groups.forEach(group => {
                    if (isSearching) {
                        const hasVisible = Array.from(group.gridContainer.children).some(el => (el as HTMLElement).style.display !== 'none');
                        group.headingEl.style.display = hasVisible ? '' : 'none';
                        group.gridContainer.style.display = hasVisible ? 'grid' : 'none';
                    } else {
                        group.headingEl.style.display = '';
                        
                        // 只对拥有折叠按钮（允许折叠）的模块处理折叠恢复，第三方插件组保持展开
                        let isCurrentlyCollapsed = false;
                        if (group.toggleBtn) {
                            isCurrentlyCollapsed = this.plugin.settings.collapsed[group.title] || false;
                            group.toggleBtn.setIcon(isCurrentlyCollapsed ? 'chevron-right' : 'chevron-down')
                                           .setTooltip(isCurrentlyCollapsed ? '展开' : '折叠');
                        }
                        group.gridContainer.style.display = isCurrentlyCollapsed ? 'none' : 'grid';
                        
                        Array.from(group.gridContainer.children).forEach(el => (el as HTMLElement).style.display = 'flex');
                    }
                });
            }, 150);
        });
    }
}