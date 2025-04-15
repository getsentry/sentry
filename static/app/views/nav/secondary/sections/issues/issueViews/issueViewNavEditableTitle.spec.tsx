import {GroupSearchViewFixture} from 'sentry-fixture/groupSearchView';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {convertGSVtoIssueView} from 'sentry/views/nav/secondary/sections/issues/issueViews/useStarredIssueViews';

import IssueViewNavEditableTitle from './issueViewNavEditableTitle';

describe('IssueViewNavEditableTitle', () => {
  const mockSetIsEditing = jest.fn();
  const mockGroupSearchView = GroupSearchViewFixture();
  const defaultProps = {
    isEditing: false,
    setIsEditing: mockSetIsEditing,
    isDragging: false,
    isActive: false,
    view: convertGSVtoIssueView(mockGroupSearchView),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/group-search-views/${mockGroupSearchView.id}/`,
      method: 'PUT',
      body: mockGroupSearchView,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/group-search-views/starred/`,
      method: 'GET',
      body: {
        views: [convertGSVtoIssueView(mockGroupSearchView)],
      },
    });
  });

  it('renders the label correctly', () => {
    render(<IssueViewNavEditableTitle {...defaultProps} />);
    expect(screen.getByText('Test View')).toBeInTheDocument();
  });

  it('enters edit mode on double click', async () => {
    render(<IssueViewNavEditableTitle {...defaultProps} />);
    const element = screen.getByText('Test View');
    await userEvent.dblClick(element);
    expect(mockSetIsEditing).toHaveBeenCalledWith(true);
  });

  it('renders input in edit mode', () => {
    render(<IssueViewNavEditableTitle {...defaultProps} isEditing />);
    const input = screen.getByRole('textbox');
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('Test View');
  });

  describe('keyboard interactions', () => {
    it('saves changes on Enter key', async () => {
      render(<IssueViewNavEditableTitle {...defaultProps} isEditing />);
      const input = screen.getByRole('textbox');
      await userEvent.clear(input);
      await userEvent.type(input, 'New Label{enter}');

      expect(mockSetIsEditing).toHaveBeenCalledWith(false);
    });

    it('cancels editing on Escape key', async () => {
      render(<IssueViewNavEditableTitle {...defaultProps} isEditing />);
      const input = screen.getByRole('textbox');
      await userEvent.clear(input);
      await userEvent.type(input, 'New Label{escape}');

      expect(mockSetIsEditing).toHaveBeenCalledWith(false);
    });

    it('prevents empty values on blur', async () => {
      render(<IssueViewNavEditableTitle {...defaultProps} isEditing />);
      const input = screen.getByRole('textbox');
      await userEvent.clear(input);
      await userEvent.tab();

      expect(mockSetIsEditing).toHaveBeenCalledWith(false);
    });

    it('trims whitespace on save', async () => {
      render(<IssueViewNavEditableTitle {...defaultProps} isEditing />);
      const input = screen.getByRole('textbox');
      await userEvent.clear(input);
      await userEvent.type(input, '  New Label  {enter}');
    });
  });
});
