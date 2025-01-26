/**
 * Sets the cursor selection to cover the whole block.
 *
 * See documentation on `selectLine` for details.
 */

import { PluginSettings } from "main";
import { Editor, EditorPosition, EditorSelection } from "obsidian";
import { LINE_START_BLOCK } from "regex";

type SelectOpts = Pick<
	PluginSettings,
	"selectBlockAvoidsPrefixes" | "selectAllIfUnchanged" | "selectFullCodeBlock"
>;

export function runSelectBlock(editor: Editor | undefined, opts: SelectOpts) {
	// if the cursor is in a table, it doesn't select the table contents properly
	// because it tries to select the entire row.
	// fall back to just selecting the entire table cell
	const closestTable = closest(document.getSelection()?.anchorNode, "table");
	if (closestTable || !editor) {
		console.log("blockier: falling back to selecting closest live preview element");
		selectClosestCmContent();
		return;
	}

	const selections = editor.listSelections();

	let newSelections: EditorSelection[] | undefined;
	// select all text in a code block
	if (opts.selectFullCodeBlock && selections.length === 1) {
		const maybeSelection = trySelectCodeBlock(editor);
		newSelections = maybeSelection !== undefined ? [maybeSelection] : undefined;
	}

	if (newSelections === undefined) {
		newSelections = selections.map((sel) =>
			selectLine(editor, sel, opts.selectBlockAvoidsPrefixes)
		);
	}

	if (opts.selectAllIfUnchanged && selectionsEqual(selections, newSelections)) {
		selectClosestCmContent();
		return;
	}

	editor.setSelections(newSelections);
}

/**
 * A fallback selection to try and select the closest ".cm-content" element.
 *
 * A .cm-content is made for any live preview markdown editor, including table cells.
 */
function selectClosestCmContent() {
	const selection = document.getSelection();
	const closestContent = closest(selection?.anchorNode, ".cm-content");
	if (!selection || !closestContent) return;

	const range = document.createRange();
	range.selectNodeContents(closestContent);
	selection.removeAllRanges();
	selection.addRange(range);
}

/**
 * Tries to select an entire code block if the cursor is in a code block.
 *
 * Returns a new selection if one was successfully made.
 */
function trySelectCodeBlock(editor: Editor): EditorSelection | undefined {
	const selection = editor.listSelections().first();
	if (!selection) return;

	// check that the anchor and head node of the selection is within
	// a *single* code block (not across multiple).
	// if they aren't, don't do this code block selection.
	if (editor.getSelection().contains("```")) return;

	// if the cursor is on a code fence line, don't do the code block selection
	if (
		editor.getLine(selection.anchor.line).contains("```") ||
		editor.getLine(selection.anchor.line).contains("```")
	) {
		return;
	}

	// check for the number of code blocks fences above.
	// odd = in code block, even = not in code block.
	// except that code blocks can contain "```lang", so always count
	// finding these as being an opening.
	// "``` " counts as close, but "``` a" counts as open.
	const textAbove = editor.getRange({ line: 0, ch: 0 }, selection.anchor);
	let isInCodeBlock = false;
	textAbove.match(/```.*/g)?.forEach((match) => {
		if (match.trim().length > 3) {
			// there was a language specifier (also not only trailing whitespace)
			// always toggle as inside a code block
			isInCodeBlock = true;
		} else {
			// no language specifier, toggle between in and out.
			isInCodeBlock = !isInCodeBlock;
		}
	});

	if (!isInCodeBlock) return;

	// find start and end of the code block
	// not bothering with multiple opening fences within a code block
	// because that's just not sane text to care about.
	const lastLine = editor.lastLine();

	// search upwards
	let anchorLine = selection.anchor.line;
	let anchorLineContents = editor.getLine(anchorLine);
	while (!anchorLineContents.contains("```")) {
		if (anchorLine <= 0) return;
		anchorLine -= 1;
		anchorLineContents = editor.getLine(anchorLine);
	}

	// search downwards
	let headLine = selection.head.line;
	let headLineContents = editor.getLine(headLine);
	while (!headLineContents.endsWith("```")) {
		if (headLine >= lastLine) return;
		headLine += 1;
		headLineContents = editor.getLine(headLine);
	}

	return {
		anchor: { line: anchorLine + 1, ch: 0 },
		head: { line: headLine - 1, ch: editor.getLine(headLine - 1).length },
	};
}

/**
 * Modifies a selection to cover the whole line.
 *
 * If the selection is on one line, it will select the whole paragraph,
 * excluding block prefixes (if `avoidPrefixes` is also `true`). These include:
 * - Unordered lists `-`, `+` and `*`
 * - Numbered lists `1.`, `2.`, `3)`, ...
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

		const lineNum = start.line;
		const line = editor.getLine(lineNum);
		const groups = line.match(LINE_START_BLOCK)?.groups;
		const paragraphStart = groups?.["prefix0"]?.length ?? groups?.["prefix1"]?.length ?? 0;
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

/**
 * Reorders an anchor and head position to a start and end position.
 */
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

/**
 * Finds the closest parent element that matches the selector.
 *
 * If the node itself matches the selector, it will be returned.
 */
function closest(node: Node | null | undefined, selector: string): Element | null {
	if (!node) return null;
	if (node.nodeType === Node.ELEMENT_NODE) {
		const el = node as Element;
		return el.closest(selector);
	} else {
		// turn undefined into null
		return node.parentElement?.closest(selector) ?? null;
	}
}

// A bunch of equality functions to check equality of selections

/**
 * Checks if two lists of editor selections (must be same length) are equal.
 *
 * They are equal if all selections have the same corresponding anchor and head.
 * If the anchor and head are equal if swapped, it is still not counted.
 */
function selectionsEqual(a: EditorSelection[], b: EditorSelection[]): boolean {
	for (let i = 0; i < a.length; i++) {
		if (!selectionEqual(a[i], b[i])) {
			return false;
		}
	}
	return true;
}

function selectionEqual(a: EditorSelection, b: EditorSelection): boolean {
	return positionEqual(a.anchor, b.anchor) && positionEqual(a.head, b.head);
}

function positionEqual(a: EditorPosition, b: EditorPosition): boolean {
	return a.ch === b.ch && a.line == b.line;
}
