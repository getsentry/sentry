import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {EventEmbedStory} from './eventEmbedStory';

jest.mock('sentry/components/seer/markdown', () => ({
  SeerMarkdown: ({raw}: {raw: string}) => <div aria-label="Rendered markdown">{raw}</div>,
}));

const EVENT_ID = '8f2c1a9d7e6b4f30a1b2c3d4e5f60718';

describe('EventEmbedStory', () => {
  it('resolves the latest event of a recent issue and breaks down a varying tag', async () => {
    const issue = GroupFixture({id: '5551212', shortId: 'JAVASCRIPT-22SP'});
    const issueRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/',
      body: [issue],
      match: [
        MockApiClient.matchQuery({
          project: '-1',
          query: 'is:unresolved issue.category:error',
          sort: 'freq',
          statsPeriod: '14d',
          limit: 1,
        }),
      ],
    });
    const eventRequest = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${issue.id}/events/latest/`,
      body: EventFixture({
        id: EVENT_ID,
        eventID: EVENT_ID,
        groupID: issue.id,
        tags: [
          {key: 'level', value: 'error'},
          {key: 'browser', value: 'Chrome'},
          {key: 'os', value: 'macOS'},
        ],
      }),
    });

    render(<EventEmbedStory />);

    const variants = await screen.findAllByLabelText('Rendered markdown');
    expect(variants).toHaveLength(4);

    for (const variant of variants) {
      expect(variant).toHaveTextContent(EVENT_ID);
      expect(variant).toHaveTextContent(issue.id);
      expect(variant).toHaveTextContent(issue.shortId);
    }

    expect(variants[1]).toHaveTextContent('"view":"tags"');
    // `browser` and `os` are preferred over `level`, which is the same on every
    // event and would draw a single full-width bar.
    expect(variants[2]).toHaveTextContent('"view":"tag","tagKeys":["browser"]');
    expect(variants[3]).toHaveTextContent('"view":"tag","tagKeys":["browser","os"]');

    expect(issueRequest).toHaveBeenCalled();
    expect(eventRequest).toHaveBeenCalled();
  });

  it('omits the multi-tag variant when the event carries only one usable tag', async () => {
    const issue = GroupFixture({id: '5551212', shortId: 'JAVASCRIPT-22SP'});
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/',
      body: [issue],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${issue.id}/events/latest/`,
      body: EventFixture({
        id: EVENT_ID,
        eventID: EVENT_ID,
        groupID: issue.id,
        tags: [{key: 'browser', value: 'Chrome'}],
      }),
    });

    render(<EventEmbedStory />);

    const variants = await screen.findAllByLabelText('Rendered markdown');
    expect(variants).toHaveLength(3);
    expect(variants[2]).toHaveTextContent('"view":"tag","tagKeys":["browser"]');
  });

  it('falls back to a message when the organization has no error events', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/',
      body: [],
    });

    render(<EventEmbedStory />);

    expect(
      await screen.findByText('No error event is available for this organization.')
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Rendered markdown')).not.toBeInTheDocument();
  });
});
