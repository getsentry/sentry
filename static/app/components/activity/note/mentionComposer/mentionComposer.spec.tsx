import {MemberFixture} from 'sentry-fixture/member';
import {TeamFixture} from 'sentry-fixture/team';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {MentionComposer} from 'sentry/components/activity/note/mentionComposer/mentionComposer';
import {TeamStore} from 'sentry/stores/teamStore';

function getEditor() {
  const editor = screen.getByRole('combobox', {name: 'Add a comment'});
  // user-event does not yet recognize contenteditable="plaintext-only".
  editor.setAttribute('contenteditable', 'true');
  return editor;
}

describe('MentionComposer', () => {
  beforeEach(() => {
    TeamStore.reset();
    TeamStore.loadInitialData([TeamFixture({id: '1', slug: 'frontend'})]);
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      body: [
        MemberFixture({
          user: UserFixture({id: '1', name: 'Alice Example'}),
        }),
      ],
    });
  });

  it('shows editor controls after focusing the editor', async () => {
    render(<MentionComposer />);

    expect(screen.queryByRole('radio', {name: 'Write'})).not.toBeInTheDocument();

    await userEvent.click(getEditor());

    expect(screen.getByRole('radio', {name: 'Write'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Comment'})).toBeDisabled();
  });

  it('shows relevant members with their email', async () => {
    const user = UserFixture({
      id: '2',
      name: 'Remote Teammate',
      email: 'alice.remote@example.com',
    });
    const searchRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      body: [MemberFixture({user})],
      match: [MockApiClient.matchQuery({query: 'alice'})],
    });

    render(<MentionComposer />);
    await userEvent.type(getEditor(), '@alice');

    const option = await screen.findByRole('option', {
      name: 'Remote Teammate alice.remote@example.com',
    });
    expect(option).toBeVisible();
    expect(screen.queryByRole('option', {name: /Alice Example/})).not.toBeInTheDocument();
    expect(searchRequest).toHaveBeenCalled();
  });

  it('submits serialized markdown and structured mention IDs', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<MentionComposer onSubmit={onSubmit} />);

    const textbox = getEditor();
    await userEvent.type(textbox, 'Thanks @ali');
    await userEvent.click(await screen.findByRole('option', {name: /Alice Example/}));
    await userEvent.type(textbox, 'and #front');
    await userEvent.keyboard('{Enter}');
    await userEvent.click(screen.getByRole('button', {name: 'Comment'}));

    expect(onSubmit).toHaveBeenCalledWith({
      text: 'Thanks **@Alice Example** and **#frontend** ',
      mentions: ['user:1', 'team:1'],
    });
  });

  it('keeps normal multiline text and submits with Ctrl+Enter', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<MentionComposer onSubmit={onSubmit} />);

    const textbox = getEditor();
    await userEvent.type(textbox, 'First line{Enter}Second line{Control>}{Enter}');

    expect(onSubmit).toHaveBeenCalledWith({
      text: 'First line\nSecond line',
      mentions: [],
    });
  });

  it('renders selected mentions in Markdown preview', async () => {
    render(<MentionComposer />);

    const textbox = getEditor();
    await userEvent.type(textbox, '@ali');
    await userEvent.keyboard('{Enter}');
    await userEvent.click(screen.getByRole('radio', {name: 'Preview'}));

    expect(screen.getByText('@Alice Example').closest('strong')).toBeInTheDocument();
  });
});
