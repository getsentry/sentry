import {
  getEditorSelection,
  readEditorValue,
  setEditorSelection,
  writeEditorValue,
} from './dom';

describe('Composer DOM selection', () => {
  it('treats rendered mentions as canonical text and maps their edges in a popout', () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    try {
      const frameDocument = frame.contentDocument!;
      const editor = frameDocument.createElement('div');
      frameDocument.body.append(editor);
      writeEditorValue(
        editor,
        'Hi @Alice!',
        [{start: 3, end: 9, text: '@Alice'}],
        (_, element) => {
          element.innerHTML = '<span>Avatar initials</span><span>Different name</span>';
        }
      );
      expect(readEditorValue(editor)).toBe('Hi @Alice!');
      setEditorSelection(editor, {start: 3, end: 9});
      expect(getEditorSelection(editor)).toEqual({start: 3, end: 9});
      const range = frameDocument.getSelection()!.getRangeAt(0);
      range.deleteContents();
      expect(readEditorValue(editor)).toBe('Hi !');
    } finally {
      frame.remove();
    }
  });

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
