import * as qs from 'query-string';
import {GroupFixture} from 'sentry-fixture/group';
import {MemberFixture} from 'sentry-fixture/member';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import GroupStore from 'sentry/stores/groupStore';
import {RELATED_ISSUES_BOOLEAN_QUERY_ERROR} from 'sentry/views/alerts/rules/metric/details/relatedIssuesNotAvailable';

import GroupList from './groupList';

describe('GroupList', () => {
  const organization = OrganizationFixture();
  const group = GroupFixture();
  const membersUrl = `/organizations/${organization.slug}/users/`;
  const issuesUrl = `/organizations/${organization.slug}/issues/`;
  const defaultQueryParams = {query: '', sort: 'new', limit: '50'};
  const issuesUrlWithDefaultQuery = `${issuesUrl}?${qs.stringify(defaultQueryParams)}`;
  const initialRouterConfig = {
    location: {
      pathname: `/organizations/${organization.slug}/issues/`,
      query: defaultQueryParams,
    },
    route: '/organizations/:orgId/issues/',
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    GroupStore.reset();

    MockApiClient.addMockResponse({url: membersUrl, body: [MemberFixture()]});
    MockApiClient.addMockResponse({
      url: issuesUrlWithDefaultQuery,
      method: 'GET',
      body: [group],
    });
  });

  afterEach(() => {
    GroupStore.reset();
  });

  it('renders the group list', async () => {
    render(<GroupList numPlaceholderRows={1} queryParams={defaultQueryParams} />, {
      organization,
      initialRouterConfig,
    });

    expect(await screen.findByText('RequestError')).toBeInTheDocument();
    expect(screen.getByText(group.shortId)).toBeInTheDocument();
    expect(screen.getByText(group.culprit)).toBeInTheDocument();
    // Event count
    expect(screen.getByText('327k')).toBeInTheDocument();
    // Users
    expect(screen.getByText('35k')).toBeInTheDocument();
  });

  it('renders empty state when no groups are returned', async () => {
    MockApiClient.addMockResponse({url: membersUrl, body: []});
    MockApiClient.addMockResponse({
      url: issuesUrlWithDefaultQuery,
      method: 'GET',
      body: [],
    });

    render(<GroupList numPlaceholderRows={1} queryParams={defaultQueryParams} />, {
      organization,
      initialRouterConfig,
    });

    expect(
      await screen.findByText("There don't seem to be any events fitting the query.")
    ).toBeInTheDocument();
  });

  it('renders custom error when query has boolean logic', async () => {
    const renderErrorMessage = jest.fn(() => <div>custom error</div>);
    const issuesRequest = MockApiClient.addMockResponse({
      url: `${issuesUrl}?${qs.stringify({...defaultQueryParams, query: 'issue.id:1'})}`,
      method: 'GET',
      body: [],
    });

    render(
      <GroupList
        numPlaceholderRows={1}
        queryParams={{...defaultQueryParams, query: 'foo OR bar'}}
        renderErrorMessage={renderErrorMessage}
      />,
      {
        organization,
        initialRouterConfig: {
          ...initialRouterConfig,
          location: {
            ...initialRouterConfig.location,
            query: {...defaultQueryParams, query: 'foo OR bar'},
          },
        },
      }
    );

    expect(await screen.findByText('custom error')).toBeInTheDocument();
    expect(renderErrorMessage).toHaveBeenCalledWith(
      {detail: RELATED_ISSUES_BOOLEAN_QUERY_ERROR},
      expect.any(Function)
    );
    expect(issuesRequest).not.toHaveBeenCalled();
  });

  it('invokes onFetchSuccess with correct arguments', async () => {
    const onFetchSuccess = jest.fn();
    MockApiClient.addMockResponse({url: membersUrl, body: []});
    const linkHeader = '<https://sentry.io/?cursor=next>; rel="next"';
    MockApiClient.addMockResponse({
      url: issuesUrlWithDefaultQuery,
      method: 'GET',
      body: [group],
      headers: {Link: linkHeader},
    });

    render(
      <GroupList
        numPlaceholderRows={1}
        queryParams={defaultQueryParams}
        onFetchSuccess={onFetchSuccess}
      />,
      {
        organization,
        initialRouterConfig,
      }
    );

    expect(await screen.findByText('RequestError')).toBeInTheDocument();
    await waitFor(() =>
      expect(onFetchSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          error: false,
          errorData: null,
          groups: [group],
          loading: false,
          pageLinks: linkHeader,
          memberList: undefined,
        }),
        expect.any(Function)
      )
    );
  });

  it('renders pagination and navigates on next click', async () => {
    const pageLinks =
      '<https://sentry.io/?cursor=prev:0:0>; rel="previous"; results="false"; cursor="prev:0:0", ' +
      '<https://sentry.io/?cursor=next:0:0>; rel="next"; results="true"; cursor="next:0:0"';

    MockApiClient.addMockResponse({url: membersUrl, body: []});
    MockApiClient.addMockResponse({
      url: issuesUrlWithDefaultQuery,
      method: 'GET',
      body: [GroupFixture()],
      headers: {Link: pageLinks},
    });

    const {router} = render(
      <GroupList numPlaceholderRows={1} queryParams={defaultQueryParams} />,
      {
        organization,
        initialRouterConfig,
      }
    );

    expect(await screen.findByTestId('pagination')).toBeInTheDocument();
    const prev = screen.getByRole('button', {name: 'Previous'});
    const next = screen.getByRole('button', {name: 'Next'});
    expect(prev).toBeDisabled();
    expect(next).toBeEnabled();

    await userEvent.click(next);

    await waitFor(() => {
      expect(router.location.query.cursor).toBe('next:0:0');
    });

    expect(router.location.query.page).toBe('1');
  });
});
