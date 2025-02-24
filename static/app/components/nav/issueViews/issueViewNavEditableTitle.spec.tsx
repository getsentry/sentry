import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import IssueViewNavEditableTitle from './issueViewNavEditableTitle';

describe('IssueViewNavEditableTitle', () => {
  const mockOnChange = jest.fn();
  const mockSetIsEditing = jest.fn();
  const defaultProps = {
    label: 'Test Label',
    onChange: mockOnChange,
    isEditing: false,
    isSelected: false,
    setIsEditing: mockSetIsEditing,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the label correctly', () => {
    render(<IssueViewNavEditableTitle {...defaultProps} />);
    expect(screen.getByText('Test Label')).toBeInTheDocument();
  });

  it('enters edit mode on double click', async () => {
    render(<IssueViewNavEditableTitle {...defaultProps} />);
    const element = screen.getByText('Test Label');
    await userEvent.dblClick(element);
    expect(mockSetIsEditing).toHaveBeenCalledWith(true);
  });

  it('renders input in edit mode', () => {
    render(<IssueViewNavEditableTitle {...defaultProps} isEditing />);
    const input = screen.getByRole('textbox');
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('Test Label');
  });

  describe('keyboard interactions', () => {
    it('saves changes on Enter key', async () => {
      render(<IssueViewNavEditableTitle {...defaultProps} isEditing />);
      const input = screen.getByRole('textbox');
      await userEvent.clear(input);
      await userEvent.type(input, 'New Label{enter}');

      expect(mockOnChange).toHaveBeenCalledWith('New Label');
      expect(mockSetIsEditing).toHaveBeenCalledWith(false);
    });

    it('cancels editing on Escape key', async () => {
      render(<IssueViewNavEditableTitle {...defaultProps} isEditing />);
      const input = screen.getByRole('textbox');
      await userEvent.clear(input);
      await userEvent.type(input, 'New Label{escape}');

      expect(mockOnChange).not.toHaveBeenCalled();
      expect(mockSetIsEditing).toHaveBeenCalledWith(false);
    });

    it('prevents empty values on blur', async () => {
      render(<IssueViewNavEditableTitle {...defaultProps} isEditing />);
      const input = screen.getByRole('textbox');
      await userEvent.clear(input);
      await userEvent.tab();

      expect(mockOnChange).not.toHaveBeenCalled();
      expect(mockSetIsEditing).toHaveBeenCalledWith(false);
    });

    it('trims whitespace on save', async () => {
      render(<IssueViewNavEditableTitle {...defaultProps} isEditing />);
      const input = screen.getByRole('textbox');
      await userEvent.clear(input);
      await userEvent.type(input, '  New Label  {enter}');

      expect(mockOnChange).toHaveBeenCalledWith('New Label');
    });
  });
});
