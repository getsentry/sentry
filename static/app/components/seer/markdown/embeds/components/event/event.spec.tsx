import {EventFixture} from 'sentry-fixture/event';
import {ProjectFixture} from 'sentry-fixture/project';
import {TagsFixture} from 'sentry-fixture/tags';

import {screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  getEmbedLinkHref,
  renderEmbed,
} from 'sentry/components/seer/markdown/embeds/components/resourceEmbedTestUtils';

const EVENT_ID = '8f2c1a9d7e6b4f30a1b2c3d4e5f60718';
const ISSUE_ID = '5551212';

function mockEvent(params: Record<string, unknown> = {}) {
  const event = EventFixture({
    id: EVENT_ID,
    eventID: EVENT_ID,
    groupID: ISSUE_ID,
    projectSlug: 'project-slug',
    title: 'ReferenceError: totals is not defined',
    metadata: {type: 'ReferenceError', value: 'totals is not defined'},
    culprit: 'app/checkout in renderTotals',
    tags: [
      {key: 'level', value: 'error'},
      {key: 'browser', value: 'Chrome'},
    ],
    contexts: {browser: {type: 'browser', name: 'Chrome', version: '120.0.0'}},
    ...params,
  });

  MockApiClient.addMockResponse({
    url: `/organizations/org-slug/issues/${ISSUE_ID}/events/${EVENT_ID}/`,
    body: event,
  });

  return event;
}

function renderEventEmbed(data: Record<string, unknown> = {}) {
  return renderEmbed({
    name: 'event',
    data: {id: EVENT_ID, issueId: ISSUE_ID, shortId: 'JAVASCRIPT-22SP', ...data},
  });
}

