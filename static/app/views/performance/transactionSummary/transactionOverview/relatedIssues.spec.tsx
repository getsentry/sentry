import {GroupsFixture} from 'sentry-fixture/groups';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

import RelatedIssues from 'sentry/views/performance/transactionSummary/transactionOverview/relatedIssues';

describe('RelatedIssues', () => {
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
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/',
      method: 'GET',
      body: issues,
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/',
      body: [],
    });
  });

  afterAll(() => {
    jest.resetAllMocks();
  });

  it('renders the issues list and "Open in Issues" link', async () => {
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

    expect(screen.getByRole('heading', {name: 'Related Issues'})).toBeInTheDocument();

    const $openInIssuesButton = screen.getByRole('button', {name: 'Open in Issues'});
    expect($openInIssuesButton).toHaveAttribute(
      'href',
      '/organizations/org-slug/issues/?limit=5&project=1&query=is%3Aunresolved%20transaction%3Atest-transaction&referrer=performance-related-issues&sort=trends&statsPeriod=14d'
    );

    expect(screen.getByText(/ReferenceError/)).toBeInTheDocument();
  });

  it('shows empty state when no issues are found', async () => {
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

  it('remaps request.method to http.method when EAP is enabled', async () => {
    const eapOrganization = OrganizationFixture({
      features: ['performance-transaction-summary-eap'],
    });
    const eapData = initializeOrg({
      organization: eapOrganization,
      router: {
        location: {
          query: {
            transaction: 'test-transaction',
            project: '1',
            statsPeriod: '14d',
            query: 'request.method:GET',
          },
        },
      },
    });

    render(
      <RelatedIssues
        organization={eapOrganization}
        location={eapData.router.location}
        transaction={transaction}
        statsPeriod="14d"
      />,
      {organization: eapOrganization}
    );

    const placeholders = screen.queryAllByTestId('loading-placeholder');
    await waitForElementToBeRemoved(placeholders);

    const $openInIssuesButton = screen.getByRole('button', {name: 'Open in Issues'});
    expect($openInIssuesButton).toHaveAttribute(
      'href',
      expect.stringContaining('http.method')
    );
    expect($openInIssuesButton).not.toHaveAttribute(
      'href',
      expect.stringContaining('request.method')
    );
  });
});
