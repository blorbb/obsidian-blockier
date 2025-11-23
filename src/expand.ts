import { syntaxTree } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { EditorSelection, SelectionRange } from "@codemirror/state";
import type { Tree, NodeIterator, SyntaxNode, SyntaxNodeRef } from "@lezer/common";
import { Editor } from "obsidian";

// LISTS:
// list-1, list-2, ...
// to include the indentation:
// HyperMD-list-line wraps around the whole list

// PARSING strategy:
// for each node,
// look for the start names. if one is found, create the node.
// continue parsing for formats *excluding* those already on the stack.
// end a format once the end names are found, or end of line.

class InlineFormat {
	constructor(public readonly startNames: string[], public readonly endNames: string[]) {}
}

const KNOWN_FORMATS: InlineFormat[] = [
	// **bold**
	new InlineFormat(["formatting-strong"], ["formatting-strong"]),
	// *italic*
	new InlineFormat(["formatting-em"], ["formatting-em"]),
	// ==highlight==
	new InlineFormat(["formatting-highlight"], ["formatting-highlight"]),
	// ~~strike~~
	new InlineFormat(["formatting-strikethrough"], ["formatting-strikethrough"]),
	// %% comment %%
	new InlineFormat(["comment-start"], ["comment-end"]),

	// the links have a lot of common classes.
	// they must be in this order to parse correctly.

	// [bare link]
	// start and end have: formatting,formatting-link,hmd-barelink,link
	new InlineFormat(["hmd-barelink"], ["hmd-barelink"]),
	// [alias](link)
	// start also has: formatting,formatting-link,link
	// end also has:   formatting,formatting-link-string,string,url
	new InlineFormat(["formatting-link", "link"], ["formatting-link-string"]),
	// [[link]] or ![[link]]
	// start also has: formatting-link,formatting-link-start
	// end also has:   formatting-link,formatting-link-end
	new InlineFormat(
		["formatting-link", "formatting-link-start"],
		["formatting-link", "formatting-link-end"]
	),
];

const BOLD_FORMAT = KNOWN_FORMATS[0];
const ITALIC_FORMAT = KNOWN_FORMATS[1];

export function expandSelections(view: EditorView, editor: Editor): SelectionRange[] {
	// console.log(syntaxTree(view.state));
	console.log("=================================================");
	// use this instead of the one provided by obsidian editor
	// as it uses absolute indices, which is required by cm.
	const selections = view.state.selection.ranges;
	const tree = syntaxTree(view.state);
	tree.iterate({
		enter(node) {
			console.log(`${node.name.split("_")}(${node.from}..${node.to})`);
		},
	});

	console.log(NestedTree.fromTree(tree, editor));

	return selections.map((sel) => expandSelection(tree, sel));
}

function expandSelection(tree: Tree, selection: SelectionRange): SelectionRange {
	console.table({ selection });
	const fromTree = tree.resolveStack(selection.from);
	const toTree = tree.resolveStack(selection.to);

	let curr: NodeIterator | null = fromTree;
	const stack: SyntaxNode[] = [];
	while (curr != null) {
		stack.push(curr.node);
		curr = curr.next;
	}

	console.log(stack);

	const left = tree.resolveInner(selection.from).from;
	const right = tree.resolveInner(selection.to).to;
	// console.log(left, right, fromTree, toTree);
	return EditorSelection.range(left, right);
}

class NestedTree {
	constructor(
		public fmtLeft: number,
		public left: number,
		public right: number,
		public fmtRight: number,
		public children: NestedTree[],
		public parent?: NestedTree
	) {}

	// size of the formatting. symmetric for inline formatting,
	// but bullets/numbered lists etc are asymmetric.
	// both are handled the same way as if a format is not closed at the end of the line,
	// it is implicitly closed.
	public formatLen(): number {
		return this.left - this.fmtLeft;
	}

