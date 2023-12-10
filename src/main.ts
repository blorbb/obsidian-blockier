import {
	App,
	MarkdownView,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
} from "obsidian";
import { keymap } from "@codemirror/view";
import { tryReplace as tryReplaceBlock } from "replace";
import { runSelectBlock } from "select";
import { CalloutSuggest, CheckboxSuggest } from "suggest";

interface PluginSettings {
	replaceBlocks: boolean;
	selectAllAvoidsPrefixes: boolean;
	showCheckboxSuggestions: boolean;
	checkboxVariants: string;
	showCalloutSuggestions: boolean;
	calloutSuggestions: string;
	enableBlockHotkey: boolean;
	selectBlockHotkey: string;

}

const DEFAULT_SETTINGS: PluginSettings = {
	replaceBlocks: true,
	selectAllAvoidsPrefixes: true,
	showCheckboxSuggestions: false,
	checkboxVariants: ' x><!-/?*nliISpcb"0123456789',
	showCalloutSuggestions: true,
	calloutSuggestions:
		"note, summary, info, todo, tip, check, help, warning, fail, error, bug, example, quote",
	enableBlockHotkey: true,
	selectBlockHotkey: "Mod-Shift-a"
};

export default class BlockierPlugin extends Plugin {
	settings: PluginSettings;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new SettingsTab(this.app, this));

		this.registerEditorExtension(
			keymap.of([
				{
					key: "Space",
					run: () => {
						const view =
							this.app.workspace.getActiveViewOfType(
								MarkdownView
							);
						if (this.settings.replaceBlocks && view) {
							tryReplaceBlock(view.editor);
						}
						return false;
					},
				},
			])
		);

		// can't use command hotkeys as it prevents selection in other contexts
		if (this.settings.enableBlockHotkey) {
			this.registerEditorExtension(
				keymap.of([
					{
						key: (this.settings.selectBlockHotkey).toLowerCase(),
						run: () => {
							const editor = this.app.workspace.activeEditor?.editor;
							if (editor) {
								runSelectBlock(
									editor,
									this.settings.selectAllAvoidsPrefixes
								);
							}
							// stop other bindings
							// doesn't work if this returns false.
							return true;
						},
					},
				])
			);
		}

		// Checking at plugin initialisation instead of every keypress.
		// Requires reload if this setting is changed.
		if (this.settings.showCheckboxSuggestions) {
			this.registerEditorSuggest(
				new CheckboxSuggest(
					this.app,
					this,
					this.settings.checkboxVariants
				)
			);
		}

		if (this.settings.showCalloutSuggestions) {
			this.registerEditorSuggest(
				new CalloutSuggest(
					this.app,
					this,
					this.settings.calloutSuggestions
				)
			);
		}
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SettingsTab extends PluginSettingTab {
	plugin: BlockierPlugin;

	constructor(app: App, plugin: BlockierPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Replace blocks")
			.setDesc(
				"Replaces the block type if you enter the prefix at the start of the paragraph."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.replaceBlocks)
					.onChange(async (value) => {
						this.plugin.settings.replaceBlocks = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Only select paragraphs")
			.setDesc(
				"Whether the Select block command will avoid selecting block prefixes."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.selectAllAvoidsPrefixes)
					.onChange(async (value) => {
						this.plugin.settings.selectAllAvoidsPrefixes = value;
						await this.plugin.saveSettings();
					})
			);



		new Setting(containerEl)
			.setName("Show checkbox suggestions")
			.setDesc(
				"Whether to show suggestions of checkbox variants supported by your theme. Reload required."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showCheckboxSuggestions)
					.onChange(async (value) => {
						this.plugin.settings.showCheckboxSuggestions = value;
						await this.plugin.saveSettings();
						new Notice("Reload required!");
					})
			);

		new Setting(containerEl)
			.setName("Checkbox suggestion variants")
			.setDesc(
				"Which checkboxes to be shown in the suggestion. These should be supported by your theme. Each character will be one suggestion."
			)
			.addText((text) =>
				text
					.setValue(this.plugin.settings.checkboxVariants)
					.onChange(async (value) => {
						this.plugin.settings.checkboxVariants = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Show callout suggestions")
			.setDesc(
				"Whether to show suggestions of callout variants supported by your theme. Reload required."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showCalloutSuggestions)
					.onChange(async (value) => {
						this.plugin.settings.showCalloutSuggestions = value;
						await this.plugin.saveSettings();
						new Notice("Reload required!");
					})
			);

		new Setting(containerEl)
			.setName("Callout suggestion variants")
			.setDesc(
				"Which callouts to be shown in the suggestion. Separate by commas."
			)
			.addTextArea((text) =>
				text
					.setValue(this.plugin.settings.calloutSuggestions)
					.onChange(async (value) => {
						this.plugin.settings.calloutSuggestions = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Enable block hotkey")
			.setDesc(
				"Whether to enable the block hotkey. Disable if it conflicts with another plugin."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableBlockHotkey)
					.onChange(async (value) => {
						this.plugin.settings.enableBlockHotkey = value;
						await this.plugin.saveSettings();
						this.display();
					})
			);
		if (this.plugin.settings.enableBlockHotkey) {
			const desc = document.createDocumentFragment();
			desc.createEl("span", { text: "Hotkey to select the current block." })
			desc.createEl("br");
			desc.createEl("span", {text: "Requires reload."});
			desc.createEl("br");
			new Setting(containerEl)
				.setName("Block hotkey")
				.setDesc(desc)
				.addButton((button) =>
					button
						.setButtonText("Change keybinding")
						.onClick(async () => {
							let keyPress:string[] = []
							button.setButtonText("Waiting for keypress...");
							button.buttonEl.addEventListener("keydown", (e) => {
								e.preventDefault();
								e.stopPropagation();
								let key = e.key;
								if (key === "Control") {
									key = "Mod"
								}
								if(!keyPress.includes(key)){
									keyPress.push(key);
								}
								button.buttonEl.focus();
							});
							//save on keyUp
							button.buttonEl.addEventListener("keyup", (e) => {
								e.preventDefault();
								e.stopPropagation();
								//remove duplicates
								keyPress=keyPress.filter((item, index) => keyPress.indexOf(item) === index);
								this.plugin.settings.selectBlockHotkey = keyPress.join("-").toLowerCase();
								this.plugin.saveSettings();
								new Notice("Keybinding saved!");
								this.display();
							});
						})
				)
				//display a false input to show the keybinding
				.addText((text) =>
					text
						.setValue(this.plugin.settings.selectBlockHotkey)
						.setDisabled(true)
				)
				.addButton((button) =>
					button
						.setIcon("cross")
						.setTooltip("Reset to default")
						.onClick(async () => {
							this.plugin.settings.selectBlockHotkey = DEFAULT_SETTINGS.selectBlockHotkey.toLowerCase();
							this.display();
						})
				);

		}
	}
}
