// jsdom has no layout, so it omits Range geometry. Rich text editors such as
// Lexical measure the caret after every update to keep it scrolled into view.
if (typeof Range.prototype.getBoundingClientRect !== 'function') {
  Range.prototype.getBoundingClientRect = () => new DOMRect();
}
if (typeof Range.prototype.getClientRects !== 'function') {
  Range.prototype.getClientRects = () =>
    Object.assign([], {item: () => null}) as unknown as DOMRectList;
}

// Lexical only takes its `beforeinput` path, which all supported browsers use,
// when InputEvent exposes getTargetRanges.
if (typeof InputEvent.prototype.getTargetRanges !== 'function') {
  InputEvent.prototype.getTargetRanges = () => [];
}

// jsdom lacks Selection.modify, which editors use to move or extend the caret
// for deletion and arrow keys. This approximates it over the editable text:
// characters and words move by text offset, and larger units move to an end.
if (typeof Selection.prototype.modify !== 'function') {
  Selection.prototype.modify = function modify(
    alter?: string,
    direction?: string,
    granularity?: string
  ) {
    const {focusNode, focusOffset} = this;
    const focusElement =
      focusNode instanceof Element ? focusNode : focusNode?.parentElement;
    const root = focusElement?.closest(
      '[contenteditable]:not([contenteditable="false"])'
    );
    if (!focusNode || !root) {
      return;
    }

    const texts: Text[] = [];
    const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.parentElement?.closest('[contenteditable="false"]')) {
        texts.push(node as Text);
      }
    }
    const fullText = texts.map(text => text.data).join('');

    let position = 0;
    if (focusNode instanceof Text && texts.includes(focusNode)) {
      for (const text of texts) {
        if (text === focusNode) {
          position += focusOffset;
          break;
        }
        position += text.length;
      }
    } else {
      const range = root.ownerDocument.createRange();
      range.setStart(focusNode, focusOffset);
      for (const text of texts) {
        if (range.comparePoint(text, text.length) > 0) {
          break;
        }
        position += text.length;
      }
    }

    const isBackward = direction === 'backward' || direction === 'left';
    let next: number;
    if (granularity === 'character') {
      next = position + (isBackward ? -1 : 1);
    } else if (granularity === 'word') {
      const pattern = isBackward ? /\S+\s*$/ : /^\s*\S+/;
      const match = isBackward
        ? fullText.slice(0, position).match(pattern)
        : fullText.slice(position).match(pattern);
      next = position + (match ? (isBackward ? -1 : 1) * match[0].length : 0);
    } else {
      next = isBackward ? 0 : fullText.length;
    }
    next = Math.max(0, Math.min(fullText.length, next));

    let remaining = next;
    let point: [Node, number] = [root, root.childNodes.length];
    for (const text of texts) {
      if (remaining <= text.length) {
        point = [text, remaining];
        break;
      }
      remaining -= text.length;
    }

    if (alter === 'extend') {
      this.extend(...point);
    } else {
      this.collapse(...point);
    }
  };
}
