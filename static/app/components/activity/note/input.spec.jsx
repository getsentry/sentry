import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import NoteInput from 'sentry/components/activity/note/input';

describe('NoteInput', function () {
  describe('New item', function () {
    const props = {
      group: {project: {}, id: 'groupId'},
    };

    it('renders', function () {
      render(<NoteInput {...props} />);
    });

    it('submits when meta + enter is pressed', function () {
      const onCreate = jest.fn();
      render(<NoteInput {...props} onCreate={onCreate} />);

      userEvent.type(screen.getByRole('textbox'), 'something{meta}{enter}');
      expect(onCreate).toHaveBeenCalled();
    });

    it('submits when ctrl + enter is pressed', function () {
      const onCreate = jest.fn();
      render(<NoteInput {...props} onCreate={onCreate} />);

      userEvent.type(screen.getByRole('textbox'), 'something{ctrl}{enter}');
      expect(onCreate).toHaveBeenCalled();
    });

    it('does not submit when nothing is entered', function () {
      const onCreate = jest.fn();
      render(<NoteInput {...props} onCreate={onCreate} />);

      const textbox = screen.getByRole('textbox');
      userEvent.type(textbox, '{ctrl}{enter}');
      expect(onCreate).not.toHaveBeenCalled();
    });

    it('handles errors', function () {
      const errorJSON = {detail: {message: 'Note is bad', code: 401, extra: ''}};
      render(<NoteInput {...props} error={!!errorJSON} errorJSON={errorJSON} />);

      userEvent.type(screen.getByRole('textbox'), 'something{ctrl}{enter}');
      expect(screen.getByText('Note is bad')).toBeInTheDocument();
    });

    it('has a disabled submit button when no text is entered', function () {
      render(<NoteInput {...props} />);

      expect(screen.getByRole('button', {name: 'Post Comment'})).toBeDisabled();
    });

    it('enables the submit button when text is entered', function () {
      render(<NoteInput {...props} />);
      userEvent.type(screen.getByRole('textbox'), 'something');

      expect(screen.getByRole('button', {name: 'Post Comment'})).toBeEnabled();
    });
  });

  describe('Existing Item', function () {
    const props = {
      group: {project: {}, id: 'groupId'},
      noteId: 'item-id',
      text: 'an existing item',
    };

    it('edits existing message', function () {
      const onUpdate = jest.fn();
      render(<NoteInput {...props} onUpdate={onUpdate} />);

      // Switch to preview
      userEvent.click(screen.getByRole('tab', {name: 'Preview'}));

      expect(screen.getByText('an existing item')).toBeInTheDocument();

      // Switch to edit
      userEvent.click(screen.getByRole('tab', {name: 'Edit'}));

      expect(screen.getByRole('textbox')).toHaveTextContent('an existing item');

      // Can edit text
      userEvent.type(screen.getByRole('textbox'), ' new content{ctrl}{enter}');

      expect(onUpdate).toHaveBeenCalledWith({
        text: 'an existing item new content',
        mentions: [],
      });
    });

    it('canels editing and moves to preview mode', function () {
      const onEditFinish = jest.fn();
      render(<NoteInput {...props} onEditFinish={onEditFinish} />);

      userEvent.type(screen.getByRole('textbox'), ' new content');

      userEvent.click(screen.getByRole('button', {name: 'Cancel'}));
      expect(onEditFinish).toHaveBeenCalled();
    });
  });
});
