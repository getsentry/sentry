import {GroupSearchViewFixture} from 'sentry-fixture/groupSearchView';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import IssueViewsList from 'sentry/views/issueList/issueViews/issueViewsList/issueViewsList';

const organization = OrganizationFixture({
  features: ['issue-views'],
});

describe('IssueViewsList', () => {
  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/group-search-views/',
      match: [MockApiClient.matchQuery({createdBy: 'me'})],
      body: [
        GroupSearchViewFixture({
          id: '1',
          name: 'Foo',
          projects: [1],
          environments: ['env1'],
          query: 'foo:bar',
          timeFilters: {
            period: '7d',
            start: null,
            end: null,
            utc: null,
          },
          starred: true,
        }),
      ],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/group-search-views/',
      match: [MockApiClient.matchQuery({createdBy: 'others'})],
      body: [
        GroupSearchViewFixture({
          id: '2',
          name: 'Bar',
          projects: [],
          environments: [],
          query: 'bar:baz',
          timeFilters: {
            period: '1d',
            start: null,
            end: null,
            utc: null,
          },
          starred: false,
          stars: 7,
        }),
      ],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/prompts-activity/',
    });
  });

  it('displays views from myself and others', async () => {
    render(<IssueViewsList />, {organization});

    expect(await screen.findByText('Foo')).toBeInTheDocument();
    expect(screen.getByText('Foo')).toHaveAttribute(
      'href',
      `/organizations/org-slug/issues/views/1/`
    );
    expect(screen.getByText(textWithMarkupMatcher('foo is bar'))).toBeInTheDocument();
    expect(screen.getByText('env1')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();

    expect(await screen.findByText('Bar')).toBeInTheDocument();
    expect(screen.getByText('Bar')).toHaveAttribute(
      'href',
      `/organizations/org-slug/issues/views/2/`
    );
    expect(screen.getByText(textWithMarkupMatcher('bar is baz'))).toBeInTheDocument();
    expect(screen.getByText('My Projects')).toBeInTheDocument();
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('can sort views', async () => {
    const mockViewsEndpoint = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/group-search-views/',
      match: [MockApiClient.matchQuery({createdBy: 'me'})],
      body: [
        GroupSearchViewFixture({
          id: '1',
          name: 'Foo',
          projects: [1],
          environments: ['env1'],
          query: 'foo:bar',
          timeFilters: {
            period: '7d',
            start: null,
            end: null,
            utc: null,
          },
          starred: true,
        }),
      ],
    });

    render(<IssueViewsList />, {organization});

    // By default, sorts by popularity (desc) then visited (desc) then created (desc)
    await waitFor(() => {
      expect(mockViewsEndpoint).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({sort: ['-popularity', '-visited', '-created']}),
        })
      );
    });

    // Can sort by last visited
    await userEvent.click(screen.getByRole('button', {name: 'Most Starred'}));
    await userEvent.click(screen.getByRole('option', {name: 'Recently Viewed'}));

    await waitFor(() => {
      expect(mockViewsEndpoint).toHaveBeenCalledTimes(2);
    });

    expect(mockViewsEndpoint).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({sort: ['-visited', '-popularity', '-created']}),
      })
    );
  });

  it('can unstar views', async () => {
    const mockStarredEndpoint = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/group-search-views/1/starred/',
      method: 'POST',
    });

    render(<IssueViewsList />, {organization});

    expect(await screen.findByText('Foo')).toBeInTheDocument();

    const tableMe = screen.getByTestId('table-me');

    // First view should be starred
    const myView = within(tableMe).getByTestId('table-me-row-0');
    const myViewStarButton = within(myView).getByRole('button', {name: 'Unstar'});

    // Can unstar the view
    await userEvent.click(myViewStarButton);
    await within(myView).findByRole('button', {name: 'Star'});

    await waitFor(() => {
      expect(mockStarredEndpoint).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {starred: false},
        })
      );
    });
  });

  it('can star views', async () => {
    const mockStarredEndpoint = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/group-search-views/2/starred/',
      method: 'POST',
    });

    render(<IssueViewsList />, {organization});

    expect(await screen.findByText('Foo')).toBeInTheDocument();

    const tableOthers = screen.getByTestId('table-others');

    // First 'others' view should be unstarred
    const othersView = within(tableOthers).getByTestId('table-others-row-0');
    const othersViewStarButton = within(othersView).getByRole('button', {name: 'Star'});

    // Can star the view
    await userEvent.click(othersViewStarButton);
    await within(othersView).findByRole('button', {name: 'Unstar'});

    await waitFor(() => {
      expect(mockStarredEndpoint).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {starred: true},
        })
      );
    });
  });

  it('handles errors when starring views', async () => {
    const mockStarredEndpoint = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/group-search-views/2/starred/',
      method: 'POST',
      statusCode: 500,
    });

    render(<IssueViewsList />, {organization});

    expect(await screen.findByText('Foo')).toBeInTheDocument();

    const tableOthers = screen.getByTestId('table-others');

    // First 'others' view should be unstarred
    const othersView = within(tableOthers).getByTestId('table-others-row-0');
    const othersViewStarButton = within(othersView).getByRole('button', {name: 'Star'});

    // Starring should result in a button that is not starred
    await userEvent.click(othersViewStarButton);
    await waitFor(() => {
      expect(mockStarredEndpoint).toHaveBeenCalled();
    });
    expect(
      await within(othersView).findByRole('button', {name: 'Star'})
    ).toBeInTheDocument();
  });

  it('can delete views', async () => {
    const mockDeleteEndpoint = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/group-search-views/1/',
      method: 'DELETE',
    });

    render(<IssueViewsList />, {organization});
    renderGlobalModal();

    expect(await screen.findByText('Foo')).toBeInTheDocument();

    const tableMe = screen.getByTestId('table-me');
    const myView = within(tableMe).getByTestId('table-me-row-0');
    await userEvent.click(within(myView).getByRole('button', {name: 'More options'}));
    await userEvent.click(
      within(myView).getByRole('menuitemradio', {
        name: 'Delete',
      })
    );

    // Query will be invalidated, need to mock the response on refetch
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/group-search-views/',
      match: [MockApiClient.matchQuery({createdBy: 'me'})],
      body: [],
    });

    // Confirm the deletion
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Delete View',
      })
    );

    await waitFor(() => {
      expect(screen.queryByText('Foo')).not.toBeInTheDocument();
    });
    expect(mockDeleteEndpoint).toHaveBeenCalled();
  });

  it('can rename views', async () => {
    const mockRenameEndpoint = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/group-search-views/1/',
      method: 'PUT',
      body: {
        id: '1',
        name: 'New Name',
      },
    });

    render(<IssueViewsList />, {organization});
    renderGlobalModal();

    await screen.findByText('Foo');

    const tableMe = screen.getByTestId('table-me');
    const myView = within(tableMe).getByTestId('table-me-row-0');
    await userEvent.click(within(myView).getByRole('button', {name: 'More options'}));
    await userEvent.click(within(myView).getByRole('menuitemradio', {name: 'Rename'}));

    const modal = await screen.findByRole('dialog');
    expect(within(modal).getByRole('textbox', {name: 'Name'})).toHaveValue('Foo');
    await userEvent.clear(within(modal).getByRole('textbox', {name: 'Name'}));
    await userEvent.type(within(modal).getByRole('textbox', {name: 'Name'}), 'New Name');
    await userEvent.click(within(modal).getByRole('button', {name: 'Save Changes'}));

    await within(myView).findByText('New Name');

    expect(mockRenameEndpoint).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({name: 'New Name'}),
      })
    );
  });

  it('can duplicate views', async () => {
    const mockCreateEndpoint = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/group-search-views/',
      method: 'POST',
      body: GroupSearchViewFixture({
        id: '222',
        name: 'New Name',
        starred: true,
      }),
    });

    render(<IssueViewsList />, {organization});
    renderGlobalModal();
    await screen.findByText('Foo');

    const tableMe = screen.getByTestId('table-me');
    const myView = within(tableMe).getByTestId('table-me-row-0');
    await userEvent.click(within(myView).getByRole('button', {name: 'More options'}));
    await userEvent.click(within(myView).getByRole('menuitemradio', {name: 'Duplicate'}));

    const modal = await screen.findByRole('dialog');
    await userEvent.clear(within(modal).getByRole('textbox', {name: 'Name'}));
    await userEvent.type(within(modal).getByRole('textbox', {name: 'Name'}), 'New Name');
    await userEvent.click(within(modal).getByRole('button', {name: 'Create View'}));

    await waitFor(() => {
      expect(mockCreateEndpoint).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({name: 'New Name', starred: true}),
        })
      );
    });
  });
});
