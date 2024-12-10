import {GroupFixture} from 'sentry-fixture/group';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ReleaseFixture} from 'sentry-fixture/release';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import ReleaseIssues from 'sentry/views/releases/detail/overview/releaseIssues';
import {getReleaseBounds} from 'sentry/views/releases/utils';

describe('ReleaseIssues', function () {
  let newIssuesEndpoint: jest.Mock;
  let resolvedIssuesEndpoint: jest.Mock;
  let unhandledIssuesEndpoint: jest.Mock;
  let allIssuesEndpoint: jest.Mock;

  const props = {
    orgId: 'org',
    organization: OrganizationFixture(),
    version: '1.0.0',
    location: LocationFixture({query: {}}),
    releaseBounds: getReleaseBounds(ReleaseFixture({version: '1.0.0'})),
  };

  beforeEach(function () {
    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: `/organizations/${props.organization.slug}/users/`,
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${props.organization.slug}/issues-count/?end=2020-03-24T02%3A04%3A59Z&query=first-release%3A%221.0.0%22%20is%3Aunresolved&query=release%3A%221.0.0%22%20is%3Aunresolved&query=error.handled%3A0%20release%3A%221.0.0%22%20is%3Aunresolved&query=regressed_in_release%3A%221.0.0%22&start=2020-03-23T01%3A02%3A00Z`,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${props.organization.slug}/issues-count/?query=first-release%3A%221.0.0%22%20is%3Aunresolved&query=release%3A%221.0.0%22%20is%3Aunresolved&query=error.handled%3A0%20release%3A%221.0.0%22%20is%3Aunresolved&query=regressed_in_release%3A%221.0.0%22&statsPeriod=24h`,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${props.organization.slug}/releases/1.0.0/resolved/`,
    });

    newIssuesEndpoint = MockApiClient.addMockResponse({
      url: `/organizations/${props.organization.slug}/issues/?end=2020-03-24T02%3A04%3A59Z&groupStatsPeriod=auto&limit=10&query=first-release%3A1.0.0%20is%3Aunresolved&sort=freq&start=2020-03-23T01%3A02%3A00Z`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${props.organization.slug}/issues/?groupStatsPeriod=auto&limit=10&query=first-release%3A1.0.0%20is%3Aunresolved&sort=freq&statsPeriod=24h`,
      body: [],
    });
    resolvedIssuesEndpoint = MockApiClient.addMockResponse({
      url: `/organizations/${props.organization.slug}/releases/1.0.0/resolved/?end=2020-03-24T02%3A04%3A59Z&groupStatsPeriod=auto&limit=10&query=&sort=freq&start=2020-03-23T01%3A02%3A00Z`,
      body: [],
    });
    unhandledIssuesEndpoint = MockApiClient.addMockResponse({
      url: `/organizations/${props.organization.slug}/issues/?end=2020-03-24T02%3A04%3A59Z&groupStatsPeriod=auto&limit=10&query=release%3A1.0.0%20error.handled%3A0%20is%3Aunresolved&sort=freq&start=2020-03-23T01%3A02%3A00Z`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${props.organization.slug}/issues/?groupStatsPeriod=auto&limit=10&query=release%3A1.0.0%20error.handled%3A0%20is%3Aunresolved&sort=freq&statsPeriod=24h`,
      body: [],
    });
    allIssuesEndpoint = MockApiClient.addMockResponse({
      url: `/organizations/${props.organization.slug}/issues/?end=2020-03-24T02%3A04%3A59Z&groupStatsPeriod=auto&limit=10&query=release%3A1.0.0%20is%3Aunresolved&sort=freq&start=2020-03-23T01%3A02%3A00Z`,
      body: [],
    });
  });

  it('shows an empty state', async function () {
    const {rerender} = render(<ReleaseIssues {...props} />);

    expect(await screen.findByText('No new issues in this release.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', {name: 'Resolved 0'}));
    // Simulate query change
    rerender(
      <ReleaseIssues
        {...props}
        location={LocationFixture({query: {issuesType: 'resolved'}})}
      />
    );
    expect(
      await screen.findByText('No resolved issues in this release.')
    ).toBeInTheDocument();
  });

  it('shows an empty sttate with stats period', async function () {
    const query = {pageStatsPeriod: '24h'};
    const {rerender} = render(
      <ReleaseIssues {...props} location={LocationFixture({query})} />
    );

    expect(
      await screen.findByText(
        textWithMarkupMatcher('No new issues for the last 24 hours.')
      )
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', {name: 'Unhandled 0'}));
    // Simulate query change
    rerender(
      <ReleaseIssues
        {...props}
        location={LocationFixture({query: {...query, issuesType: 'unhandled'}})}
      />
    );
    expect(
      await screen.findByText(
        textWithMarkupMatcher('No unhandled issues for the last 24 hours.')
      )
    ).toBeInTheDocument();
  });

  it('can switch issue filters', async function () {
    const {router} = initializeOrg();

    const {rerender} = render(<ReleaseIssues {...props} />, {router});

    // New
    expect(await screen.findByRole('radio', {name: 'New Issues 0'})).toBeChecked();
    expect(screen.getByRole('button', {name: 'Open in Issues'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/issues/?end=2020-03-24T02%3A04%3A59Z&groupStatsPeriod=auto&query=firstRelease%3A1.0.0&sort=freq&start=2020-03-23T01%3A02%3A00Z'
    );
    expect(newIssuesEndpoint).toHaveBeenCalledTimes(1);

    // Resolved
    await userEvent.click(screen.getByRole('radio', {name: 'Resolved 0'}));
    // Simulate query change
    rerender(
      <ReleaseIssues
        {...props}
        location={LocationFixture({query: {issuesType: 'resolved'}})}
      />
    );
    expect(screen.getByRole('button', {name: 'Open in Issues'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/issues/?end=2020-03-24T02%3A04%3A59Z&groupStatsPeriod=auto&query=release%3A1.0.0&sort=freq&start=2020-03-23T01%3A02%3A00Z'
    );
    expect(resolvedIssuesEndpoint).toHaveBeenCalledTimes(1);

    // Unhandled
    await userEvent.click(screen.getByRole('radio', {name: 'Unhandled 0'}));
    rerender(
      <ReleaseIssues
        {...props}
        location={LocationFixture({query: {issuesType: 'unhandled'}})}
      />
    );
    expect(screen.getByRole('button', {name: 'Open in Issues'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/issues/?end=2020-03-24T02%3A04%3A59Z&groupStatsPeriod=auto&query=release%3A1.0.0%20error.handled%3A0&sort=freq&start=2020-03-23T01%3A02%3A00Z'
    );
    expect(unhandledIssuesEndpoint).toHaveBeenCalledTimes(1);

    // All
    await userEvent.click(screen.getByRole('radio', {name: 'All Issues 0'}));
    rerender(
      <ReleaseIssues
        {...props}
        location={LocationFixture({query: {issuesType: 'all'}})}
      />
    );
    expect(await screen.findByRole('button', {name: 'Open in Issues'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/issues/?end=2020-03-24T02%3A04%3A59Z&groupStatsPeriod=auto&query=release%3A1.0.0&sort=freq&start=2020-03-23T01%3A02%3A00Z'
    );
    expect(allIssuesEndpoint).toHaveBeenCalledTimes(1);
  });

  it('includes release context when linking to issue', async function () {
    newIssuesEndpoint = MockApiClient.addMockResponse({
      url: `/organizations/${props.organization.slug}/issues/?end=2020-03-24T02%3A04%3A59Z&groupStatsPeriod=auto&limit=10&query=first-release%3A1.0.0%20is%3Aunresolved&sort=freq&start=2020-03-23T01%3A02%3A00Z`,
      body: [GroupFixture({id: '123'})],
    });

    const {router} = initializeOrg();

    render(<ReleaseIssues {...props} />, {router});

    await userEvent.click(screen.getByRole('radio', {name: /New Issues/}));

    const link = await screen.findByRole('link', {name: /RequestError/});

    // Should pass the query param `query` with value `release:1.0.0`
    expect(link).toHaveAttribute(
      'href',
      '/organizations/org-slug/issues/123/?_allp=1&query=release%3A1.0.0&referrer=release-issue-stream'
    );
  });
});
