import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import ReleaseIssues from 'sentry/views/releases/detail/overview/releaseIssues';
import {getReleaseBounds} from 'sentry/views/releases/utils';

describe('ReleaseIssues', function () {
  let newIssuesEndpoint,
    resolvedIssuesEndpoint,
    unhandledIssuesEndpoint,
    allIssuesEndpoint;

  const props = {
    orgId: 'org',
    organization: TestStubs.Organization(),
    version: '1.0.0',
    selection: {projects: [], environments: [], datetime: {}},
    location: {href: '', query: {}},
    releaseBounds: getReleaseBounds(TestStubs.Release({version: '1.0.0'})),
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
    render(<ReleaseIssues {...props} />);

    expect(await screen.findByText('No new issues in this release.')).toBeInTheDocument();

    userEvent.click(screen.getByRole('button', {name: 'Resolved 0'}));
    expect(
      await screen.findByText('No resolved issues in this release.')
    ).toBeInTheDocument();
  });

  it('shows an empty sttate with stats period', async function () {
    render(<ReleaseIssues {...props} location={{query: {pageStatsPeriod: '24h'}}} />);

    expect(
      await screen.findByText(
        textWithMarkupMatcher('No new issues for the last 24 hours.')
      )
    ).toBeInTheDocument();

    userEvent.click(screen.getByRole('button', {name: 'Unhandled 0'}));
    expect(
      await screen.findByText(
        textWithMarkupMatcher('No unhandled issues for the last 24 hours.')
      )
    ).toBeInTheDocument();
  });

  it('filters the issues', function () {
    render(<ReleaseIssues {...props} />);

    expect(screen.getAllByRole('button')).toHaveLength(6);

    userEvent.click(screen.getByRole('button', {name: 'New Issues'}));
    expect(newIssuesEndpoint).toHaveBeenCalledTimes(1);

    userEvent.click(screen.getByRole('button', {name: 'Resolved'}));
    expect(resolvedIssuesEndpoint).toHaveBeenCalledTimes(1);

    userEvent.click(screen.getByRole('button', {name: 'Unhandled'}));
    expect(unhandledIssuesEndpoint).toHaveBeenCalledTimes(1);

    userEvent.click(screen.getByRole('button', {name: 'All Issues'}));
    expect(allIssuesEndpoint).toHaveBeenCalledTimes(1);
  });

  it('renders link to Issues', function () {
    const {routerContext} = initializeOrg();

    render(<ReleaseIssues {...props} />, {context: routerContext});

    expect(screen.getByRole('button', {name: 'Open in Issues'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/issues/?end=2020-03-24T02%3A04%3A59Z&groupStatsPeriod=auto&query=firstRelease%3A1.0.0&sort=freq&start=2020-03-23T01%3A02%3A00Z'
    );

    userEvent.click(screen.getByRole('button', {name: 'Resolved'}));
    expect(screen.getByRole('button', {name: 'Open in Issues'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/issues/?end=2020-03-24T02%3A04%3A59Z&groupStatsPeriod=auto&query=release%3A1.0.0&sort=freq&start=2020-03-23T01%3A02%3A00Z'
    );

    userEvent.click(screen.getByRole('button', {name: 'Unhandled'}));
    expect(screen.getByRole('button', {name: 'Open in Issues'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/issues/?end=2020-03-24T02%3A04%3A59Z&groupStatsPeriod=auto&query=release%3A1.0.0%20error.handled%3A0&sort=freq&start=2020-03-23T01%3A02%3A00Z'
    );

    userEvent.click(screen.getByRole('button', {name: 'All Issues'}));
    expect(screen.getByRole('button', {name: 'Open in Issues'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/issues/?end=2020-03-24T02%3A04%3A59Z&groupStatsPeriod=auto&query=release%3A1.0.0&sort=freq&start=2020-03-23T01%3A02%3A00Z'
    );
  });
});
