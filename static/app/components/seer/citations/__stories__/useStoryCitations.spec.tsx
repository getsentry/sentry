import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';

import {render, screen, waitFor, within} from 'sentry-test/reactTestingLibrary';

import {CitationDetail} from 'sentry/components/seer/citations/citation';
import {CITATION_KINDS} from 'sentry/components/seer/citations/schemas';

import {useStoryCitations} from './useStoryCitations';

// Render each embed as its name and data, so the spec checks which embed a
// citation picks without loading the embed's own data.
jest.mock('sentry/components/seer/markdown/embeds', () => ({
  SeerEmbedRegistry: {
    get: () =>
      function EmbedStub({name, data}: {data: unknown; name: string}) {
        return <div data-test-id="embed">{`${name} ${JSON.stringify(data)}`}</div>;
      },
  },
}));

const EVENT_ID = '8f2c1a9d7e6b4f30a1b2c3d4e5f60718';
const TRACE_ID = 'a1b2c3d4e5f678901234567890abcdef';
const REPLAY_ID = '4c1f2e3d123456789012345678901234';

function StoryCitations() {
  const {citations, sources} = useStoryCitations();
  return (
    <div>
      {CITATION_KINDS.map(kind => (
        <div key={kind} data-test-id={`kind-${kind}`}>
          <span data-test-id={`source-${kind}`}>{sources[kind]}</span>
          {citations
            .filter(c => c.kind === kind)
            .map(c => (
              <CitationDetail key={c.id} citation={c} />
            ))}
        </div>
      ))}
    </div>
  );
}

function mockOrganizationData({empty}: {empty: boolean}) {
  const issue = GroupFixture({id: '5551212', shortId: 'SHOP-1', userCount: 17});
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/issues/',
    body: empty ? [] : [issue],
  });
  MockApiClient.addMockResponse({
    url: `/organizations/org-slug/issues/${issue.id}/events/latest/`,
    body: EventFixture({
      id: EVENT_ID,
      eventID: EVENT_ID,
      groupID: issue.id,
      tags: [{key: 'browser', value: 'Chrome 131'}],
      user: {id: 'user-9', ip_address: '10.0.0.1'},
      entries: [
        {
          type: 'exception',
          data: {
            values: [
              {
                type: 'TypeError',
                value: 'boom',
                stacktrace: {
                  frames: [
                    {function: 'dispatch', filename: 'react-dom.js', inApp: false},
                    {
                      function: 'submitOrder',
                      filename: 'app/checkout.ts',
                      lineNo: 88,
                      inApp: true,
                      context: [[88, 'const total = order.summary.total;']],
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    }),
  });
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/traces/',
    body: {
      data: empty
        ? []
        : [
            {
              trace: TRACE_ID,
              numSpans: 3,
              name: 'POST /checkout',
              end: 1_700_000_000_000,
            },
          ],
    },
  });
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/replays/',
    body: {data: empty ? [] : [{id: REPLAY_ID, started_at: '2026-08-25T16:37:00Z'}]},
  });
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/events/',
    body: {
      data: empty
        ? []
        : [
            {
              id: 'log-1',
              trace: TRACE_ID,
              'project.id': 1,
              message: 'stripe: request timed out',
              timestamp: '2026-08-25T16:37:11+00:00',
              timestamp_precise: '1756139831000000000',
            },
          ],
    },
    match: [MockApiClient.matchQuery({dataset: 'ourlogs'})],
  });
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/events/',
    body: {
      data: empty ? [] : [{'profile.id': 'abcd1234ef', 'project.name': 'shop-frontend'}],
    },
    match: [MockApiClient.matchQuery({dataset: 'spans'})],
  });
}

describe('Citations story', () => {
  it('previews every kind from the organization and the static examples', async () => {
    mockOrganizationData({empty: false});

    render(<StoryCitations />);

    for (const kind of CITATION_KINDS) {
      await waitFor(() =>
        expect(screen.getByTestId(`source-${kind}`)).toHaveTextContent(/^(live|example)$/)
      );
      const section = screen.getByTestId(`kind-${kind}`);
      expect(within(section).getAllByTestId(/^citation-detail-/).length).toBeGreaterThan(
        0
      );
    }

    const frame = screen.getByTestId('citation-detail-c_liveframe');
    expect(frame).toHaveTextContent('submitOrder in app/checkout.ts:88');
    expect(frame).toHaveTextContent('const total = order.summary.total;');
    expect(within(frame).getByTestId('embed')).toHaveTextContent(
      `event {"id":"${EVENT_ID}","issueId":"5551212","view":"summary"}`
    );
    expect(
      within(screen.getByTestId('citation-detail-c_livetag')).getByTestId('embed')
    ).toHaveTextContent('"view":"tag","tagKeys":["browser"]');
    expect(screen.getByTestId('citation-detail-c_livetrace')).toHaveTextContent(
      'POST /checkout (3 spans)'
    );
  });

  it('notes the kinds an organization has no data for', async () => {
    mockOrganizationData({empty: true});

    render(<StoryCitations />);

    for (const kind of ['issue', 'event', 'trace', 'log', 'replay', 'profile', 'query']) {
      await waitFor(() =>
        expect(screen.getByTestId(`source-${kind}`)).toHaveTextContent('missing')
      );
    }
    for (const kind of ['feedback', 'code', 'commit', 'pullRequest', 'external']) {
      const section = screen.getByTestId(`kind-${kind}`);
      expect(screen.getByTestId(`source-${kind}`)).toHaveTextContent('example');
      expect(within(section).getAllByTestId(/^citation-detail-/)).toHaveLength(1);
    }
  });
});
