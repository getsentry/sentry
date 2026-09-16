import {TransactionEventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {CopyAsDropdown} from 'sentry/components/copyAsDropdown';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {EntryType, type EventTransaction} from 'sentry/types/event';
import {IssueCategory, IssueType} from 'sentry/types/group';
import {
  useCopyIssueDetails,
  useIssueDetailsMarkdown,
} from 'sentry/views/issueDetails/hooks/useCopyIssueDetails';

import {slowDBQuerySpanFromTraceItem} from './slowDBQuerySpan';
import {SpanEvidenceKeyValueList} from './spanEvidenceKeyValueList';

const project = ProjectFixture({id: '123', slug: 'project-slug'});
const organization = OrganizationFixture({
  features: ['issue-details-slow-query-span-data', 'visibility-explore-view'],
});
const traceId = '8cbbc19c0f54447ab702f00263262726';
const spanId = '1234567890abcdef';
const startTimestamp = 1703779128;
const detailsUrl = `/projects/org-slug/${project.slug}/trace-items/${spanId}/`;

function occurrenceEvent(overrides: Partial<EventTransaction> = {}) {
  return TransactionEventFixture({
    title: '/books',
    projectID: project.id,
    platform: 'python',
    startTimestamp,
    endTimestamp: startTimestamp + 1,
    contexts: {trace: {trace_id: traceId, span_id: 'abcdef0123456789'}},
    occurrence: {
      id: 'occurrence-id',
      eventId: 'event-id',
      resourceId: '',
      detectionTime: new Date((startTimestamp + 1) * 1000).toISOString(),
      type: 1001,
      issueTitle: 'Slow DB Query',
      subtitle: 'SELECT id FROM books',
      fingerprint: ['slow-query'],
      evidenceDisplay: [],
      evidenceData: {
        offenderSpanIds: [spanId],
        parentSpanIds: [],
        causeSpanIds: [],
      },
    },
    entries: [],
    ...overrides,
  });
}

function recordedSpanEntries(
  description = 'SELECT id FROM recorded_books'
): EventTransaction['entries'] {
  return [
    {
      type: EntryType.SPANS,
      data: [
        {
          span_id: spanId,
          trace_id: traceId,
          op: 'db',
          description,
          start_timestamp: startTimestamp,
          timestamp: startTimestamp + 0.5,
        },
      ],
    },
  ];
}

function spanResponse() {
  // Integer attributes are strings on the wire, including duration and code lines.
  return {
    itemId: spanId,
    timestamp: new Date(startTimestamp * 1000).toISOString(),
    meta: {},
    attributes: [
      {name: 'span.description', type: 'str', value: 'SELECT id FROM books'},
      {name: 'span.op', type: 'str', value: 'db'},
      {name: 'span.duration', type: 'int', value: '250'},
      {name: 'code.filepath', type: 'str', value: '/app/books.py'},
      {name: 'code.function', type: 'str', value: 'getBooks'},
      {name: 'code.lineno', type: 'int', value: '42'},
    ],
  };
}

function renderEvidence(event = occurrenceEvent(), features = organization.features) {
  return render(<SpanEvidenceKeyValueList event={event} projectSlug={project.slug} />, {
    organization: OrganizationFixture({features}),
    initialRouterConfig: {
      location: {
        pathname: '/organizations/org-slug/issues/1/',
        query: {statsPeriod: '24h'},
      },
    },
  });
}

const group = GroupFixture({
  project,
  issueCategory: IssueCategory.PERFORMANCE,
  issueType: IssueType.PERFORMANCE_SLOW_DB_QUERY,
});

function EvidenceWithCopy({event}: {event: EventTransaction}) {
  const {text, isPending} = useIssueDetailsMarkdown(group, event);
  useCopyIssueDetails(group, event);
  return (
    <div>
      <CopyAsDropdown
        isDisabled={isPending}
        items={CopyAsDropdown.makeDefaultCopyAsOptions({
          text: undefined,
          json: undefined,
          markdown: () => text,
        })}
      />
      <SpanEvidenceKeyValueList event={event} projectSlug={project.slug} />
    </div>
  );
}

describe('Slow-query evidence from the spans dataset', () => {
  beforeEach(() => {
    ProjectsStore.loadInitialData([project]);
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/${project.slug}/stacktrace-link/`,
      body: {},
    });
  });

  it.each(['transaction', 'segment'])(
    'loads %s-derived evidence without embedded spans',
    async source => {
      const request = MockApiClient.addMockResponse({
        url: detailsUrl,
        body: spanResponse(),
      });
      const event = occurrenceEvent();
      if (source === 'segment') {
        // Segment-derived occurrences use the occurrence ID as a synthetic event ID.
        event.id = event.eventID = event.occurrence!.id;
      }

      renderEvidence(event);

      expect(
        await screen.findByTestId('span-evidence-key-value-list.slow-db-query')
      ).toHaveTextContent('SELECT id FROM books');
      expect(
        screen.getByTestId('span-evidence-key-value-list.slow-db-query')
      ).toHaveTextContent('/app/books.py in getBooks at line 42');
      expect(screen.getByText(/25%/)).toBeInTheDocument();
      expect(screen.getByRole('link', {name: 'More Samples'})).toHaveAttribute(
        'href',
        expect.stringContaining('span.description')
      );
      expect(screen.getByRole('button', {name: 'View Full Trace'})).toHaveAttribute(
        'href',
        expect.stringContaining(traceId)
      );
      expect(request).toHaveBeenCalledTimes(1);
      expect(request.mock.calls[0]![1].query).toEqual({
        item_type: 'spans',
        trace_id: traceId,
        referrer: 'api.organization-trace-item-details',
        start: new Date(startTimestamp * 1000 - 1000).toISOString(),
        end: new Date((startTimestamp + 1) * 1000 + 1000).toISOString(),
      });
    }
  );

  it('prefers dataset evidence over the recorded copy', async () => {
    MockApiClient.addMockResponse({url: detailsUrl, body: spanResponse()});
    renderEvidence(occurrenceEvent({entries: recordedSpanEntries()}));

    const evidence = await screen.findByTestId(
      'span-evidence-key-value-list.slow-db-query'
    );
    expect(evidence).toHaveTextContent('SELECT id FROM books');
    expect(evidence).not.toHaveTextContent('recorded_books');
  });

  it.each([undefined, '', '   '])(
    'retains recorded SQL and duration when the dataset query is %p',
    async description => {
      const response = spanResponse();
      response.attributes = response.attributes.filter(
        attribute => attribute.name !== 'span.description'
      );
      if (description !== undefined) {
        response.attributes.push({
          name: 'span.description',
          type: 'str',
          value: description,
        });
      }
      MockApiClient.addMockResponse({url: detailsUrl, body: response});
      renderEvidence(occurrenceEvent({entries: recordedSpanEntries()}));

      expect(
        await screen.findByTestId('span-evidence-key-value-list.slow-db-query')
      ).toHaveTextContent('SELECT id FROM recorded_books');
      expect(screen.getByText(/50%/)).toBeInTheDocument();
      expect(screen.queryByText(/\/app\/books.py/)).not.toBeInTheDocument();
    }
  );

  it.each([false, true])(
    'shows unavailable when neither source has SQL, with a recorded span=%s',
    async hasRecordedSpan => {
      MockApiClient.addMockResponse({
        url: detailsUrl,
        body: {...spanResponse(), attributes: []},
      });
      renderEvidence(
        occurrenceEvent({entries: hasRecordedSpan ? recordedSpanEntries('   ') : []})
      );

      expect(
        await screen.findByText('Span evidence is unavailable.')
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('cell', {name: 'Duration Impact'})
      ).not.toBeInTheDocument();
    }
  );

  it('does not restore SQL removed from the dataset', async () => {
    MockApiClient.addMockResponse({
      url: detailsUrl,
      body: {
        ...spanResponse(),
        attributes: [{name: 'span.description', type: 'str', value: ''}],
        meta: {'span.description': {meta: {value: {'': {rem: [['!config', 'x']]}}}}},
      },
    });
    renderEvidence(occurrenceEvent({entries: recordedSpanEntries()}));

    expect(await screen.findByText('Span evidence is unavailable.')).toBeInTheDocument();
    expect(screen.queryByText(/recorded_books/)).not.toBeInTheDocument();
  });

  it('retains dataset SQL when optional span attributes are missing', async () => {
    MockApiClient.addMockResponse({
      url: detailsUrl,
      body: {
        ...spanResponse(),
        attributes: [
          {name: 'span.description', type: 'str', value: 'SELECT id FROM books'},
        ],
      },
    });
    renderEvidence(occurrenceEvent({entries: recordedSpanEntries()}));

    const evidence = await screen.findByTestId(
      'span-evidence-key-value-list.slow-db-query'
    );
    expect(evidence).toHaveTextContent('SELECT id FROM books');
    expect(evidence).not.toHaveTextContent('recorded_books');
    expect(screen.queryByRole('cell', {name: 'Duration Impact'})).not.toBeInTheDocument();
  });

  it('uses the full occurrence time range for long segments', async () => {
    const request = MockApiClient.addMockResponse({
      url: detailsUrl,
      body: spanResponse(),
    });
    renderEvidence(occurrenceEvent({endTimestamp: startTimestamp + 7200}));

    await screen.findByTestId('span-evidence-key-value-list.slow-db-query');
    expect(request.mock.calls[0]![1].query).toMatchObject({
      start: new Date(startTimestamp * 1000 - 1000).toISOString(),
      end: new Date((startTimestamp + 7200) * 1000 + 1000).toISOString(),
    });
    expect(request.mock.calls[0]![1].query).not.toHaveProperty('timestamp');
    expect(request.mock.calls[0]![1].query).not.toHaveProperty('statsPeriod');
  });

  it.each([404, 500])(
    'falls back to recorded evidence after a %s response',
    async statusCode => {
      const request = MockApiClient.addMockResponse({
        url: detailsUrl,
        statusCode,
        body: {detail: 'Span unavailable'},
      });
      renderEvidence(occurrenceEvent({entries: recordedSpanEntries()}));

      expect(
        await screen.findByTestId('span-evidence-key-value-list.slow-db-query')
      ).toHaveTextContent('SELECT id FROM recorded_books');
      expect(screen.getByText(/50%/)).toBeInTheDocument();
      expect(request).toHaveBeenCalledTimes(1);
    }
  );

  it('shows an unavailable state when neither source has the span', async () => {
    MockApiClient.addMockResponse({
      url: detailsUrl,
      statusCode: 404,
      body: {detail: 'Span unavailable'},
    });
    renderEvidence();

    expect(await screen.findByText('Span evidence is unavailable.')).toBeInTheDocument();
    expect(screen.queryByRole('cell', {name: 'Duration Impact'})).not.toBeInTheDocument();
  });

  it('does not request span data when the flag is disabled', () => {
    const request = MockApiClient.addMockResponse({
      url: detailsUrl,
      body: spanResponse(),
    });
    renderEvidence(occurrenceEvent({entries: recordedSpanEntries()}), []);

    expect(
      screen.getByTestId('span-evidence-key-value-list.slow-db-query')
    ).toHaveTextContent('SELECT id FROM recorded_books');
    expect(request).not.toHaveBeenCalled();
  });

  it('uses recorded evidence if trace references are missing', () => {
    const request = MockApiClient.addMockResponse({
      url: detailsUrl,
      body: spanResponse(),
    });
    renderEvidence(occurrenceEvent({contexts: {}, entries: recordedSpanEntries()}));

    expect(
      screen.getByTestId('span-evidence-key-value-list.slow-db-query')
    ).toHaveTextContent('SELECT id FROM recorded_books');
    expect(request).not.toHaveBeenCalled();
    expect(screen.getByRole('button', {name: 'View Full Trace'})).toBeInTheDocument();
  });

  it('uses the dataset group for summary links, independently of the detector hash', () => {
    expect(
      slowDBQuerySpanFromTraceItem({
        itemId: spanId,
        timestamp: new Date(startTimestamp * 1000).toISOString(),
        meta: {},
        attributes: [
          {name: 'sentry.group', type: 'str', value: 'dataset-group'},
          {name: 'sentry.category', type: 'str', value: 'db'},
          {name: 'sentry.op', type: 'str', value: 'db.sql.query'},
          {name: 'hash', type: 'str', value: 'detector-hash'},
        ],
      })
    ).toMatchObject({group: 'dataset-group', category: 'db', op: 'db.sql.query'});
  });

  it('does not invent a duration when the dataset has none', async () => {
    const response = spanResponse();
    response.attributes = response.attributes.filter(
      attribute => attribute.name !== 'span.duration'
    );
    MockApiClient.addMockResponse({url: detailsUrl, body: response});
    renderEvidence();

    await screen.findByTestId('span-evidence-key-value-list.slow-db-query');
    expect(screen.queryByRole('cell', {name: 'Duration Impact'})).not.toBeInTheDocument();
  });

  it('supports replacement code-location attribute names', async () => {
    const response = spanResponse();
    response.attributes = response.attributes.map(attribute => ({
      ...attribute,
      name:
        attribute.name === 'code.filepath'
          ? 'code.file.path'
          : attribute.name === 'code.lineno'
            ? 'code.line.number'
            : attribute.name,
    }));
    MockApiClient.addMockResponse({url: detailsUrl, body: response});
    renderEvidence();

    expect(
      await screen.findByTestId('span-evidence-key-value-list.slow-db-query')
    ).toHaveTextContent('/app/books.py in getBooks at line 42');
  });

  it('loads the newly selected occurrence without keeping the previous span', async () => {
    MockApiClient.addMockResponse({url: detailsUrl, body: spanResponse()});
    const {rerender} = renderEvidence();
    await screen.findByTestId('span-evidence-key-value-list.slow-db-query');

    const nextSpanId = 'fedcba0987654321';
    const nextEvent = occurrenceEvent();
    nextEvent.occurrence!.evidenceData.offenderSpanIds = [nextSpanId];
    const nextResponse = spanResponse();
    nextResponse.itemId = nextSpanId;
    nextResponse.attributes[0]!.value = 'SELECT id FROM authors';
    const request = MockApiClient.addMockResponse({
      url: detailsUrl.replace(spanId, nextSpanId),
      body: nextResponse,
    });

    rerender(<SpanEvidenceKeyValueList event={nextEvent} projectSlug={project.slug} />);

    await waitFor(() =>
      expect(
        screen.getByTestId('span-evidence-key-value-list.slow-db-query')
      ).toHaveTextContent('SELECT id FROM authors')
    );
    expect(request).toHaveBeenCalledTimes(1);
    expect(
      screen.getByTestId('span-evidence-key-value-list.slow-db-query')
    ).not.toHaveTextContent('SELECT id FROM books');
  });

  describe('copying the displayed evidence', () => {
    beforeEach(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {writeText: jest.fn().mockResolvedValue(undefined)},
      });
    });
    function renderWithCopy(event = occurrenceEvent(), features = organization.features) {
      return render(<EvidenceWithCopy event={event} />, {
        organization: OrganizationFixture({features}),
      });
    }

    async function copyFromMenu() {
      await userEvent.click(screen.getByRole('button', {name: 'Copy as'}));
      await userEvent.click(screen.getByRole('menuitemradio', {name: 'Markdown'}));
    }

    it.each([false, true])(
      'copies dataset evidence with recorded spans=%s',
      async hasSnapshot => {
        const request = MockApiClient.addMockResponse({
          url: detailsUrl,
          body: spanResponse(),
        });
        renderWithCopy(
          occurrenceEvent({
            entries: hasSnapshot ? recordedSpanEntries() : [],
            formatted: {
              format: 'markdown',
              content: 'SELECT id FROM server_recorded_books',
            },
          })
        );
        const writeText = jest.spyOn(navigator.clipboard, 'writeText');

        await screen.findByText(/\/app\/books.py/);
        await copyFromMenu();
        expect(writeText).toHaveBeenLastCalledWith(
          expect.stringMatching(/SELECT id\s+FROM books/)
        );
        const markdown = writeText.mock.calls.at(-1)![0];
        expect(markdown).toContain('25% of txn');
        expect(markdown).toContain('/app/books.py:42 getBooks');
        expect(markdown).not.toContain('recorded_books');

        await userEvent.keyboard('{Control>}{Alt>}c{/Alt}{/Control}');
        expect(writeText).toHaveBeenLastCalledWith(markdown);
        expect(request).toHaveBeenCalledTimes(1);
      }
    );

    it.each([404, 500])(
      'copies the same recorded fallback after a %s',
      async statusCode => {
        const request = MockApiClient.addMockResponse({
          url: detailsUrl,
          statusCode,
          body: {detail: 'Span unavailable'},
        });
        renderWithCopy(occurrenceEvent({entries: recordedSpanEntries()}));
        const writeText = jest.spyOn(navigator.clipboard, 'writeText');

        await screen.findByText(/50%/);
        await copyFromMenu();
        expect(writeText).toHaveBeenLastCalledWith(
          expect.stringContaining('recorded_books')
        );
        expect(writeText.mock.calls.at(-1)![0]).toContain('50% of txn');
        expect(request).toHaveBeenCalledTimes(1);
      }
    );

    it('copies an unavailable state when neither source has evidence', async () => {
      MockApiClient.addMockResponse({
        url: detailsUrl,
        statusCode: 404,
        body: {detail: 'Not found'},
      });
      renderWithCopy();
      const writeText = jest.spyOn(navigator.clipboard, 'writeText');

      await screen.findByText('Span evidence is unavailable.');
      await copyFromMenu();
      expect(writeText).toHaveBeenLastCalledWith(
        expect.stringContaining('Span evidence is unavailable.')
      );
      expect(writeText.mock.calls.at(-1)![0]).not.toContain('**Duration:**');
    });

    it('keeps flag-off copying on the recorded evidence without fetching', async () => {
      const request = MockApiClient.addMockResponse({
        url: detailsUrl,
        body: spanResponse(),
      });
      renderWithCopy(occurrenceEvent({entries: recordedSpanEntries()}), []);
      const writeText = jest.spyOn(navigator.clipboard, 'writeText');

      await copyFromMenu();
      expect(writeText).toHaveBeenLastCalledWith(
        expect.stringContaining('recorded_books')
      );
      expect(request).not.toHaveBeenCalled();
    });

    it('omits duration from both the pane and copy when it is missing', async () => {
      const response = spanResponse();
      response.attributes = response.attributes.filter(
        attribute => attribute.name !== 'span.duration'
      );
      MockApiClient.addMockResponse({url: detailsUrl, body: response});
      renderWithCopy(occurrenceEvent({entries: recordedSpanEntries()}));
      const writeText = jest.spyOn(navigator.clipboard, 'writeText');

      await screen.findByText(/\/app\/books.py/);
      expect(
        screen.queryByRole('cell', {name: 'Duration Impact'})
      ).not.toBeInTheDocument();
      await copyFromMenu();
      expect(writeText.mock.calls.at(-1)![0]).not.toContain('**Duration:**');
      expect(writeText.mock.calls.at(-1)![0]).not.toContain('50%');
    });

    it('prevents copying a previous occurrence while the selected span is loading', async () => {
      MockApiClient.addMockResponse({url: detailsUrl, body: spanResponse()});
      const {rerender} = renderWithCopy();
      const writeText = jest.spyOn(navigator.clipboard, 'writeText');
      await screen.findByText(/\/app\/books.py/);

      const nextSpanId = 'fedcba0987654321';
      const nextEvent = occurrenceEvent({entries: recordedSpanEntries()});
      nextEvent.occurrence!.evidenceData.offenderSpanIds = [nextSpanId];
      const nextResponse = spanResponse();
      nextResponse.attributes[0]!.value = 'SELECT id FROM authors';
      const {promise, resolve} = Promise.withResolvers<void>();
      MockApiClient.addMockResponse({
        url: detailsUrl.replace(spanId, nextSpanId),
        body: nextResponse,
        asyncDelay: promise,
      });
      rerender(<EvidenceWithCopy event={nextEvent} />);

      expect(screen.getByRole('button', {name: 'Copy as'})).toBeDisabled();
      await userEvent.keyboard('{Control>}{Alt>}c{/Alt}{/Control}');
      expect(writeText).not.toHaveBeenCalled();

      await act(() => {
        resolve();
        return promise;
      });
      await screen.findByText(/SELECT id FROM authors/);
      await copyFromMenu();
      expect(writeText).toHaveBeenLastCalledWith(
        expect.stringMatching(/SELECT id\s+FROM authors/)
      );
      expect(writeText.mock.calls.at(-1)![0]).not.toMatch(/SELECT id\s+FROM books/);
    });
  });
});
