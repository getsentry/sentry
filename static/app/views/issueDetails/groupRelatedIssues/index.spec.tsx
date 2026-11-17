import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {GroupRelatedIssues} from 'sentry/views/issueDetails/groupRelatedIssues';

describe('Related Issues View', () => {
  const organization = OrganizationFixture();
  const groupId = '12345678';
  const group = GroupFixture({id: groupId});
  const orgSlug = organization.slug;
  const group1 = '15';
  const group2 = '20';
  const orgIssuesEndpoint = `/organizations/${orgSlug}/issues/`;
  const relatedEndpoint = `/organizations/${orgSlug}/issues/${groupId}/related/`;

  const errorType = 'RuntimeError';
  const issuesData = [
    GroupFixture({
      id: group1,
      shortId: `EARTH-${group1}`,
      project: ProjectFixture({id: '3', name: 'Earth', slug: 'earth'}),
      metadata: {
        type: errorType,
      },
      lastSeen: '2024-03-15T20:15:30Z',
    }),
    GroupFixture({
      id: group2,
      shortId: `EARTH-${group2}`,
      project: ProjectFixture({id: '3', name: 'Earth', slug: 'earth'}),
      metadata: {
        type: errorType,
      },
      lastSeen: '2024-03-16T20:15:30Z',
    }),
  ];
  const sameTraceData = {
    data: issuesData.map(issue => ({issue, relations: [{type: 'same_trace'}]})),
    meta: {
      types: [{type: 'same_trace', status: 'ok', eventId: 'abcd', traceId: '1234'}],
    },
  };

  beforeEach(() => {
    // GroupList calls this but we don't need it for this test
    MockApiClient.addMockResponse({
      url: `/organizations/${orgSlug}/users/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${group.id}/`,
      body: group,
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('renders issues in the same trace', async () => {
    const traceIssuesMock = MockApiClient.addMockResponse({
      url: relatedEndpoint,
      match: [MockApiClient.matchQuery({type: ['same_trace'], limit: 100})],
      body: sameTraceData,
    });
    const issuesMock = MockApiClient.addMockResponse({
      url: orgIssuesEndpoint,
      match: [MockApiClient.matchQuery({query: `issue.id:[${group1},${group2}]`})],
      body: issuesData,
    });
    render(<GroupRelatedIssues group={group} />, {
      organization,
    });

    // Wait for the issues showing up on the table
    expect(await screen.findByText(`EARTH-${group1}`)).toBeInTheDocument();
    expect(await screen.findByText(`EARTH-${group2}`)).toBeInTheDocument();

    expect(traceIssuesMock).toHaveBeenCalled();
    expect(issuesMock).toHaveBeenCalled();
    const linkElement = screen.getByRole('link', {name: /this trace/i});
    expect(linkElement).toHaveAttribute(
      'href',
      '/organizations/org-slug/performance/trace/1234/?node=error-abcd'
    );
    const linkButton = screen.getByRole('button', {name: /open in issues/i});
    // The Issue search supports using `trace` as a parameter
    expect(linkButton).toHaveAttribute(
      'href',
      `/organizations/org-slug/issues/?project=-1&query=${encodeURIComponent('trace:1234')}`
    );
  });

  it('shows an error and retries when trace search is unavailable', async () => {
    MockApiClient.addMockResponse({
      url: relatedEndpoint,
      match: [MockApiClient.matchQuery({type: ['same_trace']})],
      statusCode: 503,
      body: {detail: 'Related issues are temporarily unavailable. Try again later.'},
    });
    render(<GroupRelatedIssues group={group} />, {
      organization,
    });

    expect(
      await screen.findByText('Unable to load related issues, please try again later')
    ).toBeInTheDocument();

    MockApiClient.addMockResponse({
      url: relatedEndpoint,
      match: [MockApiClient.matchQuery({type: ['same_trace']})],
      body: sameTraceData,
    });
    MockApiClient.addMockResponse({
      url: orgIssuesEndpoint,
      body: issuesData,
    });
    await userEvent.click(screen.getByRole('button', {name: 'Retry'}));

    expect(await screen.findByText(`EARTH-${group1}`)).toBeInTheDocument();
  });
});
