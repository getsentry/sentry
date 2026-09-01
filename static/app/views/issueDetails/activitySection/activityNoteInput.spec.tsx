import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {localStorageWrapper} from 'sentry/utils/localStorage';
import {ActivityNoteInput} from 'sentry/views/issueDetails/activitySection/activityNoteInput';

function getEditor() {
  const editor = screen.getByRole('combobox', {name: 'Add a comment'});
  // user-event does not yet recognize contenteditable="plaintext-only".
  editor.setAttribute('contenteditable', 'true');
  return editor;
}

describe('ActivityNoteInput', () => {
  beforeEach(() => {
    localStorage.clear();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      body: [],
    });
  });

  it('loads and saves a draft', async () => {
    localStorageWrapper.setItem('storage', JSON.stringify({item1: 'saved item'}));

    render(
      <ActivityNoteInput
        itemKey="item1"
        onSubmit={() => Promise.resolve()}
        storageKey="storage"
      />
    );

    const editor = getEditor();
    expect(editor).toHaveTextContent('saved item');
    await userEvent.click(editor);
    await userEvent.keyboard('{End} updated');

    await waitFor(() =>
      expect(localStorageWrapper.getItem('storage')).toBe(
        JSON.stringify({item1: 'saved item updated'})
      )
    );
  });

  it('removes the draft after submitting', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    localStorageWrapper.setItem(
      'storage',
      JSON.stringify({item1: 'draft item', item2: 'item2', item3: 'item3'})
    );

    render(
      <ActivityNoteInput itemKey="item1" onSubmit={onSubmit} storageKey="storage" />
    );

    const editor = getEditor();
    await userEvent.type(editor, 'new comment{Control>}{enter}{/Control}');

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    await waitFor(() => expect(editor).toBeEmptyDOMElement());
    expect(localStorageWrapper.getItem('storage')).toBe(
      JSON.stringify({item2: 'item2', item3: 'item3'})
    );
  });
});
