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
  categories: {},
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
    el.style.display = "flex";
    el.style.alignItems = "center";
    el.style.gap = "10px";
    if (iconName === "\u6062\u590D\u9ED8\u8BA4\u72B6\u6001") {
      el.createSpan({ text: "\u{1F504} \u6062\u590D\u9ED8\u8BA4 (\u6838\u5FC3\u63D2\u4EF6\u6062\u590D\u539F\u7248 / \u7B2C\u4E09\u65B9\u6062\u590D\u62FC\u56FE)" });
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
  // 用于追踪正在重命名的分类
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
    const createSection = this.contentEl.createDiv({
      attr: { style: "background: var(--background-secondary); padding: 15px; border-radius: 8px; margin-bottom: 25px; border: 1px solid var(--background-modifier-border);" }
    });
    createSection.createEl("h4", { text: "\u2728 \u65B0\u5EFA\u5206\u7C7B", attr: { style: "margin-top: 0; margin-bottom: 10px; color: var(--text-normal);" } });
    const createSetting = new import_obsidian.Setting(createSection).setName("\u5206\u7C7B\u540D\u79F0").setDesc("\u521B\u5EFA\u4E00\u4E2A\u65B0\u7684\u5206\u7C7B\u6A21\u5757\u4EE5\u5F52\u7EB3\u63D2\u4EF6").addText(
      (text) => text.setPlaceholder("\u8F93\u5165\u5206\u7C7B\u540D\u79F0...").setValue(this.tempCategoryName).onChange((val) => this.tempCategoryName = val)
    ).addButton(
      (btn) => btn.setButtonText("\u521B\u5EFA\u5206\u7C7B").setCta().onClick(async () => {
        const name = this.tempCategoryName.trim();
        if (name && !this.plugin.settings.categories[name]) {
          this.plugin.settings.categories[name] = [];
          await this.plugin.saveSettings();
          this.tempCategoryName = "";
          this.display();
        }
      })
    );
    createSetting.settingEl.style.border = "none";
    createSetting.settingEl.style.padding = "0";
    const catKeys = Object.keys(this.plugin.settings.categories);
    if (catKeys.length > 0) {
      this.contentEl.createEl("h4", { text: "\u{1F4C2} \u73B0\u6709\u5206\u7C7B", attr: { style: "margin-bottom: 15px; padding-bottom: 5px; border-bottom: 1px solid var(--background-modifier-border); color: var(--text-normal);" } });
      const listContainer = this.contentEl.createDiv({
        attr: { style: "display: flex; flex-direction: column; gap: 12px; max-height: 45vh; overflow-y: auto; padding-right: 5px;" }
      });
      for (const cat of catKeys) {
        const itemDiv = listContainer.createDiv({
          attr: { style: "border: 1px solid var(--background-modifier-border); border-radius: 8px; padding: 12px 15px; background: var(--background-primary); transition: all 0.2s ease;" }
        });
        if (this.renamingCategory === cat) {
          let newCatName = cat;
          const renameSetting = new import_obsidian.Setting(itemDiv).setName("\u4FEE\u6539\u540D\u79F0").addText(
            (text) => text.setValue(cat).onChange((val) => newCatName = val)
          ).addButton(
            (btn) => btn.setButtonText("\u4FDD\u5B58").setCta().onClick(async () => {
              newCatName = newCatName.trim();
              if (newCatName && newCatName !== cat && !this.plugin.settings.categories[newCatName]) {
                this.plugin.settings.categories[newCatName] = this.plugin.settings.categories[cat];
                delete this.plugin.settings.categories[cat];
                if (this.plugin.settings.collapsed[cat] !== void 0) {
                  this.plugin.settings.collapsed[newCatName] = this.plugin.settings.collapsed[cat];
                  delete this.plugin.settings.collapsed[cat];
                }
                await this.plugin.saveSettings();
              }
              this.renamingCategory = null;
              this.display();
            })
          ).addButton(
            (btn) => btn.setButtonText("\u53D6\u6D88").onClick(() => {
              this.renamingCategory = null;
              this.display();
            })
          );
          renameSetting.settingEl.style.border = "none";
          renameSetting.settingEl.style.padding = "0";
        } else {
          const viewSetting = new import_obsidian.Setting(itemDiv).setName(cat).setDesc(`\u5305\u542B ${this.plugin.settings.categories[cat].length} \u4E2A\u63D2\u4EF6`).addButton(
            (btn) => btn.setIcon("pencil").setTooltip("\u4FEE\u6539\u5206\u7C7B\u540D\u79F0").onClick(() => {
              this.renamingCategory = cat;
              this.display();
            })
          ).addButton(
            (btn) => btn.setIcon("list").setTooltip("\u7BA1\u7406\u5206\u7C7B\u5185\u7684\u63D2\u4EF6").onClick(() => {
              this.editingCategory = cat;
              this.currentView = "edit";
              this.display();
            })
          ).addButton(
            (btn) => btn.setIcon("trash").setTooltip("\u5220\u9664\u8BE5\u5206\u7C7B\uFF08\u63D2\u4EF6\u5C06\u88AB\u79FB\u56DE\u539F\u5217\u8868\uFF09").setWarning().onClick(async () => {
              delete this.plugin.settings.categories[cat];
              delete this.plugin.settings.collapsed[cat];
              await this.plugin.saveSettings();
              this.display();
            })
          );
          viewSetting.settingEl.style.border = "none";
          viewSetting.settingEl.style.padding = "0";
        }
      }
    } else {
      this.contentEl.createEl("p", {
        text: "\u5F53\u524D\u6CA1\u6709\u81EA\u5B9A\u4E49\u5206\u7C7B\u3002\u4E0A\u65B9\u521B\u5EFA\u540E\uFF0C\u5206\u7C7B\u4F1A\u663E\u793A\u5728\u6B64\u5904\u3002",
        attr: { style: "text-align: center; color: var(--text-muted); margin-top: 20px; padding: 25px; background: var(--background-secondary); border-radius: 8px; border: 1px dashed var(--background-modifier-border);" }
      });
    }
  }
  renderEdit() {
    this.titleEl.setText(`\u{1F4DD} \u7F16\u8F91\u5206\u7C7B\u63D2\u4EF6: ${this.editingCategory}`);
    const headerDiv = this.contentEl.createDiv({ attr: { style: "background: var(--background-secondary); padding: 10px 15px; border-radius: 8px; border: 1px solid var(--background-modifier-border); margin-bottom: 20px;" } });
    const topSetting = new import_obsidian.Setting(headerDiv).setName("\u52FE\u9009\u8981\u52A0\u5165\u6B64\u5206\u7C7B\u7684\u63D2\u4EF6").setDesc("\u63D0\u793A\uFF1A\u5DF2\u5728\u5176\u4ED6\u5206\u7C7B\u4E2D\u7684\u63D2\u4EF6\u4F1A\u81EA\u52A8\u9690\u85CF\u3002").addButton(
      (btn) => btn.setButtonText("\u8FD4\u56DE\u5217\u8868").onClick(() => {
        this.currentView = "list";
        this.editingCategory = null;
        this.display();
      })
    );
    topSetting.settingEl.style.border = "none";
    topSetting.settingEl.style.padding = "0";
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
    const container = this.contentEl.createDiv({
      attr: { style: "max-height: 50vh; overflow-y: auto; padding: 15px; border: 1px solid var(--background-modifier-border); border-radius: 8px; display: flex; flex-direction: column; gap: 5px;" }
    });
    let availableCount = 0;
    for (const tab of communityTabs) {
      if (otherCatPlugins.has(tab.id)) continue;
      availableCount++;
      const originalName = manifests[tab.id]?.name || tab.name || tab.id;
      const customName = this.plugin.settings.names[tab.id];
      const displayName = customName ? `${customName} (${originalName})` : originalName;
      const row = new import_obsidian.Setting(container).setName(displayName).addToggle(
        (toggle) => toggle.setValue(currentCatPlugins.includes(tab.id)).onChange(async (val) => {
          let list = this.plugin.settings.categories[this.editingCategory];
          if (val) {
            if (!list.includes(tab.id)) list.push(tab.id);
          } else {
            list = list.filter((id) => id !== tab.id);
          }
          this.plugin.settings.categories[this.editingCategory] = list;
          await this.plugin.saveSettings();
        })
      );
      row.settingEl.style.padding = "8px 10px";
      row.settingEl.style.borderBottom = "1px solid var(--background-modifier-border)";
      row.settingEl.style.borderTop = "none";
    }
    if (availableCount === 0) {
      container.createEl("p", { text: "\u6CA1\u6709\u53EF\u7528\u7684\u63D2\u4EF6\u4E86\uFF0C\u5176\u4ED6\u63D2\u4EF6\u90FD\u5DF2\u88AB\u5206\u914D\u5B8C\u6BD5\u3002", attr: { style: "text-align: center; color: var(--text-muted); padding: 20px 0;" } });
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
      if (document.querySelector(".vertical-tab-header")) {
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
      categories: { ...DEFAULT_SETTINGS.categories, ...loadedData.categories || {} },
      collapsed: { ...DEFAULT_SETTINGS.collapsed, ...loadedData.collapsed || {} }
    };
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  patchSettingOpen() {
    if (!this.internalApp.setting) return;
    this.originalSettingOpen = this.internalApp.setting.open;
    const self = this;
    this.internalApp.setting.open = function(...args) {
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
      const header = document.querySelector(".vertical-tab-header");
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
    const header = document.querySelector(".vertical-tab-header");
    if (!header) return;
    const pendingNodes = /* @__PURE__ */ new Set();
    let timeoutId = null;
    this.mutationObserver = new MutationObserver((mutations) => {
      if (this.isApplying) return;
      let shouldUpdate = false;
      mutations.forEach((m) => {
        m.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            if (node.classList.contains("vertical-tab-nav-item") && node.hasAttribute("data-setting-id")) {
              pendingNodes.add(node);
              shouldUpdate = true;
            } else if (node.querySelectorAll) {
              node.querySelectorAll(".vertical-tab-nav-item[data-setting-id]").forEach((tab) => pendingNodes.add(tab));
              shouldUpdate = true;
            }
          }
        });
      });
      if (shouldUpdate) {
        if (timeoutId !== null) window.clearTimeout(timeoutId);
        timeoutId = window.setTimeout(() => {
          this.isApplying = true;
          pendingNodes.forEach((node) => this.applyIconToNavItem(node));
          pendingNodes.clear();
          this.isApplying = false;
        }, 10);
      }
    });
    this.mutationObserver.observe(header, { childList: true, subtree: true });
  }
  applyToExistingTabs() {
    const header = document.querySelector(".vertical-tab-header");
    if (!header) return;
    this.isApplying = true;
    header.querySelectorAll(".vertical-tab-nav-item[data-setting-id]").forEach((tabEl) => {
      this.applyIconToNavItem(tabEl);
    });
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
      targetIcon = isThirdParty ? "puzzle" : null;
    }
    if (customName && customName.trim() !== "") {
      if (!tabEl.dataset.originalName) {
        const walker2 = document.createTreeWalker(tabEl, NodeFilter.SHOW_TEXT, null);
        let node2;
        while (node2 = walker2.nextNode()) {
          if (node2.nodeValue && node2.nodeValue.trim() !== "") {
            tabEl.dataset.originalName = node2.nodeValue;
            break;
          }
        }
      }
      if (tabEl.getAttribute("aria-label") !== customName) {
        tabEl.setAttribute("aria-label", customName);
      }
      const walker = document.createTreeWalker(tabEl, NodeFilter.SHOW_TEXT, null);
      let node;
      while (node = walker.nextNode()) {
        if (node.nodeValue && node.nodeValue.trim() !== "") {
          if (node.nodeValue !== customName) node.nodeValue = customName;
          break;
        }
      }
    } else if (tabEl.dataset.originalName) {
      const walker = document.createTreeWalker(tabEl, NodeFilter.SHOW_TEXT, null);
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
    let customIconEl = tabEl.querySelector(".vertical-tab-nav-item-icon.custom-icon");
    let nativeIconEl = tabEl.querySelector(".vertical-tab-nav-item-icon:not(.custom-icon)");
    if (!targetIcon) {
      if (customIconEl) customIconEl.remove();
      if (nativeIconEl) nativeIconEl.style.display = "";
      return;
    }
    if (!customIconEl) {
      if (nativeIconEl) nativeIconEl.style.display = "none";
      customIconEl = document.createElement("div");
      customIconEl.classList.add("vertical-tab-nav-item-icon", "custom-icon");
      if (isThirdParty) {
        customIconEl.style.marginRight = "8px";
        customIconEl.style.display = "flex";
        customIconEl.style.alignItems = "center";
        customIconEl.style.justifyContent = "center";
      }
      const firstNode = tabEl.firstChild;
      firstNode ? tabEl.insertBefore(customIconEl, firstNode) : tabEl.appendChild(customIconEl);
    } else if (nativeIconEl) {
      nativeIconEl.style.display = "none";
    }
    if (customIconEl.dataset.icon !== targetIcon) {
      customIconEl.innerHTML = "";
      (0, import_obsidian.setIcon)(customIconEl, targetIcon);
      customIconEl.dataset.icon = targetIcon;
    }
  }
  restoreExistingTabs() {
    const header = document.querySelector(".vertical-tab-header");
    const allTabs = header ? header.querySelectorAll(".vertical-tab-nav-item[data-setting-id]") : document.querySelectorAll(".vertical-tab-nav-item[data-setting-id]");
    allTabs.forEach((tabEl) => {
      if (tabEl.dataset.originalName) {
        const walker = document.createTreeWalker(tabEl, NodeFilter.SHOW_TEXT, null);
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
      let customIconEl = tabEl.querySelector(".vertical-tab-nav-item-icon.custom-icon");
      if (customIconEl) customIconEl.remove();
      let nativeIconEl = tabEl.querySelector(".vertical-tab-nav-item-icon:not(.custom-icon)");
      if (nativeIconEl) nativeIconEl.style.display = "";
      tabEl.style.display = "";
      tabEl.style.alignItems = "";
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
    topHeaderContainer.style.display = "flex";
    topHeaderContainer.style.justifyContent = "space-between";
    topHeaderContainer.style.alignItems = "flex-start";
    topHeaderContainer.style.flexWrap = "wrap";
    topHeaderContainer.style.gap = "15px";
    topHeaderContainer.style.marginBottom = "25px";
    const titleArea = topHeaderContainer.createDiv();
    titleArea.createEl("h2", { text: "\u2699\uFE0F \u63D2\u4EF6\u540D\u79F0\u4E0E\u56FE\u6807\u81EA\u5B9A\u4E49", cls: "setting-item-heading" }).style.border = "none";
    titleArea.createEl("p", { text: "\u70B9\u51FB\u773C\u775B\u9690\u85CF/\u663E\u793A\uFF0C\u4E2D\u95F4\u6539\u56FE\u6807\uFF0C\u53F3\u4FA7\u6539\u540D\u79F0\u3002\u53EF\u5206\u7C7B\u7BA1\u7406\u3002", cls: "setting-item-description" });
    const searchInput = topHeaderContainer.createEl("input", {
      type: "search",
      placeholder: "\u{1F50D} \u641C\u7D22 \u63D2\u4EF6\u540D / \u81EA\u5B9A\u4E49\u540D / ID..."
    });
    searchInput.style.flex = "1";
    searchInput.style.minWidth = "250px";
    searchInput.style.maxWidth = "350px";
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
      gridEl.style.display = "grid";
      gridEl.style.gridTemplateColumns = isPhone ? "1fr" : "repeat(2, minmax(0, 1fr))";
      gridEl.style.gap = "15px";
      gridEl.style.marginBottom = "30px";
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
        setting.settingEl.style.backgroundColor = "var(--background-primary)";
        setting.setDesc(`ID: ${pluginId} (\u672C\u63D2\u4EF6)`);
      }
      setting.nameEl.empty();
      setting.nameEl.style.display = "flex";
      setting.nameEl.style.alignItems = "center";
      setting.nameEl.style.overflow = "hidden";
      const currentIcon = this.plugin.settings.icons[pluginId];
      const displayIcon = currentIcon !== void 0 ? currentIcon : fallbackIcon;
      const iconEl = document.createElement("span");
      iconEl.style.marginRight = "8px";
      iconEl.style.display = "inline-flex";
      iconEl.style.alignItems = "center";
      iconEl.style.flexShrink = "0";
      (0, import_obsidian.setIcon)(iconEl, displayIcon || "image");
      const nameSpan = document.createElement("span");
      nameSpan.textContent = this.plugin.settings.names[pluginId] || originalName;
      if (isPhone) {
        nameSpan.style.whiteSpace = "normal";
        nameSpan.style.wordBreak = "break-word";
      } else {
        nameSpan.style.whiteSpace = "nowrap";
        nameSpan.style.overflow = "hidden";
        nameSpan.style.textOverflow = "ellipsis";
      }
      nameSpan.style.flex = "1 1 auto";
      setting.nameEl.appendChild(iconEl);
      setting.nameEl.appendChild(nameSpan);
      setting.addExtraButton((btn) => {
        btn.setIcon("settings").setTooltip("\u8DF3\u8F6C\u5230\u8BE5\u9762\u677F\u8BBE\u7F6E").onClick(() => {
          if (this.internalApp.setting && typeof this.internalApp.setting.openTabById === "function") {
            this.internalApp.setting.openTabById(pluginId);
          }
        });
      });
      if (isSelf) {
        setting.addExtraButton((btn) => {
          btn.setIcon("lock").setTooltip("\u9632\u5446\u4FDD\u62A4\uFF1A\u4E0D\u5141\u8BB8\u9690\u85CF\u672C\u63D2\u4EF6\u81EA\u8EAB").setDisabled(true);
          setting.settingEl.style.opacity = "1";
        });
      } else {
        setting.addExtraButton((btn) => {
          btn.setIcon(isHidden ? "eye-off" : "eye").setTooltip(isHidden ? "\u53D6\u6D88\u9690\u85CF (\u5728\u4FA7\u8FB9\u680F\u663E\u793A)" : "\u5728\u4FA7\u8FB9\u680F\u4E2D\u9690\u85CF\u6B64\u9762\u677F").onClick(async () => {
            if (this.plugin.settings.hidden[pluginId]) {
              delete this.plugin.settings.hidden[pluginId];
              btn.setIcon("eye").setTooltip("\u9690\u85CF\u9762\u677F");
              setting.settingEl.style.opacity = "1";
            } else {
              this.plugin.settings.hidden[pluginId] = true;
              btn.setIcon("eye-off").setTooltip("\u53D6\u6D88\u9690\u85CF");
              setting.settingEl.style.opacity = "0.5";
            }
            await this.plugin.saveSettings();
            this.plugin.applyToExistingTabs();
          });
        });
      }
      setting.addExtraButton((btn) => {
        btn.setIcon(displayIcon || "image").setTooltip("\u66F4\u6539\u4FA7\u8FB9\u680F\u56FE\u6807").onClick(() => {
          new IconPickerModal(this.app, pluginId, this.plugin, async (selectedIcon) => {
            if (selectedIcon === null) {
              delete this.plugin.settings.icons[pluginId];
            } else {
              this.plugin.settings.icons[pluginId] = selectedIcon;
            }
            const newIcon = selectedIcon || fallbackIcon || "image";
            btn.setIcon(newIcon);
            (0, import_obsidian.setIcon)(iconEl, newIcon);
            await this.plugin.saveSettings();
            this.plugin.applyToExistingTabs();
          }).open();
        });
      });
      setting.addText((text) => {
        text.setPlaceholder("\u8F93\u5165\u60F3\u663E\u793A\u7684...").setValue(this.plugin.settings.names[pluginId] || "").onChange(async (value) => {
          this.plugin.settings.names[pluginId] = value;
          await this.plugin.saveSettings();
          nameSpan.textContent = value.trim() !== "" ? value : originalName;
          this.plugin.applyToExistingTabs();
        });
        text.inputEl.style.width = isPhone ? "auto" : "90px";
        if (isPhone) {
          text.inputEl.style.flex = "1";
          text.inputEl.style.minWidth = "100px";
        }
      });
      setting.settingEl.style.border = "1px solid var(--background-modifier-border)";
      setting.settingEl.style.borderRadius = "8px";
      setting.settingEl.style.padding = "12px 15px";
      setting.settingEl.style.margin = "0";
      if (!isSelf) {
        setting.settingEl.style.backgroundColor = "var(--background-secondary)";
      }
      setting.infoEl.style.flex = "1 1 auto";
      setting.infoEl.style.overflow = "hidden";
      setting.infoEl.style.minWidth = "0";
      if (isHidden && !isSelf) {
        setting.settingEl.style.opacity = "0.5";
      }
      searchItems.push({
        settingEl: setting.settingEl,
        pluginId: pluginId.toLowerCase(),
        originalName: originalName.toLowerCase(),
        getCustomName: () => (this.plugin.settings.names[pluginId] || "").toLowerCase()
      });
    };
    const mainContentEl = containerEl.createDiv();
    const renderSection = (title, tabs, isThirdParty, options = {}) => {
      const { showCategoryBtn = false, allowCollapse = true } = options;
      if (tabs.length === 0 && !showCategoryBtn) return;
      const headingSetting = new import_obsidian.Setting(mainContentEl).setName(title).setHeading();
      const grid = createGridContainer(mainContentEl);
      let isCollapsed = allowCollapse ? this.plugin.settings.collapsed[title] || false : false;
      grid.style.display = isCollapsed ? "none" : "grid";
      if (showCategoryBtn) {
        headingSetting.addExtraButton((btn) => {
          btn.setIcon("folder-cog").setTooltip("\u5206\u7C7B\u7BA1\u7406").onClick(() => {
            new CategoryManagerModal(this.app, this.plugin, () => this.display()).open();
          });
        });
      }
      let currentToggleBtn;
      if (allowCollapse) {
        headingSetting.addExtraButton((btn) => {
          currentToggleBtn = btn;
          btn.setIcon(isCollapsed ? "chevron-right" : "chevron-down").setTooltip(isCollapsed ? "\u5C55\u5F00" : "\u6298\u53E0").onClick(async () => {
            isCollapsed = !isCollapsed;
            this.plugin.settings.collapsed[title] = isCollapsed;
            await this.plugin.saveSettings();
            btn.setIcon(isCollapsed ? "chevron-right" : "chevron-down").setTooltip(isCollapsed ? "\u5C55\u5F00" : "\u6298\u53E0");
            grid.style.display = isCollapsed ? "none" : "grid";
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
    for (const cat in categories) {
      categories[cat].forEach((id) => assignedIds.add(id));
    }
    for (const catName in categories) {
      const ids = categories[catName];
      const catTabs = communityPluginTabs.filter((tab) => ids.includes(tab.id));
      renderSection(catName, catTabs, true);
    }
    const otherTabs = communityPluginTabs.filter((tab) => !assignedIds.has(tab.id));
    renderSection("\u7B2C\u4E09\u65B9\u63D2\u4EF6", otherTabs, true, {
      showCategoryBtn: true,
      allowCollapse: false
    });
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
          item.settingEl.style.display = match ? "flex" : "none";
        });
        groups.forEach((group) => {
          if (isSearching) {
            const hasVisible = Array.from(group.gridContainer.children).some((el) => el.style.display !== "none");
            group.headingEl.style.display = hasVisible ? "" : "none";
            group.gridContainer.style.display = hasVisible ? "grid" : "none";
          } else {
            group.headingEl.style.display = "";
            let isCurrentlyCollapsed = false;
            if (group.toggleBtn) {
              isCurrentlyCollapsed = this.plugin.settings.collapsed[group.title] || false;
              group.toggleBtn.setIcon(isCurrentlyCollapsed ? "chevron-right" : "chevron-down").setTooltip(isCurrentlyCollapsed ? "\u5C55\u5F00" : "\u6298\u53E0");
            }
            group.gridContainer.style.display = isCurrentlyCollapsed ? "none" : "grid";
            Array.from(group.gridContainer.children).forEach((el) => el.style.display = "flex");
          }
        });
      }, 150);
    });
  }
};
