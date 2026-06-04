import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHook, userEvent} from 'sentry-test/reactTestingLibrary';

import * as indicators from 'sentry/actionCreators/indicator';
import type {ExplorerAutofixState} from 'sentry/components/events/autofix/useExplorerAutofix';
import * as explorerAutofixHooks from 'sentry/components/events/autofix/useExplorerAutofix';
import type {GroupSummaryData} from 'sentry/components/group/groupSummary';
import * as groupSummaryHooks from 'sentry/components/group/groupSummary';
import {EntryType} from 'sentry/types/event';
import * as copyToClipboardModule from 'sentry/utils/useCopyToClipboard';
import * as useOrganization from 'sentry/utils/useOrganization';
import {
  issueAndEventToMarkdown,
  useCopyIssueDetails,
} from 'sentry/views/issueDetails/hooks/useCopyIssueDetails';

jest.mock('sentry/utils/useCopyToClipboard');

describe('useCopyIssueDetails', () => {
  const organization = OrganizationFixture();
  const group = GroupFixture();
  const event = EventFixture({
    id: '123456',
    dateCreated: '2023-01-01T00:00:00Z',
  });

  const mockGroupSummaryData: GroupSummaryData = {
    groupId: group.id,
    headline: 'Test headline',
    whatsWrong: 'Something went wrong',
    trace: 'In function x',
    possibleCause: 'Missing parameter',
  };

  const mockAutofixData: ExplorerAutofixState = {
    run_id: 123,
    status: 'completed',
    updated_at: '2023-01-01T00:00:00Z',
    blocks: [
      {
        id: 'root-cause-block',
        message: {
          role: 'assistant' as const,
          content: 'Found the root cause',
          metadata: {step: 'root_cause'},
        },
        timestamp: '2023-01-01T00:00:00Z',
        loading: false,
        artifacts: [
          {
            key: 'root_cause',
            reason: 'Root cause analysis',
            data: {
              one_line_description: 'Root cause text',
              five_whys: ['Why 1'],
            },
          },
        ],
      },
      {
        id: 'solution-block',
        message: {
          role: 'assistant' as const,
          content: 'Here is the solution',
          metadata: {step: 'solution'},
        },
        timestamp: '2023-01-01T00:00:01Z',
        loading: false,
        artifacts: [
          {
            key: 'solution',
            reason: 'Solution plan',
            data: {
              one_line_summary: 'Solution title',
              steps: [{title: 'Fix it', description: 'Solution text'}],
            },
          },
        ],
      },
    ],
  };

  describe('issueAndEventToMarkdown', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('formats basic issue information correctly', () => {
      const result = issueAndEventToMarkdown(
        group,
        event,
        null,
        null,
        undefined,
        organization
      );

      expect(result).toContain(`# ${group.title}`);
      expect(result).toContain(`**Issue ID:** ${group.id}`);
      expect(result).toContain(`**Project:** ${group.project?.slug}`);
    });

    it('includes group summary data when provided', () => {
      const result = issueAndEventToMarkdown(
        group,
        event,
        mockGroupSummaryData,
        null,
        undefined,
        organization
      );

      expect(result).toContain('## Issue Summary');
      expect(result).toContain(mockGroupSummaryData.headline);
      expect(result).toContain(`**What's wrong:** ${mockGroupSummaryData.whatsWrong}`);
      expect(result).toContain(`**In the trace:** ${mockGroupSummaryData.trace}`);
      expect(result).toContain(
        `**Possible cause:** ${mockGroupSummaryData.possibleCause}`
      );
    });

    it('includes autofix data when provided', () => {
      const result = issueAndEventToMarkdown(
        group,
        event,
        null,
        mockAutofixData,
        undefined,
        organization
      );

      expect(result).toContain('## Root Cause');
      expect(result).toContain('## Plan');
    });

    it('includes tags when present in event', () => {
      const eventWithTags = {
        ...event,
        tags: [
          {key: 'browser', value: 'Chrome'},
          {key: 'device', value: 'iPhone'},
        ],
      };

      const result = issueAndEventToMarkdown(
        group,
        eventWithTags,
        null,
        null,
        undefined,
        organization
      );

      expect(result).toContain('## Tags');
      expect(result).toContain('**browser:** Chrome');
      expect(result).toContain('**device:** iPhone');
    });

    it('includes exception data when present', () => {
      // Create an event fixture with exception entries
      const eventWithException = EventFixture({
        ...event,
        entries: [
          {
            type: EntryType.EXCEPTION,
            data: {
              values: [
                {
                  type: 'TypeError',
                  value: 'Cannot read property of undefined',
                  stacktrace: {
                    frames: [
                      {
                        function: 'testFunction',
                        filename: 'test.js',
                        lineNo: 42,
                        colNo: 13,
                        inApp: true,
                        context: [[42, 'const value = obj.property;']],
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      });

      const result = issueAndEventToMarkdown(
        group,
        eventWithException,
        null,
        null,
        undefined,
        organization
      );

      expect(result).toContain('## Exception');
      expect(result).toContain('**Type:** TypeError');
      expect(result).toContain('**Value:** Cannot read property of undefined');
      expect(result).toContain('#### Stacktrace');
    });

    it('includes thread stacktrace when activeThreadId matches', () => {
      const eventWithThreads = EventFixture({
        ...event,
        entries: [
          {
            type: EntryType.THREADS,
            data: {
              values: [
                {
                  id: 1,
                  name: 'Main Thread',
                  crashed: true,
                  current: true,
                  stacktrace: {
                    frames: [
                      {
                        function: 'mainFunction',
                        filename: 'main.py',
                        lineNo: 10,
                        inApp: true,
                      },
                    ],
                  },
                },
                {
                  id: 2,
                  name: 'Worker Thread',
                  crashed: false,
                  current: false,
                  stacktrace: {
                    frames: [
                      {
                        function: 'workerFunction',
                        filename: 'worker.py',
                        lineNo: 25,
                        inApp: true,
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      });

      // Pass activeThreadId = 1 to select Main Thread
      const result = issueAndEventToMarkdown(
        group,
        eventWithThreads,
        null,
        null,
        1,
        organization
      );

      expect(result).toContain('## Thread: Main Thread');
      expect(result).toContain('(crashed)');
      expect(result).toContain('(current)');
      expect(result).toContain('mainFunction');
      expect(result).toContain('main.py');
      expect(result).not.toContain('Worker Thread');
      expect(result).not.toContain('workerFunction');
    });

    it('includes different thread when activeThreadId changes', () => {
      const eventWithThreads = EventFixture({
        ...event,
        entries: [
          {
            type: EntryType.THREADS,
            data: {
              values: [
                {
                  id: 1,
                  name: 'Main Thread',
                  crashed: true,
                  current: true,
                  stacktrace: {
                    frames: [
                      {
                        function: 'mainFunction',
                        filename: 'main.py',
                        lineNo: 10,
                        inApp: true,
                      },
                    ],
                  },
                },
                {
                  id: 2,
                  name: 'Worker Thread',
                  crashed: false,
                  current: false,
                  stacktrace: {
                    frames: [
                      {
                        function: 'workerFunction',
                        filename: 'worker.py',
                        lineNo: 25,
                        inApp: true,
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      });

      // Pass activeThreadId = 2 to select Worker Thread
      const result = issueAndEventToMarkdown(
        group,
        eventWithThreads,
        null,
        null,
        2,
        organization
      );

      expect(result).toContain('## Thread: Worker Thread');
      expect(result).not.toContain('(crashed)');
      expect(result).not.toContain('(current)');
      expect(result).toContain('workerFunction');
      expect(result).toContain('worker.py');
      expect(result).not.toContain('Main Thread');
      expect(result).not.toContain('mainFunction');
    });

    it('does not include thread stacktrace when activeThreadId is undefined', () => {
      const eventWithThreads = EventFixture({
        ...event,
        entries: [
          {
            type: EntryType.THREADS,
            data: {
              values: [
                {
                  id: 1,
                  name: 'Main Thread',
                  crashed: true,
                  current: true,
                  stacktrace: {
                    frames: [
                      {
                        function: 'mainFunction',
                        filename: 'main.py',
                        lineNo: 10,
                        inApp: true,
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      });

      const result = issueAndEventToMarkdown(
        group,
        eventWithThreads,
        null,
        null,
        undefined,
        organization
      );

      expect(result).not.toContain('## Thread');
      expect(result).not.toContain('mainFunction');
    });

    // 1006 is the occurrence type for N+1 DB Queries. Spans mirror the classic
    // cache-miss → DB-read shape: each offender is a cache.get with a distinct
    // key followed by an identical parameterized query.
    const SENTRY_OPTION_SQL = `SELECT sentry_option.id, sentry_option.key, sentry_option.value
FROM sentry_option
WHERE sentry_option.key = %s
LIMIT 21`;

    const nPlusOneEvent = EventFixture({
      ...event,
      title: '/api/0/relays/projectconfigs/',
      startTimestamp: 0,
      endTimestamp: 1,
      occurrence: {
        type: 1006,
        evidenceData: {
          parentSpanIds: ['parent'],
          causeSpanIds: ['cause1', 'cause2'],
          offenderSpanIds: ['cache1', 'db1', 'cache2', 'db2'],
          patternSize: 4,
        },
        evidenceDisplay: [],
      },
      entries: [
        {
          type: EntryType.SPANS,
          data: [
            {
              span_id: 'parent',
              op: 'base.dispatch.execute',
              description: 'RelayProjectConfigsEndpoint.post',
              start_timestamp: 0,
              timestamp: 1,
            },
            {span_id: 'cause1', op: 'db', description: SENTRY_OPTION_SQL},
            {span_id: 'cause2', op: 'db', description: SENTRY_OPTION_SQL},
            {span_id: 'cache1', op: 'cache.get', description: 'o:abc'},
            {
              span_id: 'db1',
              op: 'db',
              description: SENTRY_OPTION_SQL,
              start_timestamp: 0,
              timestamp: 0.011,
              data: {
                'code.filepath': 'src/sentry/relay/config/__init__.py',
                'code.lineno': 212,
                'code.function': 'get_project_config',
              },
            },
            {span_id: 'cache2', op: 'cache.get', description: 'o:def'},
            {
              span_id: 'db2',
              op: 'db',
              description: SENTRY_OPTION_SQL,
              start_timestamp: 0.011,
              timestamp: 0.02,
            },
          ],
        },
      ],
    });

    it('summarizes N+1 span evidence with dedup, cardinality, code and timing', () => {
      const result = issueAndEventToMarkdown(
        group,
        nPlusOneEvent,
        null,
        null,
        undefined,
        organization
      );

      expect(result).toContain('## Span Evidence');
      expect(result).toContain('**Transaction:** /api/0/relays/projectconfigs/');
      expect(result).toContain(
        '**Parent Span:** base.dispatch.execute - RelayProjectConfigsEndpoint.post'
      );
      expect(result).toContain('**Offending Spans (4):**');

      // Distinct cache keys are reported as cardinality, not listed per-span.
      expect(result).toContain('distinct keys');

      // The cache-miss → DB-read pattern note is surfaced.
      expect(result).toContain('cache miss → DB read');

      // Code location from span data is included.
      expect(result).toContain(
        'code: src/sentry/relay/config/__init__.py:212 get_project_config'
      );

      // Duration Impact (% of transaction) is shown.
      expect(result).toContain('of txn');

      expect(result).toContain('**Pattern Size:** 4');
    });

    it('dedupes repeated queries instead of printing every span', () => {
      const result = issueAndEventToMarkdown(
        group,
        nPlusOneEvent,
        null,
        null,
        undefined,
        organization
      );

      // The identical query collapses to one fenced block per group (preceding +
      // offending) rather than once per span.
      expect(result.match(/```sql/g) ?? []).toHaveLength(2);

      // Regression guard against the previous double-print bug: a single
      // Offending heading and a single Pattern Size line.
      expect(result.match(/Offending Spans/g) ?? []).toHaveLength(1);
      expect(result.match(/Pattern Size/g) ?? []).toHaveLength(1);
    });

    it('caps sample lines across the section for many distinct offenders', () => {
      // Three ops, each with 6 distinct (non-DB) descriptions = 18 distinct
      // values. The per-section budget should hold total samples to 10.
      const makeSpans = (op: string, prefix: string) =>
        Array.from({length: 6}, (_, i) => ({
          span_id: `${prefix}${i}`,
          op,
          description: `${prefix} request ${i}`,
        }));
      const offenders = [
        ...makeSpans('http.client', 'http'),
        ...makeSpans('cache.get', 'cache'),
        ...makeSpans('custom.op', 'custom'),
      ];

      const manyOffenderEvent = EventFixture({
        ...event,
        title: '/api/0/widgets/',
        startTimestamp: 0,
        endTimestamp: 1,
        occurrence: {
          type: 1010, // N+1 API Calls
          evidenceData: {offenderSpanIds: offenders.map(s => s.span_id)},
          evidenceDisplay: [],
        },
        entries: [{type: EntryType.SPANS, data: offenders}],
      });

      const result = issueAndEventToMarkdown(
        group,
        manyOffenderEvent,
        null,
        null,
        undefined,
        organization
      );

      // Count indented sample bullets that are actual values (exclude "…and more").
      const sampleLines = (result.match(/^ {2}- (?!…)/gm) ?? []).length;
      expect(sampleLines).toBeLessThanOrEqual(10);
      // Omission is still communicated.
      expect(result).toContain('more');
    });

    it('includes evidence display rows for profiling issues', () => {
      // 2001 is the occurrence type for File I/O on Main Thread
      const profileEvent = EventFixture({
        ...event,
        occurrence: {
          type: 2001,
          evidenceData: {},
          evidenceDisplay: [
            {name: 'Transaction Name', value: 'app.start', important: true},
            {name: 'File Path', value: '/data/cache.db', important: false},
          ],
        },
      });

      const result = issueAndEventToMarkdown(
        group,
        profileEvent,
        null,
        null,
        undefined,
        organization
      );

      expect(result).toContain('## Span Evidence');
      expect(result).not.toContain('**Transaction:** ApiException');
      expect(result).toContain('**Transaction Name:** app.start');
      expect(result).toContain('**File Path:** /data/cache.db');
    });

    it('uses evidenceData.transactionName for profiling issues', () => {
      const profileEvent = EventFixture({
        ...event,
        occurrence: {
          type: 2001,
          evidenceData: {transactionName: 'app.start'},
          evidenceDisplay: [
            {name: 'File Path', value: '/data/cache.db', important: false},
          ],
        },
      });

      const result = issueAndEventToMarkdown(
        group,
        profileEvent,
        null,
        null,
        undefined,
        organization
      );

      expect(result).toContain('**Transaction:** app.start');
      expect(result).not.toContain('**Transaction:** ApiException');
    });

    it('includes regression metrics for endpoint regression issues', () => {
      const regressionEvent = EventFixture({
        ...event,
        title: 'ApiException',
        occurrence: {
          type: 1018,
          evidenceData: {
            transaction: '/api/0/users/',
            aggregateRange1: 100_000,
            aggregateRange2: 200_000,
            trendDifference: 100_000,
            trendPercentage: 2,
            breakpoint: 1_709_161_200,
          },
          evidenceDisplay: [],
        },
      });

      const result = issueAndEventToMarkdown(
        group,
        regressionEvent,
        null,
        null,
        undefined,
        organization
      );

      expect(result).toContain('## Span Evidence');
      expect(result).toContain('**Endpoint Name:** /api/0/users/');
      expect(result).toContain('**Change in Duration:**');
      expect(result).toContain('**Approx. Start Time:**');
      expect(result).not.toContain('**Transaction:** ApiException');
      expect(result).not.toContain('**Parent Span:**');
    });

    it('includes regression metrics for function regression issues', () => {
      const regressionEvent = EventFixture({
        ...event,
        occurrence: {
          type: 2010,
          evidenceData: {
            function: 'processData',
            package: 'com.example.app',
            file: 'MainActivity.kt',
            aggregateRange1: 1_000_000_000,
            aggregateRange2: 2_000_000_000,
            trendDifference: 1_000_000_000,
            trendPercentage: 2,
            breakpoint: 1_709_161_200,
          },
          evidenceDisplay: [],
        },
      });

      const result = issueAndEventToMarkdown(
        group,
        regressionEvent,
        null,
        null,
        undefined,
        organization
      );

      expect(result).toContain('## Span Evidence');
      expect(result).toContain('**Function Name:** processData');
      expect(result).toContain('**Package Name:** com.example.app');
      expect(result).toContain('**File Name:** MainActivity.kt');
      expect(result).toContain('**Change in Duration:**');
      expect(result).toContain('**Approx. Start Time:**');
    });

    it('omits span evidence when regression issues lack evidenceData', () => {
      const endpointRegressionEvent = EventFixture({
        ...event,
        title: 'ApiException',
        occurrence: {
          type: 1018,
          evidenceDisplay: [],
        },
      });

      const endpointResult = issueAndEventToMarkdown(
        group,
        endpointRegressionEvent,
        null,
        null,
        undefined,
        organization
      );

      expect(endpointResult).not.toContain('## Span Evidence');
      expect(endpointResult).not.toContain('**Transaction:** ApiException');

      const functionRegressionEvent = EventFixture({
        ...event,
        title: 'ApiException',
        occurrence: {
          type: 2010,
          evidenceDisplay: [],
        },
      });

      const functionResult = issueAndEventToMarkdown(
        group,
        functionRegressionEvent,
        null,
        null,
        undefined,
        organization
      );

      expect(functionResult).not.toContain('## Span Evidence');
      expect(functionResult).not.toContain('**Transaction:** ApiException');
    });

    it('does not include span evidence for non-performance issues', () => {
      const result = issueAndEventToMarkdown(
        group,
        event,
        null,
        null,
        undefined,
        organization
      );

      expect(result).not.toContain('## Span Evidence');
    });

    it('prefers autofix rootCause over groupSummary possibleCause', () => {
      const result = issueAndEventToMarkdown(
        group,
        event,
        mockGroupSummaryData,
        mockAutofixData,
        undefined,
        organization
      );

      expect(result).toContain('## Root Cause');
      expect(result).not.toContain(
        `**Possible cause:** ${mockGroupSummaryData.possibleCause}`
      );
    });
  });

  describe('useCopyIssueDetails', () => {
    const mockCopy = jest.fn();

    beforeEach(() => {
      jest.clearAllMocks();

      mockCopy.mockResolvedValue('');

      jest.mocked(copyToClipboardModule.useCopyToClipboard).mockReturnValue({
        copy: mockCopy,
      });

      jest.spyOn(groupSummaryHooks, 'useGroupSummaryData').mockReturnValue({
        data: mockGroupSummaryData,
        isPending: false,
      });

      jest.spyOn(explorerAutofixHooks, 'useExplorerAutofix').mockReturnValue({
        runState: mockAutofixData,
        isLoading: false,
        isPolling: false,
        startStep: jest.fn(),
        createPR: jest.fn(),
        reset: jest.fn(),
        triggerCodingAgentHandoff: jest.fn(),
        codingAgentErrors: [],
        dismissCodingAgentError: jest.fn(),
      } as any);

      jest.spyOn(indicators, 'addSuccessMessage').mockImplementation(() => {});
      jest.spyOn(indicators, 'addErrorMessage').mockImplementation(() => {});
      jest.spyOn(useOrganization, 'useOrganization').mockReturnValue(organization);
    });

    it('calls useCopyToClipboard hook', () => {
      renderHook(() => useCopyIssueDetails(group, event));

      // Check that the hook was called
      expect(copyToClipboardModule.useCopyToClipboard).toHaveBeenCalled();
    });

    it('sets up hotkeys with the correct callbacks', () => {
      const useHotkeysMock = jest.spyOn(
        require('@sentry/scraps/hotkey/useHotkeys'),
        'useHotkeys'
      );

      renderHook(() => useCopyIssueDetails(group, event));

      expect(useHotkeysMock).toHaveBeenCalledWith([
        {
          match: 'mod+alt+c',
          callback: expect.any(Function),
          skipPreventDefault: expect.any(Boolean),
        },
      ]);
    });

    it('provides partial data when event is undefined', async () => {
      let capturedText = '';

      mockCopy.mockImplementation((text: string) => {
        capturedText = text;
        return Promise.resolve(text);
      });

      renderHook(() => useCopyIssueDetails(group, undefined));

      await userEvent.keyboard('{Control>}{Alt>}c{/Alt}{/Control}');

      expect(capturedText).toContain(`# ${group.title}`);
      expect(capturedText).toContain(`**Issue ID:** ${group.id}`);
      expect(capturedText).toContain(`**Project:** ${group.project?.slug}`);
      expect(capturedText).toContain('## Issue Summary');
      expect(capturedText).toContain('## Root Cause');
      expect(capturedText).toContain('## Plan');
      expect(capturedText).not.toContain('## Exception');
    });

    it('generates markdown with the correct data when event is provided', async () => {
      let capturedText = '';

      mockCopy.mockImplementation((text: string) => {
        capturedText = text;
        return Promise.resolve(text);
      });

      renderHook(() => useCopyIssueDetails(group, event));

      await userEvent.keyboard('{Control>}{Alt>}c{/Alt}{/Control}');

      expect(capturedText).toContain(`# ${group.title}`);
      expect(capturedText).toContain(`**Issue ID:** ${group.id}`);
    });
  });
});
