import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {IssueSortOptions} from 'sentry/views/issueList/utils';

import {
  IssueViewNavEllipsisMenu,
  type IssueViewNavEllipsisMenuProps,
} from './issueViewNavEllipsisMenu';

describe('IssueViewNavEllipsisMenu', () => {
  const mockView = {
    id: '123',
    name: 'Test View',
    query: 'is:unresolved',
    querySort: IssueSortOptions.DATE,
    projects: [1],
    environments: ['prod'],
    timeFilters: {
      start: '7d',
      end: null,
      period: '7d',
      utc: null,
    },
    isCommitted: true,
    key: 'test-view',
    label: 'Test View',
  };

  const defaultProps: IssueViewNavEllipsisMenuProps = {
    baseUrl: '/organizations/sentry/issues',
    onDeleteView: jest.fn(),
    onDuplicateView: jest.fn(),
    onUpdateView: jest.fn(),
    setIsEditing: jest.fn(),
    view: mockView,
    isLastView: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders ellipsis menu trigger', () => {
    render(<IssueViewNavEllipsisMenu {...defaultProps} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('shows menu items when clicked', async () => {
    const user = userEvent.setup();
    render(<IssueViewNavEllipsisMenu {...defaultProps} />);

    await user.click(screen.getByRole('button'));

    expect(screen.getByText('Rename')).toBeInTheDocument();
    expect(screen.getByText('Duplicate')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('handles rename action', async () => {
    const user = userEvent.setup();
    const setIsEditing = jest.fn();
    render(<IssueViewNavEllipsisMenu {...defaultProps} setIsEditing={setIsEditing} />);

    await user.click(screen.getByRole('button'));
    await user.click(screen.getByText('Rename'));

    expect(setIsEditing).toHaveBeenCalledWith(true);
  });

  it('shows save and discard options when there are unsaved changes', async () => {
    const user = userEvent.setup();
    const viewWithChanges = {
      ...mockView,
      unsavedChanges: {
        query: 'is:resolved',
      },
    };

    render(<IssueViewNavEllipsisMenu {...defaultProps} view={viewWithChanges} />);

    await user.click(screen.getByRole('button'));

    expect(screen.getByText('Save Changes')).toBeInTheDocument();
    expect(screen.getByText('Discard Changes')).toBeInTheDocument();
  });

  it('handles keyboard interactions correctly', async () => {
    const user = userEvent.setup();
    render(<IssueViewNavEllipsisMenu {...defaultProps} />);

    const trigger = screen.getByRole('button');

    await user.tab();
    expect(trigger).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(screen.getByText('Rename')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByText('Rename')).not.toBeInTheDocument();
    });
  });

  it('disables delete button when isLastView is true', () => {
    render(<IssueViewNavEllipsisMenu {...defaultProps} isLastView />);

    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  });
});
