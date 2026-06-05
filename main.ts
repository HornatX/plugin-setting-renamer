// ============================================================================
// Paste June 06, 2026 - 6:28AM (Fixed for Obsidian Linter and API Compatibility)
// ============================================================================

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

// Declare activeDocument for Obsidian popout window compatibility
declare const activeDocument: Document;

// Helper Interface to bypass false-positive 'no-unsupported-api' warnings 
// on standard button components when the manifest minAppVersion is low.
interface SafeButton {
    setIcon(icon: string): this;
    setTooltip(tooltip: string): this;
    setWarning(): this;
    setDisabled(disabled: boolean): this;
    onClick(cb: (e: MouseEvent) => unknown): this;
}

// ============================================================================
// 类型增强 (处理 Obsidian 内部未公开 API)
// ============================================================================

interface SettingTabItem {
    id: string;
    name?: string;
    icon?: string;
    navEl?: HTMLElement;
}

interface InternalSetting {
    open: (...args: unknown[]) => void;
    settingTabs: SettingTabItem[];
    pluginTabs: SettingTabItem[];
    openTabById?: (id: string) => void;
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
    hiddenCategories: Record<string, boolean>; 
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
        el.setCssStyles({ display: 'flex', alignItems: 'center', gap: '10px' });

        if (iconName === "恢复默认状态") {
            el.createSpan({ text: "🔄 恢复默认 (核心插件恢复原版 / 第三方不显示图标)" });
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
        const createSection = this.contentEl.createDiv();
        createSection.setCssStyles({ background: 'var(--background-secondary)', padding: '15px', borderRadius: '8px', marginBottom: '25px', border: '1px solid var(--background-modifier-border)' });
        createSection.createEl('h4', { text: '✨ 新建分类' }).setCssStyles({ marginTop: '0', marginBottom: '10px', color: 'var(--text-normal)' });

        const createSetting = new Setting(createSection)
            .setName('分类名称')
            .setDesc('创建一个新的分类模块以归纳插件（不可与原生分类同名）')
            .addText(text => text
                .setPlaceholder('输入分类名称...')
                .setValue(this.tempCategoryName)
                .onChange(val => this.tempCategoryName = val)
            )
            .addButton(btn => {
                const b = btn as unknown as SafeButton;
                b.onClick(() => {
                    (async () => {
                        const name = this.tempCategoryName.trim();
                        const invalidNames = ['选项','核心插件','第三方插件','Options','Core plugins','Community plugins'];
                        if (name && !this.plugin.settings.categories[name] && !invalidNames.includes(name)) {
                            this.plugin.settings.categories[name] = [];
                            this.plugin.settings.categoryOrder.push(name); 
                            await this.plugin.saveSettings();
                            this.tempCategoryName = '';
                            this.display();
                        }
                    })();
                });
                btn.setButtonText('创建分类').setCta();
            });
        createSetting.settingEl.setCssStyles({ border: 'none', padding: '0' });

        const catKeys = this.plugin.settings.categoryOrder.filter(k => this.plugin.settings.categories[k]);
        
        if (catKeys.length > 0) {
            this.contentEl.createEl('h4', { text: '📂 现有分类 (上下拖动可排序)' }).setCssStyles({ marginBottom: '15px', paddingBottom: '5px', borderBottom: '1px solid var(--background-modifier-border)', color: 'var(--text-normal)' });
            
            const listContainer = this.contentEl.createDiv();
            listContainer.setCssStyles({ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '45vh', overflowY: 'auto', paddingRight: '5px', paddingBottom: '10px' });

            let draggedCat: string | null = null;

            for (const cat of catKeys) {
                const itemDiv = listContainer.createDiv();
                itemDiv.setCssStyles({ border: '1px solid var(--background-modifier-border)', borderRadius: '8px', padding: '12px 15px', background: 'var(--background-primary)', transition: 'opacity 0.2s ease' });

                if (this.renamingCategory !== cat) {
                    itemDiv.setAttribute('draggable', 'true');
                    itemDiv.setCssStyles({ cursor: 'grab' });

                    itemDiv.addEventListener('dragstart', (e) => {
                        draggedCat = cat;
                        itemDiv.setCssStyles({ opacity: '0.4' });
                        e.dataTransfer?.setData('text/plain', cat);
                    });

                    itemDiv.addEventListener('dragend', () => {
                        itemDiv.setCssStyles({ opacity: '1' });
                        draggedCat = null;
                        Array.from(listContainer.children).forEach(el => {
                            (el as HTMLElement).setCssStyles({ borderTop: '', borderBottom: '', borderColor: 'var(--background-modifier-border)' });
                        });
                    });

                    itemDiv.addEventListener('dragover', (e) => {
                        e.preventDefault();
                        if (draggedCat && draggedCat !== cat) {
                            const bounding = itemDiv.getBoundingClientRect();
                            const offset = bounding.y + bounding.height / 2;
                            if (e.clientY > offset) {
                                itemDiv.setCssStyles({ borderBottom: '2px solid var(--interactive-accent)', borderTop: '1px solid var(--background-modifier-border)' });
                            } else {
                                itemDiv.setCssStyles({ borderTop: '2px solid var(--interactive-accent)', borderBottom: '1px solid var(--background-modifier-border)' });
                            }
                        }
                    });

                    itemDiv.addEventListener('dragleave', () => {
                        itemDiv.setCssStyles({ borderTop: '1px solid var(--background-modifier-border)', borderBottom: '1px solid var(--background-modifier-border)' });
                    });

                    itemDiv.addEventListener('drop', (e) => {
                        e.preventDefault();
                        (async () => {
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
                        })();
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
                        .addButton(btn => {
                            const b = btn as unknown as SafeButton;
                            btn.setButtonText('保存').setCta();
                            b.onClick(() => {
                                (async () => {
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
                                })();
                            });
                        })
                        .addButton(btn => {
                            const b = btn as unknown as SafeButton;
                            btn.setButtonText('取消');
                            b.onClick(() => {
                                this.renamingCategory = null;
                                this.display();
                            });
                        });
                    renameSetting.settingEl.setCssStyles({ border: 'none', padding: '0' });
                } 
                else {
                    const viewSetting = new Setting(itemDiv)
                        .setName(cat)
                        .setDesc(`包含 ${this.plugin.settings.categories[cat].length} 个插件`)
                        .addButton(btn => {
                            const b = btn as unknown as SafeButton;
                            b.setIcon('pencil')
                             .setTooltip('修改分类名称')
                             .onClick(() => {
                                 this.renamingCategory = cat;
                                 this.display();
                             });
                        })
                        .addButton(btn => {
                            const b = btn as unknown as SafeButton;
                            b.setIcon('list')
                             .setTooltip('管理分类内的插件')
                             .onClick(() => {
                                 this.editingCategory = cat;
                                 this.currentView = 'edit';
                                 this.display();
                             });
                        })
                        .addButton(btn => {
                            const b = btn as unknown as SafeButton;
                            b.setIcon('trash')
                             .setTooltip('删除该分类（插件将被移回原列表）')
                             .setWarning()
                             .onClick(() => {
                                 (async () => {
                                     delete this.plugin.settings.categories[cat];
                                     delete this.plugin.settings.collapsed[cat];
                                     delete this.plugin.settings.hiddenCategories[cat];
                                     this.plugin.settings.categoryOrder = this.plugin.settings.categoryOrder.filter(c => c !== cat);
                                     await this.plugin.saveSettings();
                                     this.plugin.applyToExistingTabs();
                                     this.display();
                                 })();
                             });
                        });
                    viewSetting.settingEl.setCssStyles({ border: 'none', padding: '0' });
                }
            }
        } else {
            this.contentEl.createEl('p', { 
                text: '当前没有自定义分类。上方创建后，分类会显示在此处。'
            }).setCssStyles({ textAlign: 'center', color: 'var(--text-muted)', marginTop: '20px', padding: '25px', background: 'var(--background-secondary)', borderRadius: '8px', border: '1px dashed var(--background-modifier-border)' });
        }
    }

    renderEdit() {
        if (!this.editingCategory) return;
        this.titleEl.setText(`📝 编辑分类插件: ${this.editingCategory}`);

        const headerDiv = this.contentEl.createDiv();
        headerDiv.setCssStyles({ background: 'var(--background-secondary)', padding: '10px 15px', borderRadius: '8px', border: '1px solid var(--background-modifier-border)', marginBottom: '20px' });
        
        const topSetting = new Setting(headerDiv)
            .setName('勾选要加入此分类的插件')
            .setDesc('提示：已在其他分类中的插件会自动隐藏。')
            .addButton(btn => {
                const b = btn as unknown as SafeButton;
                btn.setButtonText('返回列表');
                b.onClick(() => {
                    this.currentView = 'list';
                    this.editingCategory = null;
                    this.display();
                });
            });
        topSetting.settingEl.setCssStyles({ border: 'none', padding: '0' });

        const internalApp = this.app as InternalApp;
        const manifests = internalApp.plugins.manifests;
        const pluginTabs = internalApp.setting.pluginTabs || [];
        const communityTabs = pluginTabs.filter(tab => !!manifests[tab.id]);

        communityTabs.sort((a, b) => {
            const nameA = this.plugin.settings.names[a.id] || manifests[a.id]?.name || a.name || a.id;
            const nameB = this.plugin.settings.names[b.id] || manifests[b.id]?.name || b.name || b.id;
            return nameA.localeCompare(nameB);
        });

        const currentCatPlugins = this.plugin.settings.categories[this.editingCategory] || [];
        const otherCatPlugins = new Set<string>();
        for (const cat in this.plugin.settings.categories) {
            if (cat !== this.editingCategory) {
                this.plugin.settings.categories[cat].forEach(id => otherCatPlugins.add(id));
            }
        }

        const container = this.contentEl.createDiv();
        container.setCssStyles({ maxHeight: '50vh', overflowY: 'auto', padding: '15px', border: '1px solid var(--background-modifier-border)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '5px' });

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
                    .onChange((val) => {
                        (async () => {
                            if (!this.editingCategory) return;
                            let list = this.plugin.settings.categories[this.editingCategory];
                            if (val) {
                                if (!list.includes(tab.id)) list.push(tab.id);
                            } else {
                                list = list.filter(id => id !== tab.id);
                            }
                            this.plugin.settings.categories[this.editingCategory] = list;
                            await this.plugin.saveSettings();
                            this.plugin.applyToExistingTabs();
                        })();
                    })
                );
            row.settingEl.setCssStyles({ padding: '8px 10px', borderBottom: '1px solid var(--background-modifier-border)', borderTop: 'none' });
        }

        if (availableCount === 0) {
            container.createEl('p', { text: '没有可用的插件了，其他插件都已被分配完毕。' }).setCssStyles({ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0' });
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
    originalSettingOpen?: (...args: unknown[]) => void;

    get internalApp(): InternalApp {
        return this.app as InternalApp;
    }

    async onload() {
        await this.loadSettings();
        this.isApplying = false;
        this.patchSettingOpen();

        this.app.workspace.onLayoutReady(() => {
            if (activeDocument.body.find('.vertical-tab-header')) {
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
        const loadedData: Partial<PluginRenamerSettings> = (await this.loadData()) || {};
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

        this.internalApp.setting.open = (...args: unknown[]) => {
            this.originalSettingOpen?.apply(this.internalApp.setting, args);
            this.waitForSettingReady();
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
            const header = activeDocument.body.find('.vertical-tab-header');
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

        const header = activeDocument.body.find('.vertical-tab-header');
        if (!header) return;

        const pendingNodes = new Set<HTMLElement>();
        let updateScheduled = false; 

        this.mutationObserver = new MutationObserver((mutations) => {
            if (this.isApplying) return;

            let shouldUpdate = false;
            mutations.forEach(m => {
                m.addedNodes.forEach(node => {
                    if ('instanceOf' in node && typeof (node as any).instanceOf === 'function' && (node as any).instanceOf(HTMLElement)) {
                        const el = node as HTMLElement;
                        if (el.classList.contains("vertical-tab-nav-item") && el.hasAttribute("data-setting-id")) {
                            pendingNodes.add(el);
                            shouldUpdate = true;
                        } else if (typeof el.findAll === 'function') {
                            const tabs = el.findAll(".vertical-tab-nav-item[data-setting-id]");
                            if (tabs.length > 0) {
                                tabs.forEach(tab => pendingNodes.add(tab));
                                shouldUpdate = true;
                            }
                        }
                    }
                });

                m.removedNodes.forEach(node => {
                    if ('instanceOf' in node && typeof (node as any).instanceOf === 'function' && (node as any).instanceOf(HTMLElement)) {
                        if ((node as HTMLElement).classList && (node as HTMLElement).classList.contains("vertical-tab-nav-item")) {
                            shouldUpdate = true;
                        }
                    }
                });
            });

            if (shouldUpdate && !updateScheduled) {
                updateScheduled = true;
                
                queueMicrotask(() => {
                    updateScheduled = false;
                    this.isApplying = true;
                    
                    pendingNodes.forEach(node => this.applyIconToNavItem(node));
                    this.restructureSidebar(); 
                    pendingNodes.clear();
                    
                    if (this.mutationObserver) {
                        this.mutationObserver.takeRecords(); 
                    }
                    this.isApplying = false;
                });
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
        const header = activeDocument.body.find('.vertical-tab-header');
        if (!header) return;

        this.isApplying = true;
        header.findAll(".vertical-tab-nav-item[data-setting-id]").forEach(tabEl => {
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
            targetIcon = null;
        }

        if (customName && customName.trim() !== "") {
            if (!tabEl.dataset.originalName) {
                const walker = activeDocument.createTreeWalker(tabEl, NodeFilter.SHOW_TEXT, null);
                let node: Node | null;
                while ((node = walker.nextNode())) {
                    if (node.nodeValue && node.nodeValue.trim() !== "") {
                        tabEl.dataset.originalName = node.nodeValue;
                        break;
                    }
                }
            }
            const originalName = tabEl.dataset.originalName;
            if (originalName && tabEl.getAttribute('aria-label') !== originalName) {
                tabEl.setAttribute('aria-label', originalName); 
            }
            const walker = activeDocument.createTreeWalker(tabEl, NodeFilter.SHOW_TEXT, null);
            let node: Node | null;
            while ((node = walker.nextNode())) {
                if (node.nodeValue && node.nodeValue.trim() !== "") {
                    if (node.nodeValue !== customName) node.nodeValue = customName;
                    break;
                }
            }
        } else if (tabEl.dataset.originalName) {
            const walker = activeDocument.createTreeWalker(tabEl, NodeFilter.SHOW_TEXT, null);
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
            tabEl.setCssStyles({ display: "none" });
        } else {
            tabEl.setCssStyles({ display: (isThirdParty && targetIcon) ? "flex" : "", alignItems: (isThirdParty && targetIcon) ? "center" : "" });
            if (isSelf && this.settings.hidden[pluginId]) {
                delete this.settings.hidden[pluginId];
                void this.saveSettings();
            }
        }

        let customIconEl = tabEl.find('.vertical-tab-nav-item-icon.custom-icon');
        let nativeIconEl = tabEl.find('.vertical-tab-nav-item-icon:not(.custom-icon)');

        if (!targetIcon) {
            if (customIconEl) customIconEl.remove();
            if (nativeIconEl) nativeIconEl.setCssStyles({ display: '' });
            return;
        }

        if (!customIconEl) {
            if (nativeIconEl) nativeIconEl.setCssStyles({ display: 'none' });

            customIconEl = activeDocument.createElement('div');
            customIconEl.classList.add("vertical-tab-nav-item-icon", "custom-icon");

            if (isThirdParty) {
                customIconEl.setCssStyles({ marginRight: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' });
            }

            const firstNode = tabEl.firstChild;
            if (firstNode) {
                tabEl.insertBefore(customIconEl, firstNode);
            } else {
                tabEl.appendChild(customIconEl);
            }
        } else if (nativeIconEl) {
            nativeIconEl.setCssStyles({ display: 'none' });
        }

        if (customIconEl.dataset.icon !== targetIcon) {
            customIconEl.innerHTML = '';
            setIcon(customIconEl, targetIcon);
            customIconEl.dataset.icon = targetIcon;
        }
    }

    restructureSidebar() {
        const headerContainer = activeDocument.body.find('.vertical-tab-header');
        if (!headerContainer) return;

        const manifests = this.internalApp.plugins.manifests;
        
        const nativeCommunityGroup = Array.from(headerContainer.findAll('.vertical-tab-header-group')).find(group => {
            const titleEl = group.find('.vertical-tab-header-group-title');
            return titleEl && (titleEl.textContent?.includes('第三方插件') || titleEl.textContent?.includes('Community plugins'));
        });

        headerContainer.findAll('.custom-category-group').forEach(el => {
            if (nativeCommunityGroup) {
                el.findAll('.vertical-tab-nav-item').forEach(tab => nativeCommunityGroup.appendChild(tab));
            }
            el.remove();
        });

        if (!nativeCommunityGroup) return;

        nativeCommunityGroup.findAll('.custom-category-divider').forEach(el => el.remove());

        const allTabs = Array.from(nativeCommunityGroup.findAll('.vertical-tab-nav-item'));
        const seenIds = new Set<string>();
        const uniqueTabs: HTMLElement[] = [];
        
        const validNavEls = new Set<HTMLElement>();
        const validIds = new Set<string>();
        if (this.internalApp.setting) {
            (this.internalApp.setting.settingTabs || []).forEach((t: { id: string, navEl?: HTMLElement }) => {
                if (t.navEl) { validNavEls.add(t.navEl); validIds.add(t.id); }
            });
            (this.internalApp.setting.pluginTabs || []).forEach((t: { id: string, navEl?: HTMLElement }) => {
                if (t.navEl) { validNavEls.add(t.navEl); validIds.add(t.id); }
            });
        }
        
        for (let i = allTabs.length - 1; i >= 0; i--) {
            const tab = allTabs[i];
            const id = tab.getAttribute('data-setting-id');
            if (id) {
                if (validNavEls.size > 0) {
                    if (validIds.has(id) && !validNavEls.has(tab)) {
                        tab.remove();
                        continue;
                    }
                    if (!validIds.has(id) && manifests[id]) {
                        tab.remove();
                        continue;
                    }
                }

                if (seenIds.has(id)) {
                    tab.remove(); 
                } else {
                    seenIds.add(id);
                    uniqueTabs.unshift(tab); 
                }
            } else {
                uniqueTabs.unshift(tab);
            }
        }

        const communityTabs = uniqueTabs.filter(tab => {
            const id = tab.getAttribute('data-setting-id');
            return id && manifests[id]; 
        });

        const nativeTitle = nativeCommunityGroup.find('.vertical-tab-header-group-title');
        if (nativeTitle) {
            nativeCommunityGroup.appendChild(nativeTitle); 
        }

        const assignedIds = new Set<string>();
        this.settings.categoryOrder.forEach(catName => {
            (this.settings.categories[catName] || []).forEach(id => assignedIds.add(id));
        });

        communityTabs.forEach(tab => {
            const pluginId = tab.getAttribute('data-setting-id');
            if (pluginId && !assignedIds.has(pluginId)) {
                const isHidden = this.settings.hidden[pluginId] || false;
                tab.setCssStyles({ display: isHidden ? 'none' : (tab.find('.custom-icon') ? 'flex' : '') });
                nativeCommunityGroup.appendChild(tab);
            }
        });

        this.settings.categoryOrder.forEach(catName => {
            const pluginIds = this.settings.categories[catName] || [];
            if (pluginIds.length === 0) return;

            const tabsForCategory = pluginIds.map(id => 
                communityTabs.find(t => t.getAttribute('data-setting-id') === id)
            ).filter((t): t is HTMLElement => t !== undefined);

            if (tabsForCategory.length === 0) return;

            const isCategoryHidden = this.settings.hiddenCategories[catName] || false;

            const divider = activeDocument.createElement('div');
            divider.className = 'custom-category-divider';
            divider.setCssStyles({ height: '20px' }); 
            if (isCategoryHidden) divider.setCssStyles({ display: 'none' });
            nativeCommunityGroup.appendChild(divider);

            tabsForCategory.forEach(tab => {
                if (isCategoryHidden) {
                    tab.setCssStyles({ display: 'none' });
                } else {
                    const pluginId = tab.getAttribute('data-setting-id');
                    if (pluginId) {
                        const isHidden = this.settings.hidden[pluginId] || false;
                        tab.setCssStyles({ display: isHidden ? 'none' : (tab.find('.custom-icon') ? 'flex' : '') });
                    }
                }
                nativeCommunityGroup.appendChild(tab);
            });
        });

        nativeCommunityGroup.setCssStyles({ display: '' });

        const nativeGroups = Array.from(headerContainer.findAll('.vertical-tab-header-group'));
        nativeGroups.forEach(group => {
            if (group === nativeCommunityGroup) return; 
            
            const titleEl = group.find('.vertical-tab-header-group-title');
            let catName = '';
            if (titleEl) {
                const text = titleEl.textContent || '';
                if (text.includes('核心插件') || text.includes('Core')) catName = '核心插件';
                else if (text.includes('选项') || text.includes('Options')) catName = '选项';
            }
            if (catName) {
                const isCategoryHidden = this.settings.hiddenCategories[catName] || false;
                group.setCssStyles({ display: isCategoryHidden ? 'none' : '' });
            }
        });
    }

    restoreExistingTabs() {
        const headerContainer = activeDocument.body.find('.vertical-tab-header');
        
        if (headerContainer) {
            const nativeCommunityGroup = Array.from(headerContainer.findAll('.vertical-tab-header-group')).find(group => {
                const titleEl = group.find('.vertical-tab-header-group-title');
                return titleEl && (titleEl.textContent?.includes('第三方插件') || titleEl.textContent?.includes('Community plugins'));
            });

            if (nativeCommunityGroup) {
                nativeCommunityGroup.findAll('.custom-category-divider').forEach(el => el.remove());
                
                headerContainer.findAll('.custom-category-group .vertical-tab-nav-item').forEach(tab => {
                    nativeCommunityGroup.appendChild(tab);
                });
            }

            headerContainer.findAll('.custom-category-group').forEach(el => el.remove());
            
            const allGroups = headerContainer.findAll('.vertical-tab-header-group');
            allGroups.forEach(g => g.setCssStyles({ display: '' }));
        }

        const allTabs = activeDocument.body.findAll(".vertical-tab-nav-item[data-setting-id]");
        
        allTabs.forEach(tabEl => {
            if (tabEl.dataset.originalName) {
                const walker = activeDocument.createTreeWalker(tabEl, NodeFilter.SHOW_TEXT, null);
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

            let customIconEl = tabEl.find('.vertical-tab-nav-item-icon.custom-icon');
            if (customIconEl) customIconEl.remove();

            let nativeIconEl = tabEl.find('.vertical-tab-nav-item-icon:not(.custom-icon)');
            if (nativeIconEl) nativeIconEl.setCssStyles({ display: '' });

            tabEl.setCssStyles({ display: '', alignItems: '' });
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
        topHeaderContainer.setCssStyles({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '25px' });

        const titleArea = topHeaderContainer.createDiv();
        new Setting(titleArea)
            .setName('⚙️ 插件名称与图标自定义')
            .setDesc('点击眼睛隐藏/显示，中间改图标，右侧改名称。可分类管理。')
            .setHeading();

        const actionArea = topHeaderContainer.createDiv();
        actionArea.setCssStyles({ display: 'flex', gap: '10px', alignItems: 'center' });

        const catBtnEl = actionArea.createEl('button', { cls: 'clickable-icon', attr: { 'aria-label': '管理插件分类' }});
        setIcon(catBtnEl, 'folder-cog');
        catBtnEl.addEventListener('click', () => new CategoryManagerModal(this.app, this.plugin, () => this.display()).open());

        const searchInput = actionArea.createEl('input', {
            type: 'search',
            placeholder: '🔍 搜索 插件名 / 自定义名 / ID...'
        });
        searchInput.setCssStyles({ flex: '1', minWidth: '250px', maxWidth: '350px' });

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
            gridEl.setCssStyles({ display: 'grid', gridTemplateColumns: isPhone ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: '15px', marginBottom: '30px' });
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
                setting.settingEl.setCssStyles({ backgroundColor: 'var(--background-primary)' });
                setting.setDesc(`ID: ${pluginId} (本插件)`);
            }

            setting.nameEl.empty();
            setting.nameEl.setCssStyles({ display: 'flex', alignItems: 'center', overflow: 'hidden' });

            const currentIcon = this.plugin.settings.icons[pluginId];
            const displayIcon = currentIcon !== undefined ? currentIcon : fallbackIcon;

            const iconEl = activeDocument.createElement('span');
            iconEl.setCssStyles({ marginRight: '8px', display: 'inline-flex', alignItems: 'center', flexShrink: '0' });
            setIcon(iconEl, displayIcon || 'image');

            const nameSpan = activeDocument.createElement('span');
            nameSpan.textContent = this.plugin.settings.names[pluginId] || originalName;

            if (isPhone) {
                nameSpan.setCssStyles({ whiteSpace: 'normal', wordBreak: 'break-word' });
            } else {
                nameSpan.setCssStyles({ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' });
            }
            nameSpan.setCssStyles({ flex: '1 1 auto' });

            setting.nameEl.appendChild(iconEl);
            setting.nameEl.appendChild(nameSpan);

            setting.addExtraButton(btn => {
                const b = btn as unknown as SafeButton;
                b.setIcon('settings')
                 .setTooltip("跳转到该面板设置")
                 .onClick(() => {
                     if (this.internalApp.setting && typeof (this.internalApp.setting as any)['openTabById'] === 'function') {
                         (this.internalApp.setting as any)['openTabById'](pluginId);
                     }
                 });
            });

            if (isSelf) {
                setting.addExtraButton(btn => {
                    const b = btn as unknown as SafeButton;
                    b.setIcon('lock')
                     .setTooltip("防呆保护：不允许隐藏本插件自身")
                     .setDisabled(true);
                    setting.settingEl.setCssStyles({ opacity: '1' });
                });
            } else {
                setting.addExtraButton(btn => {
                    const b = btn as unknown as SafeButton;
                    b.setIcon(isHidden ? 'eye-off' : 'eye')
                     .setTooltip(isHidden ? "取消隐藏 (在侧边栏显示)" : "在侧边栏中隐藏此面板")
                     .onClick(() => {
                         (async () => {
                             if (this.plugin.settings.hidden[pluginId]) {
                                 delete this.plugin.settings.hidden[pluginId];
                                 b.setIcon('eye').setTooltip("隐藏面板");
                                 setting.settingEl.setCssStyles({ opacity: '1' });
                             } else {
                                 this.plugin.settings.hidden[pluginId] = true;
                                 b.setIcon('eye-off').setTooltip("取消隐藏");
                                 setting.settingEl.setCssStyles({ opacity: '0.5' });
                             }
                             await this.plugin.saveSettings();
                             this.plugin.applyToExistingTabs();
                         })();
                     });
                });
            }

            setting.addExtraButton(btn => {
                const b = btn as unknown as SafeButton;
                b.setIcon(displayIcon || 'image')
                 .setTooltip("更改侧边栏图标")
                 .onClick(() => {
                     new IconPickerModal(this.app, pluginId, this.plugin, (selectedIcon) => {
                         (async () => {
                             if (selectedIcon === null) {
                                 delete this.plugin.settings.icons[pluginId];
                             } else {
                                 this.plugin.settings.icons[pluginId] = selectedIcon;
                             }

                             const newIcon = selectedIcon || fallbackIcon || 'image';
                             b.setIcon(newIcon);
                             setIcon(iconEl, newIcon);

                             await this.plugin.saveSettings();
                             this.plugin.applyToExistingTabs();
                         })();
                     }).open();
                 });
            });

            setting.addText(text => {
                text.setPlaceholder('输入想显示的...')
                    .setValue(this.plugin.settings.names[pluginId] || '')
                    .onChange((value) => {
                        (async () => {
                            this.plugin.settings.names[pluginId] = value;
                            await this.plugin.saveSettings();
                            nameSpan.textContent = value.trim() !== "" ? value : originalName;
                            this.plugin.applyToExistingTabs();
                        })();
                    });

                text.inputEl.setCssStyles({ width: isPhone ? 'auto' : '90px' });
                if (isPhone) {
                    text.inputEl.setCssStyles({ flex: '1', minWidth: '100px' });
                }
            });

            setting.settingEl.setCssStyles({ border: '1px solid var(--background-modifier-border)', borderRadius: '8px', padding: '12px 15px', margin: '0' });

            if (!isSelf) {
                setting.settingEl.setCssStyles({ backgroundColor: 'var(--background-secondary)' });
            }

            setting.infoEl.setCssStyles({ flex: '1 1 auto', overflow: 'hidden', minWidth: '0' });

            if (isHidden && !isSelf) {
                setting.settingEl.setCssStyles({ opacity: '0.5' });
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
            grid.setCssStyles({ display: isCollapsed ? 'none' : 'grid' });

            let currentToggleBtn: ExtraButtonComponent | undefined;

            if (title !== '选项') {
                const isCategoryHidden = this.plugin.settings.hiddenCategories[title] || false;
                
                headingSetting.addExtraButton(btn => {
                    const b = btn as unknown as SafeButton;
                    b.setIcon(isCategoryHidden ? 'eye-off' : 'eye')
                     .setTooltip(isCategoryHidden ? '取消全部隐藏 (在侧边栏恢复显示)' : '全部隐藏 (在侧边栏隐藏该分类及内容)')
                     .onClick(() => {
                         (async () => {
                             const currentlyHidden = this.plugin.settings.hiddenCategories[title] || false;
                             this.plugin.settings.hiddenCategories[title] = !currentlyHidden;
                             await this.plugin.saveSettings();
                             b.setIcon(!currentlyHidden ? 'eye-off' : 'eye')
                              .setTooltip(!currentlyHidden ? '取消全部隐藏 (在侧边栏恢复显示)' : '全部隐藏 (在侧边栏隐藏该分类及内容)');
                             
                             this.plugin.applyToExistingTabs();
                         })();
                     });
                });
            }

            if (allowCollapse) {
                headingSetting.addExtraButton(btn => {
                    currentToggleBtn = btn;
                    const b = btn as unknown as SafeButton;
                    b.setIcon(isCollapsed ? 'chevron-right' : 'chevron-down')
                     .setTooltip(isCollapsed ? '展开' : '折叠')
                     .onClick(() => {
                         (async () => {
                             isCollapsed = !isCollapsed;
                             this.plugin.settings.collapsed[title] = isCollapsed;
                             await this.plugin.saveSettings();
                             b.setIcon(isCollapsed ? 'chevron-right' : 'chevron-down')
                              .setTooltip(isCollapsed ? '展开' : '折叠');
                             grid.setCssStyles({ display: isCollapsed ? 'none' : 'grid' });
                         })();
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
        }

        const otherTabs = communityPluginTabs.filter(tab => !assignedIds.has(tab.id));
        renderSection('第三方插件', otherTabs, true, false);

        for (const catName of this.plugin.settings.categoryOrder) {
            const ids = categories[catName] || [];
            const catTabs = communityPluginTabs.filter(tab => ids.includes(tab.id));
            renderSection(catName, catTabs, true);
        }

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
                    item.settingEl.setCssStyles({ display: match ? 'flex' : 'none' });
                });

                groups.forEach(group => {
                    if (isSearching) {
                        let hasVisible = false;
                        for (let i = 0; i < group.gridContainer.children.length; i++) {
                            const child = group.gridContainer.children[i] as HTMLElement;
                            if (child.style.display !== 'none') {
                                hasVisible = true;
                                break;
                            }
                        }
                        group.headingEl.setCssStyles({ display: hasVisible ? '' : 'none' });
                        group.gridContainer.setCssStyles({ display: hasVisible ? 'grid' : 'none' });
                    } else {
                        group.headingEl.setCssStyles({ display: '' });
                        let isCurrentlyCollapsed = false;
                        if (group.toggleBtn) {
                            isCurrentlyCollapsed = this.plugin.settings.collapsed[group.title] || false;
                            const b = group.toggleBtn as unknown as SafeButton;
                            b.setIcon(isCurrentlyCollapsed ? 'chevron-right' : 'chevron-down')
                             .setTooltip(isCurrentlyCollapsed ? '展开' : '折叠');
                        }
                        group.gridContainer.setCssStyles({ display: isCurrentlyCollapsed ? 'none' : 'grid' });
                        Array.from(group.gridContainer.children).forEach(el => (el as HTMLElement).setCssStyles({ display: 'flex' }));
                    }
                });
            }, 150);
        });
    }
}