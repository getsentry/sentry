import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ReleaseFixture} from 'sentry-fixture/release';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ReleaseIssues} from 'sentry/views/explore/releases/detail/overview/releaseIssues';
import {getReleaseBounds} from 'sentry/views/explore/releases/utils';

describe('ReleaseIssues', () => {
  let issuesEndpoint: jest.Mock;
  let resolvedIssuesEndpoint: jest.Mock;

  const organization = OrganizationFixture();
  const version = '1.0.0';
  const releaseBounds = getReleaseBounds(ReleaseFixture({version: '1.0.0'}));

  beforeEach(() => {
    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/users/`,
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues-count/?end=2020-03-24T02%3A04%3A59Z&query=first-release%3A%221.0.0%22%20is%3Aunresolved&query=release%3A%221.0.0%22%20is%3Aunresolved&query=error.handled%3A0%20release%3A%221.0.0%22%20is%3Aunresolved&query=regressed_in_release%3A%221.0.0%22&start=2020-03-23T01%3A02%3A00Z`,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues-count/?query=first-release%3A%221.0.0%22%20is%3Aunresolved&query=release%3A%221.0.0%22%20is%3Aunresolved&query=error.handled%3A0%20release%3A%221.0.0%22%20is%3Aunresolved&query=regressed_in_release%3A%221.0.0%22&statsPeriod=24h`,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/releases/1.0.0/resolved/`,
    });

    issuesEndpoint = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/`,
      body: [],
    });
    resolvedIssuesEndpoint = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/releases/1.0.0/resolved/`,
      body: [],
    });
  });

  it('shows an empty state', async () => {
    render(<ReleaseIssues version={version} releaseBounds={releaseBounds} />, {
      organization,
    });

    expect(await screen.findByText('No new issues in this release.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', {name: 'Resolved 0'}));
    expect(
      await screen.findByText('No resolved issues in this release.')
    ).toBeInTheDocument();
  });

  it('shows an empty sttate with stats period', async () => {
    render(<ReleaseIssues version={version} releaseBounds={releaseBounds} />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/',
          query: {pageStatsPeriod: '24h'},
        },
      },
    });

    expect(
      await screen.findByText(
        textWithMarkupMatcher('No new issues for the last 24 hours.')
      )
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', {name: 'Unhandled 0'}));
    expect(
      await screen.findByText(
        textWithMarkupMatcher('No unhandled issues for the last 24 hours.')
      )
    ).toBeInTheDocument();
  });

  it('can switch issue filters', async () => {
    render(<ReleaseIssues version={version} releaseBounds={releaseBounds} />, {
      organization,
    });

    // New
    expect(await screen.findByRole('radio', {name: 'New Issues 0'})).toBeChecked();
    expect(screen.getByRole('button', {name: 'Open in Issues'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/issues/?end=2020-03-24T02%3A04%3A59Z&groupStatsPeriod=auto&query=firstRelease%3A1.0.0&sort=freq&start=2020-03-23T01%3A02%3A00Z'
    );
    await waitFor(() => {
      expect(issuesEndpoint).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({
            start: '2020-03-23T01:02:00Z',
            end: '2020-03-24T02:04:59Z',
            groupStatsPeriod: 'auto',
            sort: 'freq',
            limit: 10,
            query: 'first-release:1.0.0 is:unresolved',
          }),
        })
      );
    });

    // Resolved
    await userEvent.click(screen.getByRole('radio', {name: 'Resolved 0'}));
    expect(screen.getByRole('button', {name: 'Open in Issues'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/issues/?end=2020-03-24T02%3A04%3A59Z&groupStatsPeriod=auto&query=release%3A1.0.0&sort=freq&start=2020-03-23T01%3A02%3A00Z'
    );
    await waitFor(() => {
      expect(resolvedIssuesEndpoint).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({
            start: '2020-03-23T01:02:00Z',
            end: '2020-03-24T02:04:59Z',
            groupStatsPeriod: 'auto',
            sort: 'freq',
            limit: 10,
            query: '',
          }),
        })
      );
    });

    // Unhandled
    await userEvent.click(screen.getByRole('radio', {name: 'Unhandled 0'}));
    expect(screen.getByRole('button', {name: 'Open in Issues'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/issues/?end=2020-03-24T02%3A04%3A59Z&groupStatsPeriod=auto&query=release%3A1.0.0%20error.handled%3A0&sort=freq&start=2020-03-23T01%3A02%3A00Z'
    );
    await waitFor(() => {
      expect(issuesEndpoint).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({
            start: '2020-03-23T01:02:00Z',
            end: '2020-03-24T02:04:59Z',
            groupStatsPeriod: 'auto',
            sort: 'freq',
            limit: 10,
            query: 'release:1.0.0 error.handled:0 is:unresolved',
          }),
        })
      );
    });

    // All
    await userEvent.click(screen.getByRole('radio', {name: 'All Issues 0'}));
    expect(await screen.findByRole('button', {name: 'Open in Issues'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/issues/?end=2020-03-24T02%3A04%3A59Z&groupStatsPeriod=auto&query=release%3A1.0.0&sort=freq&start=2020-03-23T01%3A02%3A00Z'
    );
    await waitFor(() => {
      expect(issuesEndpoint).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({
            start: '2020-03-23T01:02:00Z',
            end: '2020-03-24T02:04:59Z',
            groupStatsPeriod: 'auto',
            sort: 'freq',
            limit: 10,
            query: 'release:1.0.0 is:unresolved',
          }),
        })
      );
    });
  });

  it('includes release context when linking to issue', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/`,
      body: [GroupFixture({id: '123'})],
    });

    render(<ReleaseIssues version={version} releaseBounds={releaseBounds} />, {
      organization,
    });

    await userEvent.click(screen.getByRole('radio', {name: /New Issues/}));

    const link = await screen.findByRole('link', {name: /RequestError/});

    // Should pass the query param `query` with value `release:"1.0.0"`
    expect(link).toHaveAttribute(
      'href',
      '/organizations/org-slug/issues/123/?_allp=1&project=2&query=release%3A%221.0.0%22&referrer=release-issue-stream'
    );
  });
});