describe('Seer event embed', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/',
      body: ProjectFixture({slug: 'project-slug'}),
    });
  });

  it('links to the event inline', () => {
    expect(
      getEmbedLinkHref('event', 'JAVASCRIPT-22SP event 8f2c1a9d', {
        id: EVENT_ID,
        issueId: ISSUE_ID,
        shortId: 'JAVASCRIPT-22SP',
      })
    ).toBe(`/organizations/org-slug/issues/${ISSUE_ID}/events/${EVENT_ID}/`);
  });

  it('falls back to the short event id when there is no short id', () => {
    expect(
      getEmbedLinkHref('event', 'Event 8f2c1a9d', {id: EVENT_ID, issueId: ISSUE_ID})
    ).toBe(`/organizations/org-slug/issues/${ISSUE_ID}/events/${EVENT_ID}/`);
  });

  it('renders the event title, message and culprit in the block', async () => {
    mockEvent();

    renderEventEmbed();

    expect(await screen.findByText('ReferenceError')).toBeInTheDocument();
    expect(screen.getByText('totals is not defined')).toBeInTheDocument();
    expect(screen.getByText('app/checkout in renderTotals')).toBeInTheDocument();
    // `HighlightsIconSummary` renders without a `group`, off `event.projectSlug`.
    expect(screen.getByLabelText('Icon highlights')).toBeInTheDocument();
    expect(screen.getByText('Chrome')).toBeInTheDocument();
    expect(screen.getByText('120.0.0')).toBeInTheDocument();
    expect(screen.queryByText('Tags')).not.toBeInTheDocument();
  });

  it('renders the full tag list for view "tags"', async () => {
    mockEvent();

    renderEventEmbed({view: 'tags'});

    expect(await screen.findByTestId('seer-event-tags')).toBeInTheDocument();
    // Sorted by key, the same tree the log embed renders its attributes in.
    expect(screen.getByTestId('tree-key-browser')).toHaveTextContent('browser');
    expect(screen.getByTestId('tree-key-level')).toHaveTextContent('level');
    expect(screen.getByRole('link', {name: 'All tags for this issue'})).toHaveAttribute(
      'href',
      `/organizations/org-slug/issues/${ISSUE_ID}/distributions/`
    );
  });

  it('does not offer the tag row actions inside the embed', async () => {
    mockEvent();

    renderEventEmbed({view: 'tags'});

    expect(await screen.findAllByTestId('attribute-tree-row')).toHaveLength(2);
    // The row menu builds its links out of the host page's `location.query`, so
    // the embed renders the rows without it.
    expect(screen.queryAllByLabelText('Attribute Actions Menu')).toHaveLength(0);
  });

  it('renders the tag tree even when the event has no project slug', async () => {
    mockEvent({
      projectSlug: undefined,
      contexts: {},
      tags: [{key: 'server_name', value: 'web-01'}],
    });

    renderEventEmbed({view: 'tags'});

    // The tree renders off the tags alone, so a response without a project slug
    // no longer falls back to a bare list.
    expect(await screen.findByTestId('seer-event-tags')).toBeInTheDocument();
    expect(screen.getByTestId('tree-key-server_name')).toHaveTextContent('server_name');
    expect(screen.getByText('web-01')).toBeInTheDocument();
  });

  it('renders the tags that are worth more than their own text', async () => {
    mockEvent({
      contexts: {},
      projectID: '2',
      tags: [
        {key: 'release', value: '1.2.3'},
        {key: 'transaction', value: '/checkout'},
      ],
    });

    renderEventEmbed({view: 'tags'});

    expect(await screen.findByTestId('seer-event-tags')).toBeInTheDocument();
    // The release links to the release, not to the bare string.
    expect(screen.getByRole('link', {name: '1.2.3'})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: '/checkout'})).toHaveAttribute(
      'href',
      expect.stringContaining('transaction=%2Fcheckout')
    );
  });

  it('annotates a tag whose value was scrubbed', async () => {
    mockEvent({
      contexts: {},
      tags: [
        {key: 'level', value: 'error'},
        {key: 'server_name', value: '[Filtered]'},
      ],
      // Served positionally: this annotates `tags[1]`, not a key called '1'.
      _meta: {
        tags: {
          1: {value: {'': {len: 7, rem: [['project:0', 's', 0, 10]]}}},
        },
      },
    });

    renderEventEmbed({view: 'tags'});

    expect(await screen.findByTestId('seer-event-tags')).toBeInTheDocument();
    await userEvent.hover(screen.getByText('[Filtered]'));
    expect(
      await screen.findByText(/Replaced because of a data scrubbing rule/)
    ).toBeInTheDocument();
  });

  it('tells the reader when the event has no tags', async () => {
    mockEvent({contexts: {}, tags: []});

    renderEventEmbed({view: 'tags'});

    expect(await screen.findByText('This event has no tags.')).toBeInTheDocument();
    expect(screen.queryByTestId('seer-event-tags')).not.toBeInTheDocument();
  });

  it('renders the distribution of a single tag for view "tag"', async () => {
    mockEvent();
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${ISSUE_ID}/tags/browser/`,
      body: TagsFixture()[0],
    });

    renderEventEmbed({view: 'tag', tagKeys: ['browser']});

    expect(await screen.findByText('Tag Distribution')).toBeInTheDocument();
    expect(await screen.findByText('Firefox')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'All browser values'})).toHaveAttribute(
      'href',
      `/organizations/org-slug/issues/${ISSUE_ID}/distributions/browser/`
    );
  });

  it('renders one distribution per key for view "tag" with several keys', async () => {
    mockEvent();
    const browserRequest = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${ISSUE_ID}/tags/browser/`,
      body: TagsFixture()[0],
    });
    const urlRequest = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${ISSUE_ID}/tags/url/`,
      body: TagsFixture()[2],
    });

    renderEventEmbed({view: 'tag', tagKeys: ['browser', 'url']});

    expect(await screen.findByText('Firefox')).toBeInTheDocument();
    expect(await screen.findByText('http://example.com/foo')).toBeInTheDocument();
    expect(browserRequest).toHaveBeenCalled();
    expect(urlRequest).toHaveBeenCalled();
    // No single tag page covers every requested key, so the header falls back to
    // the issue's distributions page.
    expect(screen.getByRole('link', {name: 'All tags for this issue'})).toHaveAttribute(
      'href',
      `/organizations/org-slug/issues/${ISSUE_ID}/distributions/`
    );
  });

  it('renders only the first few distributions when given a long key list', async () => {
    mockEvent();
    const tagKeys = ['browser', 'url', 'device', 'environment', 'user'];
    const requests = Object.fromEntries(
      tagKeys.map((tagKey, index) => [
        tagKey,
        MockApiClient.addMockResponse({
          url: `/organizations/org-slug/issues/${ISSUE_ID}/tags/${tagKey}/`,
          body: {...TagsFixture()[index], key: tagKey},
        }),
      ])
    );

    renderEventEmbed({view: 'tag', tagKeys});

    expect(await screen.findByText('Firefox')).toBeInTheDocument();
    // The block caps at four, so the fifth key is never requested.
    await waitFor(() => expect(requests.environment).toHaveBeenCalled());
    expect(requests.user).not.toHaveBeenCalled();
  });

  it.each([
    ['without tag keys', {}],
    ['with an empty tag key list', {tagKeys: []}],
  ])('falls back to the summary when view is "tag" %s', async (_label, data) => {
    mockEvent();
    const tagRequest = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${ISSUE_ID}/tags/browser/`,
      body: TagsFixture()[0],
    });

    renderEventEmbed({view: 'tag', ...data});

    expect(await screen.findByText('ReferenceError')).toBeInTheDocument();
    expect(screen.queryByText('Tag Distribution')).not.toBeInTheDocument();
    expect(screen.queryByText('Tags')).not.toBeInTheDocument();
    expect(tagRequest).not.toHaveBeenCalled();
  });

  it('shows an error when the event cannot be loaded', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${ISSUE_ID}/events/${EVENT_ID}/`,
      statusCode: 500,
    });

    renderEventEmbed();

    expect(await screen.findByText('Unable to load event details')).toBeInTheDocument();
  });
});