	public static fromTree(cmTree: Tree, editor: Editor): NestedTree {
		// a Tree isn't really a tree, it's very flat and the nodes are instead multiple formats combined.
		// e.g. the markdown **a *b* c *d*** has structure:
		// strong fmt fmt-strong(0..2)         | **
		// strong(2..4)                        | a
		// em strong fmt fmt-em(4..5)          | *
		// em strong(5..6)                     | b
		// em strong fmt fmt-em(6..7)          | *
		// strong(7..10)                       | c
		// em strong fmt fmt-em(10..11)        | *
		// em strong(11..12)                   | d
		// em em strong fmt fmt-strong(12..15) | ***

		// the only case of combined formatters is *** for italics and bold.
		// just handle this as a special case. all other formatters
		// have separate names.

		// since it sometimes combines multiple layers of formatting (em-bold),
		// detect how many layers got removed by reading the next text.
		// multiple formatting can be next to each other though.
		// the formatting always has the format itself as well.

		// invariant: there is only one of each instance
		const fmtStack: InlineFormat[] = [];
		const tree = new NestedTree(0, 0, 100, 100, []);
		// invariant: currentNode has the fmtLeft and left filled in correctly.
		let currentNode = tree;

		type Range = { from: number; to: number };

		const closeFormat = (node: Range) => {
			currentNode.right = node.from;
			currentNode.fmtRight = node.to;
			currentNode = currentNode.parent!;
			// currentNode goes deeper on every stack push,
			// and returns to parent on every stack pop.
			// so the parent will never be null.
			fmtStack.pop();
		};

		const openFormat = (format: InlineFormat, node: Range) => {
			// add as child of current node
			const newNode = new NestedTree(
				node.from,
				node.to,
				// these must be filled in later
				node.to,
				node.to,
				[],
				currentNode
			);
			currentNode.children.push(newNode);
			currentNode = newNode;
			fmtStack.push(format);
		};

		cmTree.iterate({
			enter(node) {
				const segments = node.name.split("_");

				// special case for *** format.
				// codemirror combines them into one. need to parse it manually.
				if (node.to - node.from === 3 && segments.includes("formatting-strong")) {
					// cases: top of the stack looks like
					// [bold]         -> [italic]       e.g. **bold***italic*
					// [italic, bold] -> []             e.g. *italic**bold***
					// [italic]       -> [bold]         e.g. *italic***bold**
					// [bold, italic] -> []             e.g. **bold*italic***
					// []             -> [italic, bold] e.g. ***bi**italic*
					if (fmtStack.last() == BOLD_FORMAT) {
						closeFormat({ from: node.from, to: node.to - 1 });

						if (fmtStack.last() == ITALIC_FORMAT) {
							closeFormat({ from: node.from + 2, to: node.to });
						} else if (!fmtStack.includes(ITALIC_FORMAT)) {
							openFormat(ITALIC_FORMAT, node);
						} else {
							console.warn("malformed input for italic->bold");
						}
					} else if (fmtStack.last() == ITALIC_FORMAT) {
						closeFormat(node);

						if (fmtStack.last() == BOLD_FORMAT) {
							closeFormat(node);
						} else if (!fmtStack.includes(BOLD_FORMAT)) {
							openFormat(BOLD_FORMAT, node);
						} else {
							console.warn("malformed input for bold->italic");
						}
					} else if (
						!fmtStack.includes(ITALIC_FORMAT) &&
						!fmtStack.includes(BOLD_FORMAT)
					) {
						openFormat(ITALIC_FORMAT, node);
						// TODO
					}
				}

				// try to close a format first.
				// this is required due to the overlap of the link types.
				if (fmtStack.last()?.endNames.every((x) => segments.includes(x))) {
					closeFormat(node);
					return;
				}

				// open a format
				for (const format of KNOWN_FORMATS) {
					// skip formats already in the stack
					if (fmtStack.some((x) => x == format)) continue;

					if (format.startNames.every((x) => segments.includes(x))) {
						openFormat(format, node);
						break;
					}
				}
			},
		});

		// close everything else in the tree.
		while (currentNode.parent) {
			console.warn("unclosed node");
			console.warn(fmtStack);
			currentNode.right = 100;
			currentNode.fmtRight = 100;
			currentNode = currentNode.parent;
		}

		return tree;
	}
}

/**
 *
 */
function toggleFormat(stack: string[], fmt: string): boolean {
	if (stack.last() === fmt) {
		stack.pop();
		return false;
	} else {
		stack.push(fmt);
		return true;
	}
}

function diffStack(stack: string[], formats: Set<string>) {
	// iterate through the stack top to bottom,
	//
	for (let i = stack.length - 1; i >= 0; i--) {
		const fmt = stack[i];

		if (formats.has(fmt)) {
		}
	}
}
