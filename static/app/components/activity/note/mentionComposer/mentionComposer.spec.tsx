import {MemberFixture} from 'sentry-fixture/member';
import {TeamFixture} from 'sentry-fixture/team';
import {UserFixture} from 'sentry-fixture/user';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {MentionComposer} from 'sentry/components/activity/note/mentionComposer/mentionComposer';
import {TeamStore} from 'sentry/stores/teamStore';

function getEditor(name = 'Add a comment') {
  const editor = screen.getByRole('combobox', {name});
  // user-event does not yet recognize contenteditable="plaintext-only".
  editor.setAttribute('contenteditable', 'true');
  return editor;
}

const noopSubmit = () => Promise.resolve();

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
    render(<MentionComposer mode="create" onSubmit={noopSubmit} />);

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

    render(<MentionComposer mode="create" onSubmit={noopSubmit} />);
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
    render(<MentionComposer mode="create" onSubmit={onSubmit} />);

    const textbox = getEditor();
    await userEvent.type(textbox, 'Thanks @ali');
    await userEvent.click(await screen.findByRole('option', {name: /Alice Example/}));
    await userEvent.type(textbox, 'and #front');
    await userEvent.keyboard('{Enter}');
    expect(onSubmit).not.toHaveBeenCalled();
    await userEvent.keyboard('{Enter}');

    expect(onSubmit).toHaveBeenCalledWith({
      text: 'Thanks **@Alice Example** and **#frontend** ',
      mentions: ['user:1', 'team:1'],
    });
    await waitFor(() => expect(textbox).toHaveTextContent(''));
    expect(screen.queryByRole('button', {name: 'Comment'})).not.toBeInTheDocument();
  });

  it('keeps Shift+Enter as a newline and submits with Enter', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<MentionComposer mode="create" onSubmit={onSubmit} />);

    const textbox = getEditor();
    await userEvent.type(textbox, 'First line{Shift>}{Enter}{/Shift}Second line');
    expect(onSubmit).not.toHaveBeenCalled();
    await userEvent.keyboard('{Enter}');

    expect(onSubmit).toHaveBeenCalledWith({
      text: 'First line\nSecond line',
      mentions: [],
    });
  });

  it('does not submit with Alt+Enter', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<MentionComposer mode="create" onSubmit={onSubmit} />);

    await userEvent.type(getEditor(), 'Draft{Alt>}{Enter}{/Alt}');

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it.each(['Control', 'Meta'])(
    'submits with %s+Enter while suggestions are open',
    async modifier => {
      const onSubmit = jest.fn().mockResolvedValue(undefined);
      render(<MentionComposer mode="create" onSubmit={onSubmit} />);

      await userEvent.type(getEditor(), '@ali');
      await screen.findByRole('option', {name: /Alice Example/});
      await userEvent.keyboard(`{${modifier}>}{Enter}{/${modifier}}`);

      expect(onSubmit).toHaveBeenCalledWith({text: '@ali', mentions: []});
    }
  );

  it('inserts a newline instead of selecting a suggestion with Shift+Enter', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<MentionComposer mode="create" onSubmit={onSubmit} />);

    await userEvent.type(getEditor(), '@ali');
    await screen.findByRole('option', {name: /Alice Example/});
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}Next line');
    expect(onSubmit).not.toHaveBeenCalled();
    await userEvent.keyboard('{Enter}');

    expect(onSubmit).toHaveBeenCalledWith({text: '@ali\nNext line', mentions: []});
  });

  it('does not submit empty comments', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<MentionComposer mode="create" onSubmit={onSubmit} />);

    await userEvent.type(getEditor(), '{Enter}   {Enter}');

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('button', {name: 'Comment'})).toBeDisabled();
  });

  it('submits with Enter when there are no matching suggestions', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<MentionComposer mode="create" onSubmit={onSubmit} />);

    await userEvent.type(getEditor(), '#missing');
    expect(await screen.findByText('No suggestions found')).toBeVisible();
    await userEvent.keyboard('{Enter}');

    expect(onSubmit).toHaveBeenCalledWith({text: '#missing', mentions: []});
  });

  it('does not submit while suggestions are loading', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      body: () => new Promise(() => {}), // Never resolves
    });

    render(<MentionComposer mode="create" onSubmit={onSubmit} />);

    await userEvent.type(getEditor(), '@query');
    expect(await screen.findByText('Loading suggestions…')).toBeVisible();
    await userEvent.keyboard('{Enter}');

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it.each(['native', 'tracked'])(
    'does not submit during %s IME composition',
    async composition => {
      const onSubmit = jest.fn().mockResolvedValue(undefined);
      render(<MentionComposer mode="create" onSubmit={onSubmit} />);
      const editor = getEditor();
      await userEvent.type(editor, 'Draft');

      act(() => {
        if (composition === 'tracked') {
          editor.dispatchEvent(new CompositionEvent('compositionstart', {bubbles: true}));
        }
        editor.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'Enter',
            bubbles: true,
            cancelable: true,
            isComposing: composition === 'native',
          })
        );
      });
      expect(onSubmit).not.toHaveBeenCalled();

      if (composition === 'tracked') {
        act(() => {
          editor.dispatchEvent(new CompositionEvent('compositionend', {bubbles: true}));
        });
      }
      await userEvent.keyboard('{Enter}');
      expect(onSubmit).toHaveBeenCalledWith({text: 'Draft', mentions: []});
    }
  );

  it('does not submit on Enter immediately after composition ends (Safari)', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<MentionComposer mode="create" onSubmit={onSubmit} />);
    const editor = getEditor();
    await userEvent.type(editor, 'Draft');

    act(() => {
      editor.dispatchEvent(new CompositionEvent('compositionstart', {bubbles: true}));
      editor.textContent = 'Draft日本語';
      editor.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          data: '日本語',
          inputType: 'insertCompositionText',
          isComposing: true,
        })
      );
    });

    act(() => {
      editor.dispatchEvent(
        new CompositionEvent('compositionend', {
          bubbles: true,
          data: '日本語',
        })
      );
    });

    // Safari fires Enter immediately after compositionend with isComposing=false
    act(() => {
      editor.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
          isComposing: false,
        })
      );
    });

    // First Enter after composition should be blocked
    expect(onSubmit).not.toHaveBeenCalled();

    // Subsequent Enter should submit normally
    await userEvent.keyboard('{Enter}');
    expect(onSubmit).toHaveBeenCalledWith({text: 'Draft日本語', mentions: []});
  });

  it('renders selected mentions in Markdown preview', async () => {
    render(<MentionComposer mode="create" onSubmit={noopSubmit} />);

    const textbox = getEditor();
    await userEvent.type(textbox, '@ali');
    await userEvent.keyboard('{Enter}');
    await userEvent.click(screen.getByRole('radio', {name: 'Preview'}));

    expect(screen.getByText('@Alice Example').closest('strong')).toBeInTheDocument();
  });

  it.each(['Enter', 'Save button'])('submits an edited comment with %s', async method => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(
      <MentionComposer
        initialValue="Existing comment"
        mode="edit"
        onCancel={jest.fn()}
        onSubmit={onSubmit}
      />
    );

    const editor = getEditor('Edit comment');
    await userEvent.click(editor);
    await userEvent.keyboard('{End} updated');
    if (method === 'Enter') {
      await userEvent.keyboard('{Enter}');
    } else {
      await userEvent.click(screen.getByRole('button', {name: 'Save comment'}));
    }

    expect(onSubmit).toHaveBeenCalledWith({
      text: 'Existing comment updated',
      mentions: [],
    });
  });
});
