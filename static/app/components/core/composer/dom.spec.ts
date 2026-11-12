import {getEditorSelection, setEditorSelection, writeEditorValue} from './dom';

describe('Composer DOM selection', () => {
  it('reads and restores selection in the editor document', () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);

    try {
      const frameDocument = frame.contentDocument!;
      const editor = frameDocument.createElement('div');
      frameDocument.body.append(editor);
      writeEditorValue(editor, 'Hello @Alice', [{start: 6, end: 12, text: '@Alice'}]);

      const range = frameDocument.createRange();
      range.selectNodeContents(editor);
      frameDocument.getSelection()!.addRange(range);
      expect(getEditorSelection(editor)).toEqual({start: 0, end: 12});

      setEditorSelection(editor, {start: 6, end: 12});

      expect(frameDocument.getSelection()!.toString()).toBe('@Alice');
      expect(getEditorSelection(editor)).toEqual({start: 6, end: 12});
    } finally {
      frame.remove();
    }
  });
});
