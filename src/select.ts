/**
 * Sets the cursor selection to cover the whole block.
 *
 * See documentation on `selectLine` for details.
 */

import { Editor, EditorPosition, EditorSelection } from "obsidian";
import { LINE_START_BLOCK } from "regex";

export function runSelectBlock(editor: Editor | undefined, avoidPrefixes: boolean) {
	// if the cursor is in a table, it doesn't select the table contents properly
	// because it tries to select the entire row.
	// fall back to just selecting the entire table cell
	const selection = document.getSelection();
	const closestTable = selection?.anchorNode?.parentElement?.closest("table");
	if (closestTable || !editor) {
		console.log("blockier: falling back to selecting closest live preview element");
		selectClosestCmContent();
		return;
	}

	const selections = editor.listSelections();

	const newSelections = selections.map((sel) => selectLine(editor, sel, avoidPrefixes));

	editor.setSelections(newSelections);
}

/**
 * A fallback selection to try and select the closest ".cm-content" element.
 *
 * A .cm-content is made for any live preview markdown editor, including table cells.
 */
function selectClosestCmContent() {
	const selection = document.getSelection();
	const closestContent = selection?.anchorNode?.parentElement?.closest(".cm-content");
	if (!selection || !closestContent) {
		return;
	}
	const range = document.createRange();
	range.selectNodeContents(closestContent);
	selection.removeAllRanges();
	selection.addRange(range);
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
