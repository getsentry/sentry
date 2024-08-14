import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {NoteInputWithStorage} from 'sentry/components/activity/note/inputWithStorage';
import localStorage from 'sentry/utils/localStorage';

jest.mock('sentry/utils/localStorage');

async function changeReactMentionsInput(value: string) {
  const textbox = screen.getByRole('textbox');

  await userEvent.clear(textbox);
  await userEvent.type(textbox, value);
}

describe('NoteInputWithStorage', function () {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const defaultProps = {
    storageKey: 'storage',
    itemKey: 'item1',
    group: {project: {}, id: 'groupId'},
    memberList: [],
    teams: [],
  };

  it('loads draft item from local storage when mounting', function () {
    jest
      .mocked(localStorage.getItem)
      .mockImplementation(() => JSON.stringify({item1: 'saved item'}));

    render(<NoteInputWithStorage {...defaultProps} />);

    expect(localStorage.getItem).toHaveBeenCalledWith('storage');
    expect(screen.getByRole('textbox')).toHaveValue('saved item');
  });

  it('saves draft when input changes', async function () {
    render(<NoteInputWithStorage {...defaultProps} />);

    await userEvent.clear(screen.getByRole('textbox'));
    await changeReactMentionsInput('WIP COMMENT');

    expect(localStorage.setItem).toHaveBeenLastCalledWith(
      'storage',
      JSON.stringify({item1: 'WIP COMMENT'})
    );
  });

  it('removes draft item after submitting', async function () {
    jest
      .mocked(localStorage.getItem)
      .mockImplementation(() =>
        JSON.stringify({item1: 'draft item', item2: 'item2', item3: 'item3'})
      );

    render(<NoteInputWithStorage {...defaultProps} />);

    await changeReactMentionsInput('new comment');
    await userEvent.type(screen.getByRole('textbox'), '{Control>}{enter}{/Control}');

    expect(localStorage.setItem).toHaveBeenLastCalledWith(
      'storage',
      JSON.stringify({item2: 'item2', item3: 'item3'})
    );
  });
});
