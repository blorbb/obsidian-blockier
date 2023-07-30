import {
	App,
	Editor,
	EditorPosition,
	EditorSelection,
	MarkdownView,
	Plugin,
	PluginSettingTab,
	Setting,
} from "obsidian";

// note that when adding multiple of these together, the order sometimes matters.
// most specific should come before less specific (just CHECKBOX before BULLET)
const BLOCKS = {
	CHECKBOX: /- \[.]/,
	BULLET: /-|\*|\+/,
	NUMBER: /[0-9]+\./,
	HEADING: /#{1,6}/,
	QUOTE: />/,
} as const;

/**
 * Matches a block prefix without any leading/trailing spaces.
 */
const ANY_BLOCK = new RegExp(
	`${BLOCKS.CHECKBOX.source}|${BLOCKS.BULLET.source}|${BLOCKS.NUMBER.source}|${BLOCKS.HEADING.source}|${BLOCKS.QUOTE.source}`
);

/**
 * Matches a block prefix at the start of a line. Can be indented.
 *
 * Includes ending space.
 */
const LINE_START_BLOCK = new RegExp(`^\\s*(?:${ANY_BLOCK.source}) `);

/**
 * Matches block prefixes that can be overridden.
 */
const OVERRIDABLE_BLOCK = new RegExp(
	`${BLOCKS.CHECKBOX.source}|${BLOCKS.BULLET.source}|${BLOCKS.NUMBER.source}`
);
/**
 * Matches block prefixes that can override other blocks.
 *
 * Doesn't include checkbox because it already appends onto the bullet.
 */
const OVERRIDING_BLOCK = new RegExp(
	`${BLOCKS.BULLET.source}|${BLOCKS.NUMBER.source}`
);

/**
 * Matches whether the line is trying to override <existing> with <new>.
 *
 * Does not include ending space.
 */
const IS_OVERRIDING = new RegExp(
	`^(?<whitespace>\\s*)(?<existing>${OVERRIDABLE_BLOCK.source}) (?<new>${OVERRIDING_BLOCK.source})`
);

interface PluginSettings {
	replaceBlocks: boolean;
	selectAllAvoidsPrefixes: boolean;
}

const DEFAULT_SETTINGS: PluginSettings = {
	replaceBlocks: true,
	selectAllAvoidsPrefixes: true,
};

export default class BlockierPlugin extends Plugin {
	settings: PluginSettings;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new SettingsTab(this.app, this));

		this.addCommand({
			id: "select-block",
			name: "Select block",
			hotkeys: [{ modifiers: ["Meta"], key: "a" }],
			editorCallback: (editor: Editor) => {
				const selections = editor.listSelections();

				const newSelections = selections.map((sel) =>
					selectLine(
						editor,
						sel,
						this.settings.selectAllAvoidsPrefixes
					)
				);

				editor.setSelections(newSelections);
			},
		});

		this.registerDomEvent(document, "keydown", (ev) => {
			const view = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (this.settings.replaceBlocks && view && ev.key === " ") {
				tryReplace(view.editor);
			}
		});
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

function tryReplace(editor: Editor) {
	// the line will be in the state it was *before* the last character was added.
	const lineNum = editor.getCursor().line;
	const ch = editor.getCursor().ch;
	const line = editor.getLine(lineNum);

	// see if the line is trying to override the block prefix
	const match = line.match(IS_OVERRIDING);
	// check that the cursor is right after the override
	if (match?.[0].length !== ch) return;

	const groups = match.groups!;
	// don't override if the new prefix is the same as the old
	if (groups.new === groups.existing) return;

	// create a selection around the <existing> block prefix
	const leftPos: EditorPosition = {
		line: lineNum,
		ch: groups.whitespace.length,
	};
	const rightPos: EditorPosition = {
		line: lineNum,
		ch: match[0].length,
	};

	// replace with new block prefix
	editor.replaceRange(groups.new, leftPos, rightPos);
}

/**
 * Modifies a selection to cover the whole line.
 *
 * If the selection is on one line, it will select the whole paragraph,
 * excluding block prefixes (if `avoidPrefixes` is also `true`). These include:
 * - Unordered lists `-`, `+` and `*`
 * - Numbered lists `1.`, `2.`, ...
 * - Headings `#`, `##`, ...
 * - Checkboxes `- [ ]`, `- [x]`, ...
 * - Quotes `>`
 */
function selectLine(
	editor: Editor,
	selection: EditorSelection,
	avoidPrefixes: boolean
): EditorSelection {
	// set selection start and end (not anchor and head)
	const [start, end] = orderPositions(selection.anchor, selection.head);

	if (start.line !== end.line || !avoidPrefixes) {
		// selection spans multiple lines: select everything in those lines,
		// including bullets and other stuff that is usually left out.

		return {
			anchor: {
				ch: 0,
				line: start.line,
			},
			head: {
				ch: editor.getLine(end.line).length,
				line: end.line,
			},
		};
	} else {
		// selection spans one line: don't select parts at the start (if one exists)
		// TODO: detect if the selection is currently in a
		// code block. If so, just select the whole line

		const lineNum = start.line;
		const line = editor.getLine(lineNum);
		const paragraphStart = line.match(LINE_START_BLOCK)?.[0].length ?? 0;
		return {
			anchor: {
				ch: paragraphStart,
				line: lineNum,
			},
			head: {
				ch: line.length,
				line: lineNum,
			},
		};
	}
}

function orderPositions(
	anchor: EditorPosition,
	head: EditorPosition
): [EditorPosition, EditorPosition] {
	if (anchor.line < head.line) {
		return [anchor, head];
	} else if (anchor.line > head.line) {
		return [head, anchor];
		// below are if selection anchor and head are on the same line
	} else if (anchor.ch < head.ch) {
		return [anchor, head];
	} else {
		return [head, anchor];
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
				"Whether the `Select block` command will avoid selecting block prefixes like `- ` and `2. `."
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.selectAllAvoidsPrefixes)
					.onChange(async (value) => {
						this.plugin.settings.selectAllAvoidsPrefixes = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
