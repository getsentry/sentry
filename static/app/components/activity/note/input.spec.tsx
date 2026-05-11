import {TeamFixture} from 'sentry-fixture/team';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {NoteInput} from 'sentry/components/activity/note/input';
import {TeamStore} from 'sentry/stores/teamStore';

describe('NoteInput', () => {
  let membersRequest: jest.Mock;

  beforeEach(() => {
    TeamStore.reset();
    membersRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      body: [{user: UserFixture()}],
    });
  });

  describe('New item', () => {
    it('renders', async () => {
      render(<NoteInput />);
      expect(screen.getByRole('textbox')).toBeInTheDocument();
      await waitFor(() => expect(membersRequest).toHaveBeenCalled());
    });

    it('submits when meta + enter is pressed', async () => {
      const onCreate = jest.fn();
      render(<NoteInput onCreate={onCreate} />);

      await userEvent.type(screen.getByRole('textbox'), 'something{Meta>}{Enter}');
      expect(onCreate).toHaveBeenCalled();
    });

    it('submits when ctrl + enter is pressed', async () => {
      const onCreate = jest.fn();
      render(<NoteInput onCreate={onCreate} />);

      await userEvent.type(screen.getByRole('textbox'), 'something{Control>}{Enter}');
      expect(onCreate).toHaveBeenCalled();
    });

    it('does not submit when nothing is entered', async () => {
      const onCreate = jest.fn();
      render(<NoteInput onCreate={onCreate} />);

      const textbox = screen.getByRole('textbox');
      await userEvent.type(textbox, '{Control}{enter}');
      expect(onCreate).not.toHaveBeenCalled();
    });

    it('handles errors', async () => {
      const errorJSON = {detail: {message: 'Note is bad', code: 401, extra: ''}};
      render(<NoteInput error={!!errorJSON} errorJSON={errorJSON} />);

      await userEvent.type(screen.getByRole('textbox'), 'something{Control>}{enter}');
      expect(screen.getByText('Note is bad')).toBeInTheDocument();
    });

    it('has a disabled submit button when no text is entered', async () => {
      render(<NoteInput />);

      expect(screen.getByRole('button', {name: 'Post Comment'})).toBeDisabled();
      await waitFor(() => expect(membersRequest).toHaveBeenCalled());
    });

    it('enables the submit button when text is entered', async () => {
      render(<NoteInput />);
      await userEvent.type(screen.getByRole('textbox'), 'something');

      expect(screen.getByRole('button', {name: 'Post Comment'})).toBeEnabled();
    });

    it('can mention a team', async () => {
      TeamStore.loadInitialData([TeamFixture()]);
      const onCreate = jest.fn();
      render(<NoteInput onCreate={onCreate} />);
      await userEvent.type(screen.getByRole('textbox'), '#team');
      await userEvent.click(screen.getByRole('option', {name: '# team -slug'}));
      expect(screen.getByRole('textbox')).toHaveTextContent('#team-slug');
      await userEvent.click(screen.getByRole('button', {name: 'Post Comment'}));
      expect(onCreate).toHaveBeenCalledWith({
        text: '**#team-slug** ',
        mentions: ['team:1'],
      });
    });

    it('can mention a member', async () => {
      const onCreate = jest.fn();
      render(<NoteInput onCreate={onCreate} />);
      await userEvent.type(screen.getByRole('textbox'), '@foo');
      await userEvent.click(screen.getByRole('option', {name: 'Foo Bar'}));
      expect(screen.getByRole('textbox')).toHaveTextContent('@Foo Bar');
      await userEvent.click(screen.getByRole('button', {name: 'Post Comment'}));
      expect(onCreate).toHaveBeenCalledWith({
        text: '**@Foo Bar** ',
        mentions: ['user:1'],
      });
    });
  });

  describe('Existing Item', () => {
    const props = {
      noteId: 'item-id',
      text: 'an existing item',
    };

    it('edits existing message', async () => {
      const onUpdate = jest.fn();
      render(<NoteInput {...props} onUpdate={onUpdate} />);

      // Switch to preview
      await userEvent.click(screen.getByRole('tab', {name: 'Preview'}));

      expect(screen.getByText('an existing item')).toBeInTheDocument();

      // Switch to edit
      await userEvent.click(screen.getByRole('tab', {name: 'Edit'}));

      expect(screen.getByRole('textbox')).toHaveTextContent('an existing item');

      // Can edit text
      await userEvent.type(screen.getByRole('textbox'), ' new content{Control>}{Enter}');

      expect(onUpdate).toHaveBeenCalledWith({
        text: 'an existing item new content',
        mentions: [],
      });
    });

    it('canels editing and moves to preview mode', async () => {
      const onEditFinish = jest.fn();
      render(<NoteInput {...props} onEditFinish={onEditFinish} />);

      await userEvent.type(screen.getByRole('textbox'), ' new content');

      await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));
      expect(onEditFinish).toHaveBeenCalled();
    });
  });
});
