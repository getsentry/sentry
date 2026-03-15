import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {EditableIssueViewHeader} from 'sentry/views/issueList/editableIssueViewHeader';
import {GroupSearchViewVisibility} from 'sentry/views/issueList/types';
import type {GroupSearchView} from 'sentry/views/issueList/types';
import {IssueSortOptions} from 'sentry/views/issueList/utils';

describe('EditableIssueViewHeader', () => {
  const mockView: GroupSearchView = {
    id: '1',
    name: 'My Custom View',
    query: 'is:unresolved',
    querySort: IssueSortOptions.DATE,
    projects: [],
    environments: [],
    timeFilters: {
      end: null,
      period: '14d',
      start: null,
      utc: null,
    },
    createdBy: {
      id: '1',
      name: 'Test User',
      email: 'test@example.com',
      ip_address: '',
      username: 'testuser',
    },
    dateCreated: '2024-01-01T00:00:00Z',
    dateUpdated: '2024-01-01T00:00:00Z',
    lastVisited: null,
    stars: 0,
    starred: false,
    visibility: GroupSearchViewVisibility.OWNER,
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('displays view name in default mode', () => {
    render(<EditableIssueViewHeader view={mockView} />);

    expect(screen.getByText('My Custom View')).toBeInTheDocument();
  });

  it('enters edit mode when edit button is clicked', async () => {
    render(<EditableIssueViewHeader view={mockView} />);

    const editButton = screen.getByRole('button', {name: 'Edit view name'});
    await userEvent.click(editButton);

    // Should show input field with current name
    const input = screen.getByDisplayValue('My Custom View');
    expect(input).toBeInTheDocument();

    // Should show Save and Cancel buttons
    expect(screen.getByRole('button', {name: 'Save'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Cancel'})).toBeInTheDocument();
  });

  it('exits edit mode when Cancel button is clicked', async () => {
    render(<EditableIssueViewHeader view={mockView} />);

    // Enter edit mode
    const editButton = screen.getByRole('button', {name: 'Edit view name'});
    await userEvent.click(editButton);

    // Click Cancel button
    const cancelButton = screen.getByRole('button', {name: 'Cancel'});
    await userEvent.click(cancelButton);

    // Should return to default view
    expect(screen.getByText('My Custom View')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('My Custom View')).not.toBeInTheDocument();
  });

  it('exits edit mode when Escape key is pressed', async () => {
    render(<EditableIssueViewHeader view={mockView} />);

    // Enter edit mode
    const editButton = screen.getByRole('button', {name: 'Edit view name'});
    await userEvent.click(editButton);

    // Press Escape
    await userEvent.keyboard('{Escape}');

    // Should return to default view
    expect(screen.getByText('My Custom View')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('My Custom View')).not.toBeInTheDocument();
  });

  it('disables Save button when input is empty', async () => {
    render(<EditableIssueViewHeader view={mockView} />);

    // Enter edit mode
    const editButton = screen.getByRole('button', {name: 'Edit view name'});
    await userEvent.click(editButton);

    // Clear the input
    const input = screen.getByDisplayValue('My Custom View');
    await userEvent.clear(input);

    // Save button should be disabled
    const saveButton = screen.getByRole('button', {name: 'Save'});
    expect(saveButton).toBeDisabled();
  });

  it('enters edit mode when title is double-clicked', async () => {
    render(<EditableIssueViewHeader view={mockView} />);

    const title = screen.getByText('My Custom View');
    await userEvent.dblClick(title);

    // Should show input field with current name
    const input = screen.getByDisplayValue('My Custom View');
    expect(input).toBeInTheDocument();

    // Should show Save and Cancel buttons
    expect(screen.getByRole('button', {name: 'Save'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Cancel'})).toBeInTheDocument();
  });
});
