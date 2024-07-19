# Obsidian Blockier

A collection of small tools that make editing blocks (i.e. a paragraph, bullet point, checkbox, etc) easier.

This plugin mostly fills feature gaps that I did not find in other plugins. I highly recommend that you also have a look at these plugins:

- [Code Editor Shortcuts](https://github.com/timhor/obsidian-editor-shortcuts).
- Enabling "Move line down" and "Move line up" hotkeys (built-in).
- A theme that supports custom checkboxes/callouts, such as [AnuPpuccin](https://github.com/AnubisNekhet/AnuPpuccin).

## Features

### Select Block

Select block (overrides <kbd>ctrl</kbd>/<kbd>cmd</kbd> <kbd>A</kbd> by default) selects the block your cursor is currently in, excluding block prefixes like bullets `-`, numbers `1.`, headings `##`, quotes `>`, and checkboxes `- [ ]`. It can also be configured to select an entire code block if your cursor is in one.

![select](https://github.com/blorbb/obsidian-blockier/assets/88137137/b9d3e3a0-7d76-4f78-92d8-6ae8e204daf1)

This supports multiple cursors too. If the cursor selection spans multiple lines, block prefixes will be included.

Note that the <kbd>ctrl</kbd>/<kbd>cmd</kbd> <kbd>A</kbd> hotkey is **not** set via command hotkeys, to allow the usual select all to work in different places. If you wish to change this hotkey, disable this in settings and set a hotkey for the "Select block" command.

## Block Edit

Entering one of the block prefixes at the start of a block (but after an existing block prefix) will override it.

![block-edit](https://github.com/blorbb/obsidian-blockier/assets/88137137/8565b815-08d6-468c-86eb-717b7f78d92c)

This only applies to bullets, numbered lists and checkboxes.

## Custom Checkbox and Callout Suggestions

Some themes (like [AnuPpuccin](https://github.com/AnubisNekhet/AnuPpuccin)) have custom checkboxes and callouts. Putting your cursor in the checkbox/callout position will show a list of suggestions. The lists are configurable in settings.

Note that checkbox suggestions are disabled by default. Enable them in settings.

![checkbox-suggest](https://github.com/blorbb/obsidian-blockier/assets/88137137/32183548-b9c7-4718-bdba-ccba3aa77c9f)
![callout-suggest](https://github.com/blorbb/obsidian-blockier/assets/88137137/c467eb81-2250-4194-bf28-784e4f3dcbf6)
