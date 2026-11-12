import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {TraceLinkedIssues} from './traceLinkedIssues';

describe('TraceLinkedIssues', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture();
  const traceId = 'trace-id';
  const currentIssueId = '999';
  const event = EventFixture({
    groupID: currentIssueId,
    projectID: project.id,
    contexts: {
      trace: {
        trace_id: traceId,
      },
    },
  });

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/users/`,
      body: [],
    });
  });

  it('fetches and renders trace-linked issues with one issue search', async () => {
    const linkedIssueIds = Array.from({length: 22}, (_, index) => String(index + 1));
    const groups = linkedIssueIds.map(issueId =>
      GroupFixture({
        id: issueId,
        shortId: `EXAMPLE-${issueId}`,
        title: `Issue ${issueId}`,
        project,
      })
    );

    const issuesMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/`,
      body: groups.slice(0, 20),
      headers: {'X-Hits': '22'},
      match: [
        MockApiClient.matchQuery({
          collapse: 'filtered',
          limit: '20',
          project: '-1',
          query: `trace:${traceId} !issue.id:${currentIssueId}`,
          statsPeriod: '90d',
        }),
      ],
    });

    render(<TraceLinkedIssues event={event} />, {organization});

    expect(
      await screen.findByText('22 other issues appear in this trace.')
    ).toBeInTheDocument();
    expect(await screen.findByText('EXAMPLE-20')).toBeInTheDocument();
    expect(issuesMock).toHaveBeenCalledTimes(1);

    const openInIssues = screen.getByRole('link', {name: 'Open in Issues'});
    expect(openInIssues).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/issues/?project=-1&query=${encodeURIComponent(`trace:${traceId}`)}&statsPeriod=90d`
    );
  });
});
