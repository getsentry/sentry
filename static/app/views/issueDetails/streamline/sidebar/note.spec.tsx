import {TeamFixture} from 'sentry-fixture/team';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import MemberListStore from 'sentry/stores/memberListStore';
import TeamStore from 'sentry/stores/teamStore';
import {StreamlinedNoteInput} from 'sentry/views/issueDetails/streamline/sidebar/note';

describe('StreamlinedNoteInput', () => {
  beforeEach(() => {
    TeamStore.reset();
    MemberListStore.reset();
  });

  it('can mention a member', async () => {
    MemberListStore.loadInitialData([UserFixture()], false, null);
    const onCreate = jest.fn();
    render(<StreamlinedNoteInput onCreate={onCreate} />);
    await userEvent.type(screen.getByRole('textbox', {name: 'Add a comment'}), '@foo');
    await userEvent.click(screen.getByRole('option', {name: 'Foo Bar'}));
    expect(screen.getByRole('textbox')).toHaveTextContent('@Foo Bar');
    await userEvent.click(screen.getByRole('button', {name: 'Submit comment'}));
    expect(onCreate).toHaveBeenCalledWith({
      text: '**@Foo Bar** ',
      mentions: ['user:1'],
    });
  });

  it('can mention a team', async () => {
    TeamStore.loadInitialData([TeamFixture()]);
    const onCreate = jest.fn();
    render(<StreamlinedNoteInput onCreate={onCreate} />);
    await userEvent.type(screen.getByRole('textbox', {name: 'Add a comment'}), '#team');
    await userEvent.click(screen.getByRole('option', {name: '# team -slug'}));
    expect(screen.getByRole('textbox')).toHaveTextContent('#team-slug');
    await userEvent.click(screen.getByRole('button', {name: 'Submit comment'}));
    expect(onCreate).toHaveBeenCalledWith({
      text: '**#team-slug** ',
      mentions: ['team:1'],
    });
  });
});
