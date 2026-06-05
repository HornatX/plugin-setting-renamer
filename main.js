var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => PluginRenamer
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var DEFAULT_SETTINGS = {
  names: {},
  icons: {},
  hidden: {},
  hiddenCategories: {},
  categories: {},
  categoryOrder: [],
  collapsed: {}
};
var IconPickerModal = class extends import_obsidian.FuzzySuggestModal {
  pluginId;
  plugin;
  onChoose;
  constructor(app, pluginId, plugin, onChoose) {
    super(app);
    this.pluginId = pluginId;
    this.plugin = plugin;
    this.onChoose = onChoose;
    this.setPlaceholder("\u641C\u7D22\u56FE\u6807 (\u8F93\u5165\u82F1\u6587, \u5982 'star', 'settings')...");
  }
  getItems() {
    return ["\u6062\u590D\u9ED8\u8BA4\u72B6\u6001", ...(0, import_obsidian.getIconIds)()];
  }
  getItemText(item) {
    return item;
  }
  renderSuggestion(match, el) {
    const iconName = match.item;
    el.setCssStyles({ display: "flex", alignItems: "center", gap: "10px" });
    if (iconName === "\u6062\u590D\u9ED8\u8BA4\u72B6\u6001") {
      el.createSpan({ text: "\u{1F504} \u6062\u590D\u9ED8\u8BA4 (\u6838\u5FC3\u63D2\u4EF6\u6062\u590D\u539F\u7248 / \u7B2C\u4E09\u65B9\u4E0D\u663E\u793A\u56FE\u6807)" });
      return;
    }
    const iconContainer = el.createDiv();
    (0, import_obsidian.setIcon)(iconContainer, iconName);
    el.createSpan({ text: iconName });
  }
  onChooseItem(item) {
    this.onChoose(item === "\u6062\u590D\u9ED8\u8BA4\u72B6\u6001" ? null : item);
  }
};
var CategoryManagerModal = class extends import_obsidian.Modal {
  plugin;
  refreshMainTab;
  currentView = "list";
  editingCategory = null;
  renamingCategory = null;
  tempCategoryName = "";
  constructor(app, plugin, refreshMainTab) {
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
    if (this.currentView === "list") {
      this.renderList();
    } else {
      this.renderEdit();
    }
  }
  renderList() {
    this.titleEl.setText("\u{1F4C1} \u7BA1\u7406\u63D2\u4EF6\u5206\u7C7B");
    const createSection = this.contentEl.createDiv();
    createSection.setCssStyles({ background: "var(--background-secondary)", padding: "15px", borderRadius: "8px", marginBottom: "25px", border: "1px solid var(--background-modifier-border)" });
    createSection.createEl("h4", { text: "\u2728 \u65B0\u5EFA\u5206\u7C7B" }).setCssStyles({ marginTop: "0", marginBottom: "10px", color: "var(--text-normal)" });
    const createSetting = new import_obsidian.Setting(createSection).setName("\u5206\u7C7B\u540D\u79F0").setDesc("\u521B\u5EFA\u4E00\u4E2A\u65B0\u7684\u5206\u7C7B\u6A21\u5757\u4EE5\u5F52\u7EB3\u63D2\u4EF6\uFF08\u4E0D\u53EF\u4E0E\u539F\u751F\u5206\u7C7B\u540C\u540D\uFF09").addText(
      (text) => text.setPlaceholder("\u8F93\u5165\u5206\u7C7B\u540D\u79F0...").setValue(this.tempCategoryName).onChange((val) => this.tempCategoryName = val)
    ).addButton((btn) => {
      const b = btn;
      b.onClick(() => {
        (async () => {
          const name = this.tempCategoryName.trim();
          const invalidNames = ["\u9009\u9879", "\u6838\u5FC3\u63D2\u4EF6", "\u7B2C\u4E09\u65B9\u63D2\u4EF6", "Options", "Core plugins", "Community plugins"];
          if (name && !this.plugin.settings.categories[name] && !invalidNames.includes(name)) {
            this.plugin.settings.categories[name] = [];
            this.plugin.settings.categoryOrder.push(name);
            await this.plugin.saveSettings();
            this.tempCategoryName = "";
            this.display();
          }
        })();
      });
      btn.setButtonText("\u521B\u5EFA\u5206\u7C7B").setCta();
    });
    createSetting.settingEl.setCssStyles({ border: "none", padding: "0" });
    const catKeys = this.plugin.settings.categoryOrder.filter((k) => this.plugin.settings.categories[k]);
    if (catKeys.length > 0) {
      this.contentEl.createEl("h4", { text: "\u{1F4C2} \u73B0\u6709\u5206\u7C7B (\u4E0A\u4E0B\u62D6\u52A8\u53EF\u6392\u5E8F)" }).setCssStyles({ marginBottom: "15px", paddingBottom: "5px", borderBottom: "1px solid var(--background-modifier-border)", color: "var(--text-normal)" });
      const listContainer = this.contentEl.createDiv();
      listContainer.setCssStyles({ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "45vh", overflowY: "auto", paddingRight: "5px", paddingBottom: "10px" });
      let draggedCat = null;
      for (const cat of catKeys) {
        const itemDiv = listContainer.createDiv();
        itemDiv.setCssStyles({ border: "1px solid var(--background-modifier-border)", borderRadius: "8px", padding: "12px 15px", background: "var(--background-primary)", transition: "opacity 0.2s ease" });
        if (this.renamingCategory !== cat) {
          itemDiv.setAttribute("draggable", "true");
          itemDiv.setCssStyles({ cursor: "grab" });
          itemDiv.addEventListener("dragstart", (e) => {
            draggedCat = cat;
            itemDiv.setCssStyles({ opacity: "0.4" });
            e.dataTransfer?.setData("text/plain", cat);
          });
          itemDiv.addEventListener("dragend", () => {
            itemDiv.setCssStyles({ opacity: "1" });
            draggedCat = null;
            Array.from(listContainer.children).forEach((el) => {
              el.setCssStyles({ borderTop: "", borderBottom: "", borderColor: "var(--background-modifier-border)" });
            });
          });
          itemDiv.addEventListener("dragover", (e) => {
            e.preventDefault();
            if (draggedCat && draggedCat !== cat) {
              const bounding = itemDiv.getBoundingClientRect();
              const offset = bounding.y + bounding.height / 2;
              if (e.clientY > offset) {
                itemDiv.setCssStyles({ borderBottom: "2px solid var(--interactive-accent)", borderTop: "1px solid var(--background-modifier-border)" });
              } else {
                itemDiv.setCssStyles({ borderTop: "2px solid var(--interactive-accent)", borderBottom: "1px solid var(--background-modifier-border)" });
              }
            }
          });
          itemDiv.addEventListener("dragleave", () => {
            itemDiv.setCssStyles({ borderTop: "1px solid var(--background-modifier-border)", borderBottom: "1px solid var(--background-modifier-border)" });
          });
          itemDiv.addEventListener("drop", (e) => {
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
          const renameSetting = new import_obsidian.Setting(itemDiv).setName("\u4FEE\u6539\u540D\u79F0").addText(
            (text) => text.setValue(cat).onChange((val) => newCatName = val)
          ).addButton((btn) => {
            const b = btn;
            btn.setButtonText("\u4FDD\u5B58").setCta();
            b.onClick(() => {
              (async () => {
                newCatName = newCatName.trim();
                const invalidNames = ["\u9009\u9879", "\u6838\u5FC3\u63D2\u4EF6", "\u7B2C\u4E09\u65B9\u63D2\u4EF6", "Options", "Core plugins", "Community plugins"];
                if (newCatName && newCatName !== cat && !this.plugin.settings.categories[newCatName] && !invalidNames.includes(newCatName)) {
                  this.plugin.settings.categories[newCatName] = this.plugin.settings.categories[cat];
                  delete this.plugin.settings.categories[cat];
                  const orderIdx = this.plugin.settings.categoryOrder.indexOf(cat);
                  if (orderIdx > -1) this.plugin.settings.categoryOrder[orderIdx] = newCatName;
                  if (this.plugin.settings.collapsed[cat] !== void 0) {
                    this.plugin.settings.collapsed[newCatName] = this.plugin.settings.collapsed[cat];
                    delete this.plugin.settings.collapsed[cat];
                  }
                  if (this.plugin.settings.hiddenCategories[cat] !== void 0) {
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
          }).addButton((btn) => {
            const b = btn;
            btn.setButtonText("\u53D6\u6D88");
            b.onClick(() => {
              this.renamingCategory = null;
              this.display();
            });
          });
          renameSetting.settingEl.setCssStyles({ border: "none", padding: "0" });
        } else {
          const viewSetting = new import_obsidian.Setting(itemDiv).setName(cat).setDesc(`\u5305\u542B ${this.plugin.settings.categories[cat].length} \u4E2A\u63D2\u4EF6`).addButton((btn) => {
            const b = btn;
            b.setIcon("pencil").setTooltip("\u4FEE\u6539\u5206\u7C7B\u540D\u79F0").onClick(() => {
              this.renamingCategory = cat;
              this.display();
            });
          }).addButton((btn) => {
            const b = btn;
            b.setIcon("list").setTooltip("\u7BA1\u7406\u5206\u7C7B\u5185\u7684\u63D2\u4EF6").onClick(() => {
              this.editingCategory = cat;
              this.currentView = "edit";
              this.display();
            });
          }).addButton((btn) => {
            const b = btn;
            b.setIcon("trash").setTooltip("\u5220\u9664\u8BE5\u5206\u7C7B\uFF08\u63D2\u4EF6\u5C06\u88AB\u79FB\u56DE\u539F\u5217\u8868\uFF09").setWarning().onClick(() => {
              (async () => {
                delete this.plugin.settings.categories[cat];
                delete this.plugin.settings.collapsed[cat];
                delete this.plugin.settings.hiddenCategories[cat];
                this.plugin.settings.categoryOrder = this.plugin.settings.categoryOrder.filter((c) => c !== cat);
                await this.plugin.saveSettings();
                this.plugin.applyToExistingTabs();
                this.display();
              })();
            });
          });
          viewSetting.settingEl.setCssStyles({ border: "none", padding: "0" });
        }
      }
    } else {
      this.contentEl.createEl("p", {
        text: "\u5F53\u524D\u6CA1\u6709\u81EA\u5B9A\u4E49\u5206\u7C7B\u3002\u4E0A\u65B9\u521B\u5EFA\u540E\uFF0C\u5206\u7C7B\u4F1A\u663E\u793A\u5728\u6B64\u5904\u3002"
      }).setCssStyles({ textAlign: "center", color: "var(--text-muted)", marginTop: "20px", padding: "25px", background: "var(--background-secondary)", borderRadius: "8px", border: "1px dashed var(--background-modifier-border)" });
    }
  }
  renderEdit() {
    if (!this.editingCategory) return;
    this.titleEl.setText(`\u{1F4DD} \u7F16\u8F91\u5206\u7C7B\u63D2\u4EF6: ${this.editingCategory}`);
    const headerDiv = this.contentEl.createDiv();
    headerDiv.setCssStyles({ background: "var(--background-secondary)", padding: "10px 15px", borderRadius: "8px", border: "1px solid var(--background-modifier-border)", marginBottom: "20px" });
    const topSetting = new import_obsidian.Setting(headerDiv).setName("\u52FE\u9009\u8981\u52A0\u5165\u6B64\u5206\u7C7B\u7684\u63D2\u4EF6").setDesc("\u63D0\u793A\uFF1A\u5DF2\u5728\u5176\u4ED6\u5206\u7C7B\u4E2D\u7684\u63D2\u4EF6\u4F1A\u81EA\u52A8\u9690\u85CF\u3002").addButton((btn) => {
      const b = btn;
      btn.setButtonText("\u8FD4\u56DE\u5217\u8868");
      b.onClick(() => {
        this.currentView = "list";
        this.editingCategory = null;
        this.display();
      });
    });
    topSetting.settingEl.setCssStyles({ border: "none", padding: "0" });
    const internalApp = this.app;
    const manifests = internalApp.plugins.manifests;
    const pluginTabs = internalApp.setting.pluginTabs || [];
    const communityTabs = pluginTabs.filter((tab) => !!manifests[tab.id]);
    communityTabs.sort((a, b) => {
      const nameA = this.plugin.settings.names[a.id] || manifests[a.id]?.name || a.name || a.id;
      const nameB = this.plugin.settings.names[b.id] || manifests[b.id]?.name || b.name || b.id;
      return nameA.localeCompare(nameB);
    });
    const currentCatPlugins = this.plugin.settings.categories[this.editingCategory] || [];
    const otherCatPlugins = /* @__PURE__ */ new Set();
    for (const cat in this.plugin.settings.categories) {
      if (cat !== this.editingCategory) {
        this.plugin.settings.categories[cat].forEach((id) => otherCatPlugins.add(id));
      }
    }
    const container = this.contentEl.createDiv();
    container.setCssStyles({ maxHeight: "50vh", overflowY: "auto", padding: "15px", border: "1px solid var(--background-modifier-border)", borderRadius: "8px", display: "flex", flexDirection: "column", gap: "5px" });
    let availableCount = 0;
    for (const tab of communityTabs) {
      if (otherCatPlugins.has(tab.id)) continue;
      availableCount++;
      const originalName = manifests[tab.id]?.name || tab.name || tab.id;
      const customName = this.plugin.settings.names[tab.id];
      const displayName = customName ? `${customName} (${originalName})` : originalName;
      const row = new import_obsidian.Setting(container).setName(displayName).addToggle(
        (toggle) => toggle.setValue(currentCatPlugins.includes(tab.id)).onChange((val) => {
          (async () => {
            if (!this.editingCategory) return;
            let list = this.plugin.settings.categories[this.editingCategory];
            if (val) {
              if (!list.includes(tab.id)) list.push(tab.id);
            } else {
              list = list.filter((id) => id !== tab.id);
            }
            this.plugin.settings.categories[this.editingCategory] = list;
            await this.plugin.saveSettings();
            this.plugin.applyToExistingTabs();
          })();
        })
      );
      row.settingEl.setCssStyles({ padding: "8px 10px", borderBottom: "1px solid var(--background-modifier-border)", borderTop: "none" });
    }
    if (availableCount === 0) {
      container.createEl("p", { text: "\u6CA1\u6709\u53EF\u7528\u7684\u63D2\u4EF6\u4E86\uFF0C\u5176\u4ED6\u63D2\u4EF6\u90FD\u5DF2\u88AB\u5206\u914D\u5B8C\u6BD5\u3002" }).setCssStyles({ textAlign: "center", color: "var(--text-muted)", padding: "20px 0" });
    }
  }
};
var PluginRenamer = class extends import_obsidian.Plugin {
  settings;
  isApplying = false;
  mutationObserver = null;
  originalSettingOpen;
  get internalApp() {
    return this.app;
  }
  async onload() {
    await this.loadSettings();
    this.isApplying = false;
    this.patchSettingOpen();
    this.app.workspace.onLayoutReady(() => {
      if (activeDocument.body.find(".vertical-tab-header")) {
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
    const loadedData = await this.loadData() || {};
    this.settings = {
      names: { ...DEFAULT_SETTINGS.names, ...loadedData.names || {} },
      icons: { ...DEFAULT_SETTINGS.icons, ...loadedData.icons || {} },
      hidden: { ...DEFAULT_SETTINGS.hidden, ...loadedData.hidden || {} },
      hiddenCategories: { ...DEFAULT_SETTINGS.hiddenCategories, ...loadedData.hiddenCategories || {} },
      categories: { ...DEFAULT_SETTINGS.categories, ...loadedData.categories || {} },
      categoryOrder: loadedData.categoryOrder || [],
      collapsed: { ...DEFAULT_SETTINGS.collapsed, ...loadedData.collapsed || {} }
    };
    const currentKeys = Object.keys(this.settings.categories);
    this.settings.categoryOrder = this.settings.categoryOrder.filter((k) => currentKeys.includes(k));
    currentKeys.forEach((k) => {
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
    this.internalApp.setting.open = (...args) => {
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
      const header = activeDocument.body.find(".vertical-tab-header");
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
    const header = activeDocument.body.find(".vertical-tab-header");
    if (!header) return;
    const pendingNodes = /* @__PURE__ */ new Set();
    let updateScheduled = false;
    this.mutationObserver = new MutationObserver((mutations) => {
      if (this.isApplying) return;
      let shouldUpdate = false;
      mutations.forEach((m) => {
        m.addedNodes.forEach((node) => {
          if ("instanceOf" in node && typeof node.instanceOf === "function" && node.instanceOf(HTMLElement)) {
            const el = node;
            if (el.classList.contains("vertical-tab-nav-item") && el.hasAttribute("data-setting-id")) {
              pendingNodes.add(el);
              shouldUpdate = true;
            } else if (typeof el.findAll === "function") {
              const tabs = el.findAll(".vertical-tab-nav-item[data-setting-id]");
              if (tabs.length > 0) {
                tabs.forEach((tab) => pendingNodes.add(tab));
                shouldUpdate = true;
              }
            }
          }
        });
        m.removedNodes.forEach((node) => {
          if ("instanceOf" in node && typeof node.instanceOf === "function" && node.instanceOf(HTMLElement)) {
            if (node.classList && node.classList.contains("vertical-tab-nav-item")) {
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
          pendingNodes.forEach((node) => this.applyIconToNavItem(node));
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
  getPluginCategoryMap() {
    const map = {};
    const settingTabs = this.internalApp.setting.settingTabs || [];
    settingTabs.forEach((tab) => map[tab.id] = "\u9009\u9879");
    const pluginTabs = this.internalApp.setting.pluginTabs || [];
    const manifests = this.internalApp.plugins.manifests || {};
    pluginTabs.forEach((tab) => {
      if (!manifests[tab.id]) {
        map[tab.id] = "\u6838\u5FC3\u63D2\u4EF6";
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
          map[tab.id] = "\u7B2C\u4E09\u65B9\u63D2\u4EF6";
        }
      }
    });
    return map;
  }
  applyToExistingTabs() {
    const header = activeDocument.body.find(".vertical-tab-header");
    if (!header) return;
    this.isApplying = true;
    header.findAll(".vertical-tab-nav-item[data-setting-id]").forEach((tabEl) => {
      this.applyIconToNavItem(tabEl);
    });
    this.restructureSidebar();
    if (this.mutationObserver) {
      this.mutationObserver.takeRecords();
    }
    this.isApplying = false;
  }
  applyIconToNavItem(tabEl) {
    const pluginId = tabEl.getAttribute("data-setting-id");
    if (!pluginId) return;
    const manifests = this.internalApp.plugins.manifests;
    const isThirdParty = !!manifests[pluginId];
    const isSelf = pluginId === this.manifest.id;
    if (isSelf && tabEl.parentElement && tabEl.parentElement.firstElementChild !== tabEl) {
      tabEl.parentElement.prepend(tabEl);
    }
    const customName = this.settings.names[pluginId];
    let targetIcon = this.settings.icons[pluginId];
    if (targetIcon === void 0) {
      targetIcon = null;
    }
    if (customName && customName.trim() !== "") {
      if (!tabEl.dataset.originalName) {
        const walker2 = activeDocument.createTreeWalker(tabEl, NodeFilter.SHOW_TEXT, null);
        let node2;
        while (node2 = walker2.nextNode()) {
          if (node2.nodeValue && node2.nodeValue.trim() !== "") {
            tabEl.dataset.originalName = node2.nodeValue;
            break;
          }
        }
      }
      const originalName = tabEl.dataset.originalName;
      if (originalName && tabEl.getAttribute("aria-label") !== originalName) {
        tabEl.setAttribute("aria-label", originalName);
      }
      const walker = activeDocument.createTreeWalker(tabEl, NodeFilter.SHOW_TEXT, null);
      let node;
      while (node = walker.nextNode()) {
        if (node.nodeValue && node.nodeValue.trim() !== "") {
          if (node.nodeValue !== customName) node.nodeValue = customName;
          break;
        }
      }
    } else if (tabEl.dataset.originalName) {
      const walker = activeDocument.createTreeWalker(tabEl, NodeFilter.SHOW_TEXT, null);
      let node;
      while (node = walker.nextNode()) {
        if (node.nodeValue && node.nodeValue.trim() !== "") {
          node.nodeValue = tabEl.dataset.originalName;
          break;
        }
      }
      tabEl.setAttribute("aria-label", tabEl.dataset.originalName);
      delete tabEl.dataset.originalName;
    }
    const categoryMap = this.getPluginCategoryMap();
    const category = categoryMap[pluginId] || "";
    const isCategoryHidden = this.settings.hiddenCategories[category] || false;
    const isHidden = this.settings.hidden[pluginId] || isCategoryHidden;
    if (isHidden && !isSelf) {
      tabEl.setCssStyles({ display: "none" });
    } else {
      tabEl.setCssStyles({ display: isThirdParty && targetIcon ? "flex" : "", alignItems: isThirdParty && targetIcon ? "center" : "" });
      if (isSelf && this.settings.hidden[pluginId]) {
        delete this.settings.hidden[pluginId];
        void this.saveSettings();
      }
    }
    let customIconEl = tabEl.find(".vertical-tab-nav-item-icon.custom-icon");
    let nativeIconEl = tabEl.find(".vertical-tab-nav-item-icon:not(.custom-icon)");
    if (!targetIcon) {
      if (customIconEl) customIconEl.remove();
      if (nativeIconEl) nativeIconEl.setCssStyles({ display: "" });
      return;
    }
    if (!customIconEl) {
      if (nativeIconEl) nativeIconEl.setCssStyles({ display: "none" });
      customIconEl = activeDocument.createElement("div");
      customIconEl.classList.add("vertical-tab-nav-item-icon", "custom-icon");
      if (isThirdParty) {
        customIconEl.setCssStyles({ marginRight: "8px", display: "flex", alignItems: "center", justifyContent: "center" });
      }
      const firstNode = tabEl.firstChild;
      if (firstNode) {
        tabEl.insertBefore(customIconEl, firstNode);
      } else {
        tabEl.appendChild(customIconEl);
      }
    } else if (nativeIconEl) {
      nativeIconEl.setCssStyles({ display: "none" });
    }
    if (customIconEl.dataset.icon !== targetIcon) {
      customIconEl.innerHTML = "";
      (0, import_obsidian.setIcon)(customIconEl, targetIcon);
      customIconEl.dataset.icon = targetIcon;
    }
  }
  restructureSidebar() {
    const headerContainer = activeDocument.body.find(".vertical-tab-header");
    if (!headerContainer) return;
    const manifests = this.internalApp.plugins.manifests;
    const nativeCommunityGroup = Array.from(headerContainer.findAll(".vertical-tab-header-group")).find((group) => {
      const titleEl = group.find(".vertical-tab-header-group-title");
      return titleEl && (titleEl.textContent?.includes("\u7B2C\u4E09\u65B9\u63D2\u4EF6") || titleEl.textContent?.includes("Community plugins"));
    });
    headerContainer.findAll(".custom-category-group").forEach((el) => {
      if (nativeCommunityGroup) {
        el.findAll(".vertical-tab-nav-item").forEach((tab) => nativeCommunityGroup.appendChild(tab));
      }
      el.remove();
    });
    if (!nativeCommunityGroup) return;
    nativeCommunityGroup.findAll(".custom-category-divider").forEach((el) => el.remove());
    const allTabs = Array.from(nativeCommunityGroup.findAll(".vertical-tab-nav-item"));
    const seenIds = /* @__PURE__ */ new Set();
    const uniqueTabs = [];
    const validNavEls = /* @__PURE__ */ new Set();
    const validIds = /* @__PURE__ */ new Set();
    if (this.internalApp.setting) {
      (this.internalApp.setting.settingTabs || []).forEach((t) => {
        if (t.navEl) {
          validNavEls.add(t.navEl);
          validIds.add(t.id);
        }
      });
      (this.internalApp.setting.pluginTabs || []).forEach((t) => {
        if (t.navEl) {
          validNavEls.add(t.navEl);
          validIds.add(t.id);
        }
      });
    }
    for (let i = allTabs.length - 1; i >= 0; i--) {
      const tab = allTabs[i];
      const id = tab.getAttribute("data-setting-id");
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
    const communityTabs = uniqueTabs.filter((tab) => {
      const id = tab.getAttribute("data-setting-id");
      return id && manifests[id];
    });
    const nativeTitle = nativeCommunityGroup.find(".vertical-tab-header-group-title");
    if (nativeTitle) {
      nativeCommunityGroup.appendChild(nativeTitle);
    }
    const assignedIds = /* @__PURE__ */ new Set();
    this.settings.categoryOrder.forEach((catName) => {
      (this.settings.categories[catName] || []).forEach((id) => assignedIds.add(id));
    });
    communityTabs.forEach((tab) => {
      const pluginId = tab.getAttribute("data-setting-id");
      if (pluginId && !assignedIds.has(pluginId)) {
        const isHidden = this.settings.hidden[pluginId] || false;
        tab.setCssStyles({ display: isHidden ? "none" : tab.find(".custom-icon") ? "flex" : "" });
        nativeCommunityGroup.appendChild(tab);
      }
    });
    this.settings.categoryOrder.forEach((catName) => {
      const pluginIds = this.settings.categories[catName] || [];
      if (pluginIds.length === 0) return;
      const tabsForCategory = pluginIds.map(
        (id) => communityTabs.find((t) => t.getAttribute("data-setting-id") === id)
      ).filter((t) => t !== void 0);
      if (tabsForCategory.length === 0) return;
      const isCategoryHidden = this.settings.hiddenCategories[catName] || false;
      const divider = activeDocument.createElement("div");
      divider.className = "custom-category-divider";
      divider.setCssStyles({ height: "20px" });
      if (isCategoryHidden) divider.setCssStyles({ display: "none" });
      nativeCommunityGroup.appendChild(divider);
      tabsForCategory.forEach((tab) => {
        if (isCategoryHidden) {
          tab.setCssStyles({ display: "none" });
        } else {
          const pluginId = tab.getAttribute("data-setting-id");
          if (pluginId) {
            const isHidden = this.settings.hidden[pluginId] || false;
            tab.setCssStyles({ display: isHidden ? "none" : tab.find(".custom-icon") ? "flex" : "" });
          }
        }
        nativeCommunityGroup.appendChild(tab);
      });
    });
    nativeCommunityGroup.setCssStyles({ display: "" });
    const nativeGroups = Array.from(headerContainer.findAll(".vertical-tab-header-group"));
    nativeGroups.forEach((group) => {
      if (group === nativeCommunityGroup) return;
      const titleEl = group.find(".vertical-tab-header-group-title");
      let catName = "";
      if (titleEl) {
        const text = titleEl.textContent || "";
        if (text.includes("\u6838\u5FC3\u63D2\u4EF6") || text.includes("Core")) catName = "\u6838\u5FC3\u63D2\u4EF6";
        else if (text.includes("\u9009\u9879") || text.includes("Options")) catName = "\u9009\u9879";
      }
      if (catName) {
        const isCategoryHidden = this.settings.hiddenCategories[catName] || false;
        group.setCssStyles({ display: isCategoryHidden ? "none" : "" });
      }
    });
  }
  restoreExistingTabs() {
    const headerContainer = activeDocument.body.find(".vertical-tab-header");
    if (headerContainer) {
      const nativeCommunityGroup = Array.from(headerContainer.findAll(".vertical-tab-header-group")).find((group) => {
        const titleEl = group.find(".vertical-tab-header-group-title");
        return titleEl && (titleEl.textContent?.includes("\u7B2C\u4E09\u65B9\u63D2\u4EF6") || titleEl.textContent?.includes("Community plugins"));
      });
      if (nativeCommunityGroup) {
        nativeCommunityGroup.findAll(".custom-category-divider").forEach((el) => el.remove());
        headerContainer.findAll(".custom-category-group .vertical-tab-nav-item").forEach((tab) => {
          nativeCommunityGroup.appendChild(tab);
        });
      }
      headerContainer.findAll(".custom-category-group").forEach((el) => el.remove());
      const allGroups = headerContainer.findAll(".vertical-tab-header-group");
      allGroups.forEach((g) => g.setCssStyles({ display: "" }));
    }
    const allTabs = activeDocument.body.findAll(".vertical-tab-nav-item[data-setting-id]");
    allTabs.forEach((tabEl) => {
      if (tabEl.dataset.originalName) {
        const walker = activeDocument.createTreeWalker(tabEl, NodeFilter.SHOW_TEXT, null);
        let node;
        while (node = walker.nextNode()) {
          if (node.nodeValue && node.nodeValue.trim() !== "") {
            node.nodeValue = tabEl.dataset.originalName;
            break;
          }
        }
        tabEl.setAttribute("aria-label", tabEl.dataset.originalName);
        delete tabEl.dataset.originalName;
      }
      let customIconEl = tabEl.find(".vertical-tab-nav-item-icon.custom-icon");
      if (customIconEl) customIconEl.remove();
      let nativeIconEl = tabEl.find(".vertical-tab-nav-item-icon:not(.custom-icon)");
      if (nativeIconEl) nativeIconEl.setCssStyles({ display: "" });
      tabEl.setCssStyles({ display: "", alignItems: "" });
    });
  }
};
var PluginRenamerSettingTab = class extends import_obsidian.PluginSettingTab {
  plugin;
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  get internalApp() {
    return this.app;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    const isPhone = import_obsidian.Platform.isPhone;
    const topHeaderContainer = containerEl.createDiv();
    topHeaderContainer.setCssStyles({ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "15px", marginBottom: "25px" });
    const titleArea = topHeaderContainer.createDiv();
    new import_obsidian.Setting(titleArea).setName("\u2699\uFE0F \u63D2\u4EF6\u540D\u79F0\u4E0E\u56FE\u6807\u81EA\u5B9A\u4E49").setDesc("\u70B9\u51FB\u773C\u775B\u9690\u85CF/\u663E\u793A\uFF0C\u4E2D\u95F4\u6539\u56FE\u6807\uFF0C\u53F3\u4FA7\u6539\u540D\u79F0\u3002\u53EF\u5206\u7C7B\u7BA1\u7406\u3002").setHeading();
    const actionArea = topHeaderContainer.createDiv();
    actionArea.setCssStyles({ display: "flex", gap: "10px", alignItems: "center" });
    const catBtnEl = actionArea.createEl("button", { cls: "clickable-icon", attr: { "aria-label": "\u7BA1\u7406\u63D2\u4EF6\u5206\u7C7B" } });
    (0, import_obsidian.setIcon)(catBtnEl, "folder-cog");
    catBtnEl.addEventListener("click", () => new CategoryManagerModal(this.app, this.plugin, () => this.display()).open());
    const searchInput = actionArea.createEl("input", {
      type: "search",
      placeholder: "\u{1F50D} \u641C\u7D22 \u63D2\u4EF6\u540D / \u81EA\u5B9A\u4E49\u540D / ID..."
    });
    searchInput.setCssStyles({ flex: "1", minWidth: "250px", maxWidth: "350px" });
    const settingTabs = this.internalApp.setting.settingTabs || [];
    const pluginTabs = this.internalApp.setting.pluginTabs || [];
    const manifests = this.internalApp.plugins.manifests || {};
    const corePluginTabs = pluginTabs.filter((tab) => !manifests[tab.id]);
    const communityPluginTabs = pluginTabs.filter((tab) => !!manifests[tab.id]);
    const sortByOriginalName = (a, b) => {
      const nameA = manifests[a.id]?.name || a.name || a.id;
      const nameB = manifests[b.id]?.name || b.name || b.id;
      return nameA.localeCompare(nameB);
    };
    corePluginTabs.sort(sortByOriginalName);
    communityPluginTabs.sort(sortByOriginalName);
    const searchItems = [];
    const groups = [];
    const createGridContainer = (parentEl) => {
      const gridEl = parentEl.createDiv();
      gridEl.setCssStyles({ display: "grid", gridTemplateColumns: isPhone ? "1fr" : "repeat(2, minmax(0, 1fr))", gap: "15px", marginBottom: "30px" });
      return gridEl;
    };
    const renderSettingItem = (gridContainer, tab, isThirdParty) => {
      const pluginId = tab.id;
      const isSelf = pluginId === this.plugin.manifest.id;
      const originalName = manifests[pluginId]?.name || tab.name || pluginId;
      const fallbackIcon = isThirdParty ? "puzzle" : tab.icon || "box";
      const isHidden = this.plugin.settings.hidden[pluginId];
      const setting = new import_obsidian.Setting(gridContainer).setName(originalName).setDesc(`ID: ${pluginId}`);
      if (isSelf) {
        setting.settingEl.setCssStyles({ backgroundColor: "var(--background-primary)" });
        setting.setDesc(`ID: ${pluginId} (\u672C\u63D2\u4EF6)`);
      }
      setting.nameEl.empty();
      setting.nameEl.setCssStyles({ display: "flex", alignItems: "center", overflow: "hidden" });
      const currentIcon = this.plugin.settings.icons[pluginId];
      const displayIcon = currentIcon !== void 0 ? currentIcon : fallbackIcon;
      const iconEl = activeDocument.createElement("span");
      iconEl.setCssStyles({ marginRight: "8px", display: "inline-flex", alignItems: "center", flexShrink: "0" });
      (0, import_obsidian.setIcon)(iconEl, displayIcon || "image");
      const nameSpan = activeDocument.createElement("span");
      nameSpan.textContent = this.plugin.settings.names[pluginId] || originalName;
      if (isPhone) {
        nameSpan.setCssStyles({ whiteSpace: "normal", wordBreak: "break-word" });
      } else {
        nameSpan.setCssStyles({ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" });
      }
      nameSpan.setCssStyles({ flex: "1 1 auto" });
      setting.nameEl.appendChild(iconEl);
      setting.nameEl.appendChild(nameSpan);
      setting.addExtraButton((btn) => {
        const b = btn;
        b.setIcon("settings").setTooltip("\u8DF3\u8F6C\u5230\u8BE5\u9762\u677F\u8BBE\u7F6E").onClick(() => {
          if (this.internalApp.setting && typeof this.internalApp.setting["openTabById"] === "function") {
            this.internalApp.setting["openTabById"](pluginId);
          }
        });
      });
      if (isSelf) {
        setting.addExtraButton((btn) => {
          const b = btn;
          b.setIcon("lock").setTooltip("\u9632\u5446\u4FDD\u62A4\uFF1A\u4E0D\u5141\u8BB8\u9690\u85CF\u672C\u63D2\u4EF6\u81EA\u8EAB").setDisabled(true);
          setting.settingEl.setCssStyles({ opacity: "1" });
        });
      } else {
        setting.addExtraButton((btn) => {
          const b = btn;
          b.setIcon(isHidden ? "eye-off" : "eye").setTooltip(isHidden ? "\u53D6\u6D88\u9690\u85CF (\u5728\u4FA7\u8FB9\u680F\u663E\u793A)" : "\u5728\u4FA7\u8FB9\u680F\u4E2D\u9690\u85CF\u6B64\u9762\u677F").onClick(() => {
            (async () => {
              if (this.plugin.settings.hidden[pluginId]) {
                delete this.plugin.settings.hidden[pluginId];
                b.setIcon("eye").setTooltip("\u9690\u85CF\u9762\u677F");
                setting.settingEl.setCssStyles({ opacity: "1" });
              } else {
                this.plugin.settings.hidden[pluginId] = true;
                b.setIcon("eye-off").setTooltip("\u53D6\u6D88\u9690\u85CF");
                setting.settingEl.setCssStyles({ opacity: "0.5" });
              }
              await this.plugin.saveSettings();
              this.plugin.applyToExistingTabs();
            })();
          });
        });
      }
      setting.addExtraButton((btn) => {
        const b = btn;
        b.setIcon(displayIcon || "image").setTooltip("\u66F4\u6539\u4FA7\u8FB9\u680F\u56FE\u6807").onClick(() => {
          new IconPickerModal(this.app, pluginId, this.plugin, (selectedIcon) => {
            (async () => {
              if (selectedIcon === null) {
                delete this.plugin.settings.icons[pluginId];
              } else {
                this.plugin.settings.icons[pluginId] = selectedIcon;
              }
              const newIcon = selectedIcon || fallbackIcon || "image";
              b.setIcon(newIcon);
              (0, import_obsidian.setIcon)(iconEl, newIcon);
              await this.plugin.saveSettings();
              this.plugin.applyToExistingTabs();
            })();
          }).open();
        });
      });
      setting.addText((text) => {
        text.setPlaceholder("\u8F93\u5165\u60F3\u663E\u793A\u7684...").setValue(this.plugin.settings.names[pluginId] || "").onChange((value) => {
          (async () => {
            this.plugin.settings.names[pluginId] = value;
            await this.plugin.saveSettings();
            nameSpan.textContent = value.trim() !== "" ? value : originalName;
            this.plugin.applyToExistingTabs();
          })();
        });
        text.inputEl.setCssStyles({ width: isPhone ? "auto" : "90px" });
        if (isPhone) {
          text.inputEl.setCssStyles({ flex: "1", minWidth: "100px" });
        }
      });
      setting.settingEl.setCssStyles({ border: "1px solid var(--background-modifier-border)", borderRadius: "8px", padding: "12px 15px", margin: "0" });
      if (!isSelf) {
        setting.settingEl.setCssStyles({ backgroundColor: "var(--background-secondary)" });
      }
      setting.infoEl.setCssStyles({ flex: "1 1 auto", overflow: "hidden", minWidth: "0" });
      if (isHidden && !isSelf) {
        setting.settingEl.setCssStyles({ opacity: "0.5" });
      }
      searchItems.push({
        settingEl: setting.settingEl,
        pluginId: pluginId.toLowerCase(),
        originalName: originalName.toLowerCase(),
        getCustomName: () => (this.plugin.settings.names[pluginId] || "").toLowerCase()
      });
    };
    const mainContentEl = containerEl.createDiv();
    const renderSection = (title, tabs, isThirdParty, allowCollapse = true) => {
      if (tabs.length === 0) return;
      const headingSetting = new import_obsidian.Setting(mainContentEl).setName(title).setHeading();
      const grid = createGridContainer(mainContentEl);
      let isCollapsed = allowCollapse ? this.plugin.settings.collapsed[title] || false : false;
      grid.setCssStyles({ display: isCollapsed ? "none" : "grid" });
      let currentToggleBtn;
      if (title !== "\u9009\u9879") {
        const isCategoryHidden = this.plugin.settings.hiddenCategories[title] || false;
        headingSetting.addExtraButton((btn) => {
          const b = btn;
          b.setIcon(isCategoryHidden ? "eye-off" : "eye").setTooltip(isCategoryHidden ? "\u53D6\u6D88\u5168\u90E8\u9690\u85CF (\u5728\u4FA7\u8FB9\u680F\u6062\u590D\u663E\u793A)" : "\u5168\u90E8\u9690\u85CF (\u5728\u4FA7\u8FB9\u680F\u9690\u85CF\u8BE5\u5206\u7C7B\u53CA\u5185\u5BB9)").onClick(() => {
            (async () => {
              const currentlyHidden = this.plugin.settings.hiddenCategories[title] || false;
              this.plugin.settings.hiddenCategories[title] = !currentlyHidden;
              await this.plugin.saveSettings();
              b.setIcon(!currentlyHidden ? "eye-off" : "eye").setTooltip(!currentlyHidden ? "\u53D6\u6D88\u5168\u90E8\u9690\u85CF (\u5728\u4FA7\u8FB9\u680F\u6062\u590D\u663E\u793A)" : "\u5168\u90E8\u9690\u85CF (\u5728\u4FA7\u8FB9\u680F\u9690\u85CF\u8BE5\u5206\u7C7B\u53CA\u5185\u5BB9)");
              this.plugin.applyToExistingTabs();
            })();
          });
        });
      }
      if (allowCollapse) {
        headingSetting.addExtraButton((btn) => {
          currentToggleBtn = btn;
          const b = btn;
          b.setIcon(isCollapsed ? "chevron-right" : "chevron-down").setTooltip(isCollapsed ? "\u5C55\u5F00" : "\u6298\u53E0").onClick(() => {
            (async () => {
              isCollapsed = !isCollapsed;
              this.plugin.settings.collapsed[title] = isCollapsed;
              await this.plugin.saveSettings();
              b.setIcon(isCollapsed ? "chevron-right" : "chevron-down").setTooltip(isCollapsed ? "\u5C55\u5F00" : "\u6298\u53E0");
              grid.setCssStyles({ display: isCollapsed ? "none" : "grid" });
            })();
          });
        });
      }
      groups.push({ title, headingEl: headingSetting.settingEl, gridContainer: grid, toggleBtn: currentToggleBtn });
      tabs.forEach((tab) => renderSettingItem(grid, tab, isThirdParty));
    };
    if (settingTabs.length > 0) {
      renderSection("\u9009\u9879", settingTabs, false);
    }
    if (corePluginTabs.length > 0) {
      renderSection("\u6838\u5FC3\u63D2\u4EF6", corePluginTabs, false);
    }
    const categories = this.plugin.settings.categories || {};
    const assignedIds = /* @__PURE__ */ new Set();
    for (const catName of this.plugin.settings.categoryOrder) {
      const ids = categories[catName] || [];
      ids.forEach((id) => assignedIds.add(id));
    }
    const otherTabs = communityPluginTabs.filter((tab) => !assignedIds.has(tab.id));
    renderSection("\u7B2C\u4E09\u65B9\u63D2\u4EF6", otherTabs, true, false);
    for (const catName of this.plugin.settings.categoryOrder) {
      const ids = categories[catName] || [];
      const catTabs = communityPluginTabs.filter((tab) => ids.includes(tab.id));
      renderSection(catName, catTabs, true);
    }
    let searchTimeout;
    searchInput.addEventListener("input", (e) => {
      window.clearTimeout(searchTimeout);
      searchTimeout = window.setTimeout(() => {
        const target = e.target;
        const query = target.value.toLowerCase().trim();
        const isSearching = query.length > 0;
        searchItems.forEach((item) => {
          const customName = item.getCustomName();
          const match = item.pluginId.includes(query) || item.originalName.includes(query) || customName.includes(query);
          item.settingEl.setCssStyles({ display: match ? "flex" : "none" });
        });
        groups.forEach((group) => {
          if (isSearching) {
            let hasVisible = false;
            for (let i = 0; i < group.gridContainer.children.length; i++) {
              const child = group.gridContainer.children[i];
              if (child.style.display !== "none") {
                hasVisible = true;
                break;
              }
            }
            group.headingEl.setCssStyles({ display: hasVisible ? "" : "none" });
            group.gridContainer.setCssStyles({ display: hasVisible ? "grid" : "none" });
          } else {
            group.headingEl.setCssStyles({ display: "" });
            let isCurrentlyCollapsed = false;
            if (group.toggleBtn) {
              isCurrentlyCollapsed = this.plugin.settings.collapsed[group.title] || false;
              const b = group.toggleBtn;
              b.setIcon(isCurrentlyCollapsed ? "chevron-right" : "chevron-down").setTooltip(isCurrentlyCollapsed ? "\u5C55\u5F00" : "\u6298\u53E0");
            }
            group.gridContainer.setCssStyles({ display: isCurrentlyCollapsed ? "none" : "grid" });
            Array.from(group.gridContainer.children).forEach((el) => el.setCssStyles({ display: "flex" }));
          }
        });
      }, 150);
    });
  }
};
