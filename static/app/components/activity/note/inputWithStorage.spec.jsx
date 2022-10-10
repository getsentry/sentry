import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import NoteInputWithStorage from 'sentry/components/activity/note/inputWithStorage';
import localStorage from 'sentry/utils/localStorage';

jest.mock('sentry/utils/localStorage');

describe('NoteInputWithStorage', function () {
  const defaultProps = {
    storageKey: 'test-key',
    itemKey: 'item1',
    group: {project: {}, id: 'groupId'},
    memberList: [],
    teams: [],
  };

  function renderComponent(props) {
    render(<NoteInputWithStorage {...defaultProps} {...props} />);
  }

  it('loads draft item from local storage when mounting', function () {
    localStorage.getItem.mockImplementation(() => JSON.stringify({item1: 'saved item'}));

    renderComponent();
    expect(localStorage.getItem).toHaveBeenCalledWith('test-key');
    expect(screen.getByRole('textbox')).toHaveValue('saved item');

    localStorage.getItem.mockRestore();
  });

  it('saves draft when input changes', function () {
    renderComponent();

    userEvent.type(screen.getByRole('textbox'), 'WIP COMMENT');
    expect(localStorage.setItem).toHaveBeenLastCalledWith(
      'test-key',
      JSON.stringify({item1: 'WIP COMMENT'})
    );
  });

  it('removes draft item after submitting', function () {
    localStorage.getItem.mockImplementation(() =>
      JSON.stringify({item1: 'draft item', item2: 'item2', item3: 'item3'})
    );

    renderComponent();

    userEvent.type(screen.getByRole('textbox'), 'new comment{ctrl}{enter}');
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'test-key',
      JSON.stringify({item2: 'item2', item3: 'item3'})
    );
  });
});
