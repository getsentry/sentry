import {GroupsFixture} from 'sentry-fixture/groups';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

import RelatedIssues from 'sentry/views/performance/transactionSummary/transactionOverview/relatedIssues';

describe('RelatedIssues', function () {
  let issuesRequestMock: jest.Mock;

  const organization = OrganizationFixture();
  const issues = GroupsFixture();
  const transaction = 'test-transaction';

  const initialData = initializeOrg({
    organization,
    router: {
      location: {
        query: {
          transaction: 'test-transaction',
          project: '1',
          statsPeriod: '14d',
        },
      },
    },
  });

  beforeEach(() => {
    issuesRequestMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/',
      method: 'GET',
      body: issues,
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/',
      body: [],
    });
  });

  afterAll(function () {
    jest.resetAllMocks();
  });

  it('renders the issues list and "Open in Issues" link', async function () {
    render(
      <RelatedIssues
        organization={organization}
        location={initialData.router.location}
        transaction={transaction}
        statsPeriod="14d"
      />
    );

    // NOTE: Saving the placeholder elements first avoid a `waitForElementToBeRemoved` timeout
    const placeholders = screen.queryAllByTestId('loading-placeholder');
    await waitForElementToBeRemoved(placeholders);

    expect(issuesRequestMock).toHaveBeenCalledTimes(1);
    expect(issuesRequestMock).toHaveBeenLastCalledWith(
      `/organizations/org-slug/issues/`,
      expect.objectContaining({
        query: {
          project: '1',
          limit: 5,
          sort: 'trends',
          query: 'is:unresolved transaction:test-transaction',
          statsPeriod: '14d',
        },
      })
    );

    expect(screen.getByRole('heading', {name: 'Related Issues'})).toBeInTheDocument();

    const $openInIssuesButton = screen.getByRole('button', {name: 'Open in Issues'});
    expect($openInIssuesButton).toHaveAttribute(
      'href',
      '/organizations/org-slug/issues/?limit=5&project=1&query=is%3Aunresolved%20transaction%3Atest-transaction&referrer=performance-related-issues&sort=trends&statsPeriod=14d'
    );

    expect(screen.getByText(/ReferenceError/)).toBeInTheDocument();
  });

  it('shows empty state when no issues are found', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/',
      method: 'GET',
      body: [],
    });

    render(
      <RelatedIssues
        organization={organization}
        location={initialData.router.location}
        transaction={transaction}
        statsPeriod="14d"
      />
    );

    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-placeholder'));

    expect(screen.getByText(/No new issues/i)).toBeInTheDocument();
  });
});
