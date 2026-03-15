import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

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

  it('saves updated name when Save button is clicked', async () => {
    const updateMock = MockApiClient.addMockResponse({
      url: `/api/0/organizations/org-slug/group-search-views/${mockView.id}/`,
      method: 'PUT',
      body: {
        ...mockView,
        name: 'Updated View Name',
      },
    });

    render(<EditableIssueViewHeader view={mockView} />, {
      organization: OrganizationFixture({slug: 'org-slug'}),
    });

    // Enter edit mode
    const editButton = screen.getByRole('button', {name: 'Edit view name'});
    await userEvent.click(editButton);

    // Change the name
    const input = screen.getByDisplayValue('My Custom View');
    await userEvent.clear(input);
    await userEvent.type(input, 'Updated View Name');

    // Click Save button
    const saveButton = screen.getByRole('button', {name: 'Save'});
    await userEvent.click(saveButton);

    // Should call the API
    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Updated View Name',
          }),
        })
      );
    });

    // Should show success toast
    await waitFor(() => {
      expect(screen.getByText(/Renamed view from/)).toBeInTheDocument();
    });
  });

  it('shows loading state on Save button during API request', async () => {
    MockApiClient.addMockResponse({
      url: `/api/0/organizations/org-slug/group-search-views/${mockView.id}/`,
      method: 'PUT',
      body: {
        ...mockView,
        name: 'Updated View Name',
      },
      // Delay response to observe loading state
      asyncDelay: 100,
    });

    render(<EditableIssueViewHeader view={mockView} />, {
      organization: OrganizationFixture({slug: 'org-slug'}),
    });

    // Enter edit mode
    const editButton = screen.getByRole('button', {name: 'Edit view name'});
    await userEvent.click(editButton);

    // Change the name
    const input = screen.getByDisplayValue('My Custom View');
    await userEvent.clear(input);
    await userEvent.type(input, 'Updated View Name');

    // Click Save button
    const saveButton = screen.getByRole('button', {name: 'Save'});
    await userEvent.click(saveButton);

    // Save button should be disabled during the request
    expect(saveButton).toBeDisabled();
    // Input should also be disabled
    expect(input).toBeDisabled();

    // Wait for the request to complete
    await waitFor(() => {
      expect(screen.getByText(/Renamed view from/)).toBeInTheDocument();
    });
  });

  it('saves updated name when Enter key is pressed', async () => {
    const updateMock = MockApiClient.addMockResponse({
      url: `/api/0/organizations/org-slug/group-search-views/${mockView.id}/`,
      method: 'PUT',
      body: {
        ...mockView,
        name: 'Updated View Name',
      },
    });

    render(<EditableIssueViewHeader view={mockView} />, {
      organization: OrganizationFixture({slug: 'org-slug'}),
    });

    // Enter edit mode
    const editButton = screen.getByRole('button', {name: 'Edit view name'});
    await userEvent.click(editButton);

    // Change the name
    const input = screen.getByDisplayValue('My Custom View');
    await userEvent.clear(input);
    await userEvent.type(input, 'Updated View Name');

    // Press Enter
    await userEvent.keyboard('{Enter}');

    // Should call the API
    await waitFor(() => {
      expect(updateMock).toHaveBeenCalled();
    });

    // Should show success toast
    await waitFor(() => {
      expect(screen.getByText(/Renamed view from/)).toBeInTheDocument();
    });
  });

  it('does not save if name is unchanged', async () => {
    const updateMock = MockApiClient.addMockResponse({
      url: `/api/0/organizations/org-slug/group-search-views/${mockView.id}/`,
      method: 'PUT',
      body: mockView,
    });

    render(<EditableIssueViewHeader view={mockView} />, {
      organization: OrganizationFixture({slug: 'org-slug'}),
    });

    // Enter edit mode
    const editButton = screen.getByRole('button', {name: 'Edit view name'});
    await userEvent.click(editButton);

    // Click Save without changing the name
    const saveButton = screen.getByRole('button', {name: 'Save'});
    await userEvent.click(saveButton);

    // Should not call the API
    expect(updateMock).not.toHaveBeenCalled();

    // Should exit edit mode
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

  it('trims whitespace from the input before saving', async () => {
    const updateMock = MockApiClient.addMockResponse({
      url: `/api/0/organizations/org-slug/group-search-views/${mockView.id}/`,
      method: 'PUT',
      body: {
        ...mockView,
        name: 'Updated View Name',
      },
    });

    render(<EditableIssueViewHeader view={mockView} />, {
      organization: OrganizationFixture({slug: 'org-slug'}),
    });

    // Enter edit mode
    const editButton = screen.getByRole('button', {name: 'Edit view name'});
    await userEvent.click(editButton);

    // Change the name with leading/trailing whitespace
    const input = screen.getByDisplayValue('My Custom View');
    await userEvent.clear(input);
    await userEvent.type(input, '  Updated View Name  ');

    // Click Save button
    const saveButton = screen.getByRole('button', {name: 'Save'});
    await userEvent.click(saveButton);

    // Should call the API with trimmed name
    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Updated View Name',
          }),
        })
      );
    });
  });
});
