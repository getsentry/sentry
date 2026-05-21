import {TeamFixture} from 'sentry-fixture/team';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {TeamStore} from 'sentry/stores/teamStore';
import {StreamlinedNoteInput} from 'sentry/views/issueDetails/streamline/sidebar/note';

describe('StreamlinedNoteInput', () => {
  beforeEach(() => {
    TeamStore.reset();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      body: [{user: UserFixture()}],
    });
  });

  it('can mention a member', async () => {
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

  it('can mention a member from search results', async () => {
    const searchedUser = UserFixture({
      id: '2',
      name: 'Nick Search',
      email: 'nick@example.com',
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      method: 'GET',
      body: [{user: searchedUser}],
      match: [MockApiClient.matchQuery({query: 'nick'})],
    });

    const onCreate = jest.fn();
    render(<StreamlinedNoteInput onCreate={onCreate} />);
    await userEvent.type(screen.getByRole('textbox', {name: 'Add a comment'}), '@nick');
    await userEvent.click(await screen.findByRole('option', {name: 'Nick Search'}));

    await userEvent.click(screen.getByRole('button', {name: 'Submit comment'}));
    expect(onCreate).toHaveBeenCalledWith({
      text: '**@Nick Search** ',
      mentions: ['user:2'],
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
