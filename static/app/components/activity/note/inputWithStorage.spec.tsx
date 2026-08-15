import {GroupFixture} from 'sentry-fixture/group';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {NoteInputWithStorage} from 'sentry/components/activity/note/inputWithStorage';
import {GroupActivityType} from 'sentry/types/group';
import {localStorageWrapper} from 'sentry/utils/localStorage';

jest.mock('sentry/utils/localStorage');

function getEditor() {
  const editor = screen.getByRole('combobox', {name: 'Add a comment'});
  // user-event does not yet recognize contenteditable="plaintext-only".
  editor.setAttribute('contenteditable', 'true');
  return editor;
}

describe('NoteInputWithStorage', () => {
  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      body: [],
    });
    jest.clearAllMocks();
    jest.mocked(localStorageWrapper.getItem).mockReturnValue(null);
  });

  const defaultProps = {
    storageKey: 'storage',
    itemKey: 'item1',
    group: GroupFixture(),
  };

  it('loads and saves a draft', async () => {
    jest
      .mocked(localStorageWrapper.getItem)
      .mockImplementation(() => JSON.stringify({item1: 'saved item'}));

    render(<NoteInputWithStorage {...defaultProps} />);

    expect(localStorageWrapper.getItem).toHaveBeenCalledWith('storage');
    const editor = getEditor();
    expect(editor).toHaveTextContent('saved item');
    await userEvent.click(editor);
    await userEvent.keyboard('{End} updated');

    await waitFor(() =>
      expect(localStorageWrapper.setItem).toHaveBeenLastCalledWith(
        'storage',
        JSON.stringify({item1: 'saved item updated'})
      )
    );
  });

  it('removes draft item after submitting', async () => {
    jest
      .mocked(localStorageWrapper.getItem)
      .mockImplementation(() =>
        JSON.stringify({item1: 'draft item', item2: 'item2', item3: 'item3'})
      );

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1/comments/',
      method: 'POST',
      body: {
        id: '1',
        type: GroupActivityType.NOTE,
        data: {text: 'new comment'},
        dateCreated: '2024-01-01T00:00:00Z',
      },
    });

    render(<NoteInputWithStorage {...defaultProps} />);

    await userEvent.type(getEditor(), 'new comment{Control>}{enter}{/Control}');

    await waitFor(() => {
      expect(localStorageWrapper.setItem).toHaveBeenLastCalledWith(
        'storage',
        JSON.stringify({item2: 'item2', item3: 'item3'})
      );
    });
  });
});
