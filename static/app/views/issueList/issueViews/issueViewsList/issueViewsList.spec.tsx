import {GroupSearchViewFixture} from 'sentry-fixture/groupSearchView';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import IssueViewsList from 'sentry/views/issueList/issueViews/issueViewsList/issueViewsList';

const organization = OrganizationFixture({
  features: ['issue-view-sharing'],
});

describe('IssueViewsList', function () {
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
        }),
      ],
    });
  });

  it('displays views from myself and others', async function () {
    render(<IssueViewsList />, {organization});

    expect(await screen.findByText('Foo')).toBeInTheDocument();
    expect(screen.getByText('Foo')).toHaveAttribute(
      'href',
      `/organizations/org-slug/issues/views/1/`
    );
    expect(screen.getByText(textWithMarkupMatcher('foo is bar'))).toBeInTheDocument();
    expect(screen.getByText('env1')).toBeInTheDocument();

    expect(await screen.findByText('Bar')).toBeInTheDocument();
    expect(screen.getByText('Bar')).toHaveAttribute(
      'href',
      `/organizations/org-slug/issues/views/2/`
    );
    expect(screen.getByText(textWithMarkupMatcher('bar is baz'))).toBeInTheDocument();
    expect(screen.getByText('My Projects')).toBeInTheDocument();
    expect(screen.getByText('All')).toBeInTheDocument();
  });

  it('can unstar views', async function () {
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

  it('can star views', async function () {
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

  it('handles errors when starring views', async function () {
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
});
