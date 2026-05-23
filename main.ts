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
    hiddenCategories: Record<string, boolean>; // 保存分类的全部隐藏状态
    categories: Record<string, string[]>;
    categoryOrder: string[]; 
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
    hiddenCategories: {},
    categories: {},
    categoryOrder: [],
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
// 分类管理弹窗 (支持拖拽排序 & 重命名)
// ============================================================================

class CategoryManagerModal extends Modal {
    plugin: PluginRenamer;
    refreshMainTab: () => void;
    currentView: 'list' | 'edit' = 'list';
    editingCategory: string | null = null;
    renamingCategory: string | null = null;
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

        // 新建分类区域
        const createSection = this.contentEl.createDiv({
            attr: { style: 'background: var(--background-secondary); padding: 15px; border-radius: 8px; margin-bottom: 25px; border: 1px solid var(--background-modifier-border);' }
        });
        
        createSection.createEl('h4', { text: '✨ 新建分类', attr: { style: 'margin-top: 0; margin-bottom: 10px; color: var(--text-normal);' } });

        const createSetting = new Setting(createSection)
            .setName('分类名称')
            .setDesc('创建一个新的分类模块以归纳插件（不可与原生分类同名）')
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
                    const invalidNames = ['选项','核心插件','第三方插件','Options','Core plugins','Community plugins'];
                    if (name && !this.plugin.settings.categories[name] && !invalidNames.includes(name)) {
                        this.plugin.settings.categories[name] = [];
                        this.plugin.settings.categoryOrder.push(name); 
                        await this.plugin.saveSettings();
                        this.tempCategoryName = '';
                        this.display();
                    }
                })
            );
        createSetting.settingEl.style.border = 'none';
        createSetting.settingEl.style.padding = '0';

        const catKeys = this.plugin.settings.categoryOrder.filter(k => this.plugin.settings.categories[k]);
        
        if (catKeys.length > 0) {
            this.contentEl.createEl('h4', { text: '📂 现有分类 (上下拖动可排序)', attr: { style: 'margin-bottom: 15px; padding-bottom: 5px; border-bottom: 1px solid var(--background-modifier-border); color: var(--text-normal);' } });
            
            const listContainer = this.contentEl.createDiv({
                attr: { style: 'display: flex; flex-direction: column; gap: 10px; max-height: 45vh; overflow-y: auto; padding-right: 5px; padding-bottom: 10px;' }
            });

            let draggedCat: string | null = null;

            for (const cat of catKeys) {
                const itemDiv = listContainer.createDiv({
                    attr: { style: 'border: 1px solid var(--background-modifier-border); border-radius: 8px; padding: 12px 15px; background: var(--background-primary); transition: opacity 0.2s ease;' }
                });

                if (this.renamingCategory !== cat) {
                    itemDiv.setAttribute('draggable', 'true');
                    itemDiv.style.cursor = 'grab';

                    itemDiv.addEventListener('dragstart', (e) => {
                        draggedCat = cat;
                        itemDiv.style.opacity = '0.4';
                        e.dataTransfer?.setData('text/plain', cat);
                    });

                    itemDiv.addEventListener('dragend', () => {
                        itemDiv.style.opacity = '1';
                        draggedCat = null;
                        Array.from(listContainer.children).forEach(el => {
                            (el as HTMLElement).style.borderTop = '';
                            (el as HTMLElement).style.borderBottom = '';
                            (el as HTMLElement).style.borderColor = 'var(--background-modifier-border)';
                        });
                    });

                    itemDiv.addEventListener('dragover', (e) => {
                        e.preventDefault();
                        if (draggedCat && draggedCat !== cat) {
                            const bounding = itemDiv.getBoundingClientRect();
                            const offset = bounding.y + bounding.height / 2;
                            if (e.clientY > offset) {
                                itemDiv.style.borderBottom = '2px solid var(--interactive-accent)';
                                itemDiv.style.borderTop = '1px solid var(--background-modifier-border)';
                            } else {
                                itemDiv.style.borderTop = '2px solid var(--interactive-accent)';
                                itemDiv.style.borderBottom = '1px solid var(--background-modifier-border)';
                            }
                        }
                    });

                    itemDiv.addEventListener('dragleave', () => {
                        itemDiv.style.borderTop = '1px solid var(--background-modifier-border)';
                        itemDiv.style.borderBottom = '1px solid var(--background-modifier-border)';
                    });

                    itemDiv.addEventListener('drop', async (e) => {
                        e.preventDefault();
                        if (draggedCat && draggedCat !== cat) {
                            const order = this.plugin.settings.categoryOrder;
                            const fromIndex = order.indexOf(draggedCat);
                            const toIndex = order.indexOf(cat);
                            
                            const bounding = itemDiv.getBoundingClientRect();
                            const offset = bounding.y + bounding.height / 2;
                            let finalIndex = toIndex;
                            if (e.clientY > offset) {
                                finalIndex++; 
                            }

                            order.splice(fromIndex, 1);
                            if (finalIndex > fromIndex) finalIndex--;
                            order.splice(finalIndex, 0, draggedCat);

                            await this.plugin.saveSettings();
                            this.plugin.applyToExistingTabs(); 
                            this.display();
                        }
                    });
                }

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
                                const invalidNames = ['选项','核心插件','第三方插件','Options','Core plugins','Community plugins'];
                                if (newCatName && newCatName !== cat && !this.plugin.settings.categories[newCatName] && !invalidNames.includes(newCatName)) {
                                    this.plugin.settings.categories[newCatName] = this.plugin.settings.categories[cat];
                                    delete this.plugin.settings.categories[cat];
                                    
                                    const orderIdx = this.plugin.settings.categoryOrder.indexOf(cat);
                                    if (orderIdx > -1) this.plugin.settings.categoryOrder[orderIdx] = newCatName;
                                    
                                    if (this.plugin.settings.collapsed[cat] !== undefined) {
                                        this.plugin.settings.collapsed[newCatName] = this.plugin.settings.collapsed[cat];
                                        delete this.plugin.settings.collapsed[cat];
                                    }
                                    if (this.plugin.settings.hiddenCategories[cat] !== undefined) {
                                        this.plugin.settings.hiddenCategories[newCatName] = this.plugin.settings.hiddenCategories[cat];
                                        delete this.plugin.settings.hiddenCategories[cat];
                                    }
                                    
                                    await this.plugin.saveSettings();
                                }
                                this.renamingCategory = null;
                                this.plugin.applyToExistingTabs();
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
                                delete this.plugin.settings.hiddenCategories[cat];
                                this.plugin.settings.categoryOrder = this.plugin.settings.categoryOrder.filter(c => c !== cat);
                                await this.plugin.saveSettings();
                                this.plugin.applyToExistingTabs();
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
                        this.plugin.applyToExistingTabs();
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
            hiddenCategories: { ...DEFAULT_SETTINGS.hiddenCategories, ...(loadedData.hiddenCategories || {}) },
            categories: { ...DEFAULT_SETTINGS.categories, ...(loadedData.categories || {}) },
            categoryOrder: loadedData.categoryOrder || [],
            collapsed: { ...DEFAULT_SETTINGS.collapsed, ...(loadedData.collapsed || {}) }
        };

        const currentKeys = Object.keys(this.settings.categories);
        this.settings.categoryOrder = this.settings.categoryOrder.filter(k => currentKeys.includes(k));
        currentKeys.forEach(k => {
            if (!this.settings.categoryOrder.includes(k)) this.settings.categoryOrder.push(k);
        });
        await this.saveSettings();
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
                            const tabs = node.querySelectorAll<HTMLElement>(".vertical-tab-nav-item[data-setting-id]");
                            if (tabs.length > 0) {
                                tabs.forEach(tab => pendingNodes.add(tab));
                                shouldUpdate = true;
                            }
                        }
                    }
                });
            });

            if (shouldUpdate) {
                if (timeoutId !== null) window.clearTimeout(timeoutId);
                timeoutId = window.setTimeout(() => {
                    this.isApplying = true;
                    pendingNodes.forEach(node => this.applyIconToNavItem(node));
                    this.restructureSidebar(); 
                    pendingNodes.clear();
                    
                    if (this.mutationObserver) {
                        this.mutationObserver.takeRecords(); 
                    }
                    this.isApplying = false;
                }, 10);
            }
        });

        this.mutationObserver.observe(header, { childList: true, subtree: true });
    }

    getPluginCategoryMap(): Record<string, string> {
        const map: Record<string, string> = {};
        const settingTabs = this.internalApp.setting.settingTabs || [];
        settingTabs.forEach(tab => map[tab.id] = '选项');

        const pluginTabs = this.internalApp.setting.pluginTabs || [];
        const manifests = this.internalApp.plugins.manifests || {};
        
        pluginTabs.forEach(tab => {
            if (!manifests[tab.id]) {
                map[tab.id] = '核心插件';
            } else {
                let assigned = false;
                for (const catName of this.settings.categoryOrder) {
                    if (this.settings.categories[catName]?.includes(tab.id)) {
                        map[tab.id] = catName;
                        assigned = true;
                        break;
                    }
                }
                if (!assigned) {
                    map[tab.id] = '第三方插件';
                }
            }
        });
        return map;
    }

    applyToExistingTabs() {
        const header = document.querySelector('.vertical-tab-header');
        if (!header) return;

        this.isApplying = true;
        header.querySelectorAll<HTMLElement>(".vertical-tab-nav-item[data-setting-id]").forEach(tabEl => {
            this.applyIconToNavItem(tabEl);
        });
        this.restructureSidebar(); 
        
        if (this.mutationObserver) {
            this.mutationObserver.takeRecords();
        }
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

        const categoryMap = this.getPluginCategoryMap();
        const category = categoryMap[pluginId] || '';
        const isCategoryHidden = this.settings.hiddenCategories[category] || false;

        const isHidden = this.settings.hidden[pluginId] || isCategoryHidden;

        if (isHidden && !isSelf) {
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

    // ======================= 左侧边栏重构逻辑 =======================
    restructureSidebar() {
        const headerContainer = document.querySelector('.vertical-tab-header');
        if (!headerContainer) return;

        const manifests = this.internalApp.plugins.manifests;
        const categoryMap = this.getPluginCategoryMap();

        // 1. 将已经被挂载到自定义分类里的插件，临时重置回原生的第三方插件 group 中，防止丢失
        const nativeCommunityGroup = Array.from(headerContainer.querySelectorAll<HTMLElement>('.vertical-tab-header-group:not(.custom-category-group)')).find(group => {
            const titleEl = group.querySelector('.vertical-tab-header-group-title');
            return titleEl && (titleEl.textContent?.includes('第三方插件') || titleEl.textContent?.includes('Community plugins'));
        });

        if (nativeCommunityGroup) {
            headerContainer.querySelectorAll('.custom-category-group .vertical-tab-nav-item').forEach(tab => {
                nativeCommunityGroup.appendChild(tab);
            });
        }

        // 2. 清理旧的注入组
        headerContainer.querySelectorAll('.custom-category-group').forEach(el => el.remove());

        // 3. 寻找所有插件项
        const allTabs = Array.from(headerContainer.querySelectorAll<HTMLElement>('.vertical-tab-nav-item'));
        const communityTabs = allTabs.filter(tab => {
            const id = tab.getAttribute('data-setting-id');
            return id && manifests[id]; 
        });

        // 定位原生第三方插件之后的插入点，保证新分组都跟在“第三方插件”下方
        let insertAnchor = nativeCommunityGroup ? nativeCommunityGroup.nextSibling : null;

        // 4. 为每个分类创建标准的 group 结构并挂载 (这次去掉标题，只留白)
        this.settings.categoryOrder.forEach(catName => {
            const pluginIds = this.settings.categories[catName] || [];
            if (pluginIds.length === 0) return;

            const tabsForCategory = pluginIds.map(id => 
                communityTabs.find(t => t.getAttribute('data-setting-id') === id)
            ).filter(t => t !== undefined) as HTMLElement[];

            if (tabsForCategory.length === 0) return;

            // 像原生一样赋予 vertical-tab-header-group 容器，以此利用其默认的 padding 形成留白
            const groupEl = document.createElement('div');
            groupEl.className = 'vertical-tab-header-group custom-category-group';
            
            const isCategoryHidden = this.settings.hiddenCategories[catName] || false;
            if (isCategoryHidden) {
                groupEl.style.display = 'none';
            }

            // 注意：取消此处对 custom-category-header 的创建，只作纯间距容器

            tabsForCategory.forEach(tab => {
                groupEl.appendChild(tab);
            });

            // 顺序插入保证了排序的一致性
            if (insertAnchor) {
                headerContainer.insertBefore(groupEl, insertAnchor);
            } else {
                headerContainer.appendChild(groupEl);
            }
        });

        // 5. 处理官方原生包含外层容器的情况
        const nativeGroups = Array.from(headerContainer.querySelectorAll<HTMLElement>('.vertical-tab-header-group:not(.custom-category-group)'));
        
        nativeGroups.forEach(group => {
            const titleEl = group.querySelector<HTMLElement>('.vertical-tab-header-group-title');
            const firstTab = group.querySelector<HTMLElement>('.vertical-tab-nav-item');
            
            let catName = '';
            
            if (firstTab) {
                const settingId = firstTab.getAttribute('data-setting-id');
                if (settingId) {
                    catName = categoryMap[settingId] || '';
                }
            } 
            if (!catName && titleEl) {
                const text = titleEl.textContent || '';
                if (text.includes('核心插件') || text.includes('Core')) catName = '核心插件';
                else if (text.includes('第三方插件') || text.includes('Community')) catName = '第三方插件';
                else if (text.includes('选项') || text.includes('Options')) catName = '选项';
            }

            if (catName) {
                const isCategoryHidden = this.settings.hiddenCategories[catName] || false;
                
                // 核心改动：如果该组是“第三方插件”，永远不要隐藏，以此保留“第三方插件”这几个字
                if (catName === '第三方插件') {
                    group.style.display = '';
                } else if (isCategoryHidden) {
                    group.style.display = 'none'; // 彻底隐藏其它原生的外层容器
                } else {
                    group.style.display = '';
                }
            }
        });
    }

    restoreExistingTabs() {
        const headerContainer = document.querySelector('.vertical-tab-header');
        
        if (headerContainer) {
            const nativeCommunityGroup = Array.from(headerContainer.querySelectorAll<HTMLElement>('.vertical-tab-header-group:not(.custom-category-group)')).find(group => {
                const titleEl = group.querySelector('.vertical-tab-header-group-title');
                return titleEl && (titleEl.textContent?.includes('第三方插件') || titleEl.textContent?.includes('Community plugins'));
            });

            if (nativeCommunityGroup) {
                headerContainer.querySelectorAll('.custom-category-group .vertical-tab-nav-item').forEach(tab => {
                    nativeCommunityGroup.appendChild(tab);
                });
            }

            headerContainer.querySelectorAll('.custom-category-group').forEach(el => el.remove());
            
            const allGroups = headerContainer.querySelectorAll<HTMLElement>('.vertical-tab-header-group');
            allGroups.forEach(g => g.style.display = '');
        }

        const allTabs = document.querySelectorAll<HTMLElement>(".vertical-tab-nav-item[data-setting-id]");
        
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
        topHeaderContainer.style.alignItems = 'center'; 
        topHeaderContainer.style.flexWrap = 'wrap';
        topHeaderContainer.style.gap = '15px';
        topHeaderContainer.style.marginBottom = '25px';

        const titleArea = topHeaderContainer.createDiv();
        titleArea.createEl('h2', { text: '⚙️ 插件名称与图标自定义', cls: 'setting-item-heading', attr: { style: 'border: none; margin: 0;' } });
        titleArea.createEl('p', { text: '点击眼睛隐藏/显示，中间改图标，右侧改名称。可分类管理。', cls: "setting-item-description", attr: { style: 'margin: 5px 0 0 0;' } });

        const actionArea = topHeaderContainer.createDiv({ attr: { style: 'display: flex; gap: 10px; align-items: center;' }});

        const catBtnEl = actionArea.createEl('button', { cls: 'clickable-icon', attr: { 'aria-label': '管理插件分类' }});
        setIcon(catBtnEl, 'folder-cog');
        catBtnEl.addEventListener('click', () => new CategoryManagerModal(this.app, this.plugin, () => this.display()).open());

        const searchInput = actionArea.createEl('input', {
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

        const renderSection = (title: string, tabs: SettingTabItem[], isThirdParty: boolean, allowCollapse: boolean = true) => {
            if (tabs.length === 0) return; 

            const headingSetting = new Setting(mainContentEl).setName(title).setHeading();
            const grid = createGridContainer(mainContentEl);
            
            let isCollapsed = allowCollapse ? (this.plugin.settings.collapsed[title] || false) : false;
            grid.style.display = isCollapsed ? 'none' : 'grid';

            let currentToggleBtn: ExtraButtonComponent | undefined;

            if (title !== '选项') {
                const isCategoryHidden = this.plugin.settings.hiddenCategories[title] || false;
                
                headingSetting.addExtraButton(btn => {
                    btn.setIcon(isCategoryHidden ? 'eye-off' : 'eye')
                        .setTooltip(isCategoryHidden ? '取消全部隐藏 (在侧边栏恢复显示)' : '全部隐藏 (在侧边栏隐藏该分类及内容)')
                        .onClick(async () => {
                            const currentlyHidden = this.plugin.settings.hiddenCategories[title] || false;
                            this.plugin.settings.hiddenCategories[title] = !currentlyHidden;
                            await this.plugin.saveSettings();
                            btn.setIcon(!currentlyHidden ? 'eye-off' : 'eye')
                               .setTooltip(!currentlyHidden ? '取消全部隐藏 (在侧边栏恢复显示)' : '全部隐藏 (在侧边栏隐藏该分类及内容)');
                            
                            this.plugin.applyToExistingTabs();
                        });
                });
            }

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
        
        for (const catName of this.plugin.settings.categoryOrder) {
            const ids = categories[catName] || [];
            ids.forEach(id => assignedIds.add(id));
            const catTabs = communityPluginTabs.filter(tab => ids.includes(tab.id));
            renderSection(catName, catTabs, true);
        }

        const otherTabs = communityPluginTabs.filter(tab => !assignedIds.has(tab.id));
        renderSection('第三方插件', otherTabs, true, false);

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