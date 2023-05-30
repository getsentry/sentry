import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {NoteInput} from 'sentry/components/activity/note/input';

describe('NoteInput', function () {
  describe('New item', function () {
    it('renders', function () {
      render(<NoteInput />);
    });

    it('submits when meta + enter is pressed', async function () {
      const onCreate = jest.fn();
      render(<NoteInput onCreate={onCreate} />);

      await userEvent.type(screen.getByRole('textbox'), 'something{Meta>}{Enter}');
      expect(onCreate).toHaveBeenCalled();
    });

    it('submits when ctrl + enter is pressed', async function () {
      const onCreate = jest.fn();
      render(<NoteInput onCreate={onCreate} />);

      await userEvent.type(screen.getByRole('textbox'), 'something{Control>}{Enter}');
      expect(onCreate).toHaveBeenCalled();
    });

    it('does not submit when nothing is entered', async function () {
      const onCreate = jest.fn();
      render(<NoteInput onCreate={onCreate} />);

      const textbox = screen.getByRole('textbox');
      await userEvent.type(textbox, '{Control}{enter}');
      expect(onCreate).not.toHaveBeenCalled();
    });

    it('handles errors', async function () {
      const errorJSON = {detail: {message: 'Note is bad', code: 401, extra: ''}};
      render(<NoteInput error={!!errorJSON} errorJSON={errorJSON} />);

      await userEvent.type(screen.getByRole('textbox'), 'something{Control>}{enter}');
      expect(screen.getByText('Note is bad')).toBeInTheDocument();
    });

    it('has a disabled submit button when no text is entered', function () {
      render(<NoteInput />);

      expect(screen.getByRole('button', {name: 'Post Comment'})).toBeDisabled();
    });

    it('enables the submit button when text is entered', async function () {
      render(<NoteInput />);
      await userEvent.type(screen.getByRole('textbox'), 'something');

      expect(screen.getByRole('button', {name: 'Post Comment'})).toBeEnabled();
    });
  });

  describe('Existing Item', function () {
    const props = {
      noteId: 'item-id',
      text: 'an existing item',
    };

    it('edits existing message', async function () {
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

    it('canels editing and moves to preview mode', async function () {
      const onEditFinish = jest.fn();
      render(<NoteInput {...props} onEditFinish={onEditFinish} />);

      await userEvent.type(screen.getByRole('textbox'), ' new content');

      await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));
      expect(onEditFinish).toHaveBeenCalled();
    });
  });
});
