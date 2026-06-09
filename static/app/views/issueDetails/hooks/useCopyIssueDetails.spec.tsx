import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHook, userEvent} from 'sentry-test/reactTestingLibrary';

import * as indicators from 'sentry/actionCreators/indicator';
import type {ExplorerAutofixState} from 'sentry/components/events/autofix/useExplorerAutofix';
import * as explorerAutofixHooks from 'sentry/components/events/autofix/useExplorerAutofix';
import {EntryType} from 'sentry/types/event';
import {IssueCategory, IssueType} from 'sentry/types/group';
import * as copyToClipboardModule from 'sentry/utils/useCopyToClipboard';
import * as useOrganization from 'sentry/utils/useOrganization';
import {formatSpanEvidenceToMarkdown} from 'sentry/views/issueDetails/hooks/spanEvidenceMarkdown';
import {
  issueAndEventToMarkdown,
  useCopyIssueDetails,
} from 'sentry/views/issueDetails/hooks/useCopyIssueDetails';

jest.mock('sentry/utils/useCopyToClipboard');

describe('useCopyIssueDetails', () => {
  const organization = OrganizationFixture();
  const group = GroupFixture();
  // Span Evidence gating uses the issue type config, which is keyed off the
  // group's category/type — performance issues must use a performance group.
  const performanceGroup = GroupFixture({
    issueCategory: IssueCategory.PERFORMANCE,
    issueType: IssueType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES,
  });
  const endpointRegressionGroup = GroupFixture({
    issueCategory: IssueCategory.PERFORMANCE,
    issueType: IssueType.PERFORMANCE_ENDPOINT_REGRESSION,
  });
  const functionRegressionGroup = GroupFixture({
    issueCategory: IssueCategory.PERFORMANCE,
    issueType: IssueType.PROFILE_FUNCTION_REGRESSION,
  });
  const event = EventFixture({
    id: '123456',
    dateCreated: '2023-01-01T00:00:00Z',
  });

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
      const result = issueAndEventToMarkdown({group, event, organization});

      expect(result).toContain(`# ${group.title}`);
      expect(result).toContain(`**Issue ID:** ${group.id}`);
      expect(result).toContain(`**Project:** ${group.project?.slug}`);
    });

    it('includes autofix data when provided', () => {
      const result = issueAndEventToMarkdown({
        group,
        event,
        autofixData: mockAutofixData,
        organization,
      });

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

      const result = issueAndEventToMarkdown({
        group,
        event: eventWithTags,
        organization,
      });

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

      const result = issueAndEventToMarkdown({
        group,
        event: eventWithException,
        organization,
      });

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
      const result = issueAndEventToMarkdown({
        group,
        event: eventWithThreads,
        activeThreadId: 1,
        organization,
      });

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
      const result = issueAndEventToMarkdown({
        group,
        event: eventWithThreads,
        activeThreadId: 2,
        organization,
      });

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

      const result = issueAndEventToMarkdown({
        group,
        event: eventWithThreads,
        organization,
      });

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
      expect(formatSpanEvidenceToMarkdown(nPlusOneEvent, organization, performanceGroup))
        .toMatchInlineSnapshot(`
        "
        ## Span Evidence

        **Transaction:** /api/0/relays/projectconfigs/
        **Parent Span:** base.dispatch.execute - RelayProjectConfigsEndpoint.post
        **Preceding Spans (2):**
        - \`db\` (2×, 0ms, 0% of txn):
        \`\`\`sql
        SELECT sentry_option.id, sentry_option.key, sentry_option.value
        FROM sentry_option
        WHERE sentry_option.key = %s
        LIMIT 21
        \`\`\`
        **Offending Spans (4):**
        - \`cache.get\` (2×, 2 distinct keys, 0ms, 0% of txn)
          - o:abc
          - o:def
        - \`db\` (2×, 20ms, 2% of txn):
        \`\`\`sql
        SELECT sentry_option.id, sentry_option.key, sentry_option.value
        FROM sentry_option
        WHERE sentry_option.key = %s
        LIMIT 21
        \`\`\`
          code: src/sentry/relay/config/__init__.py:212 get_project_config
        _Pattern: cache miss → DB read, repeated per entity._
        **Pattern Size:** 4
        "
      `);
    });

    it('dedupes repeated queries instead of printing every span', () => {
      const result = issueAndEventToMarkdown({
        group: performanceGroup,
        event: nPlusOneEvent,
        organization,
      });

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

      const result = issueAndEventToMarkdown({
        group: performanceGroup,
        event: manyOffenderEvent,
        organization,
      });

      // Count indented sample bullets that are actual values (exclude "…and more").
      const sampleLines = (result.match(/^ {2}- (?!…)/gm) ?? []).length;
      expect(sampleLines).toBeLessThanOrEqual(10);
      // Omission is still communicated.
      expect(result).toContain('more');
    });

    it('shares the sample budget across preceding and offending spans', () => {
      // Both span groups have enough distinct values to each exhaust the cap;
      // the budget is shared across the section, so the total stays bounded
      // rather than doubling.
      const makeSpans = (op: string, prefix: string) =>
        Array.from({length: 6}, (_, i) => ({
          span_id: `${prefix}${i}`,
          op,
          description: `${prefix} ${i}`,
        }));
      const precedingSpans = [
        ...makeSpans('http.client', 'pre-http'),
        ...makeSpans('cache.get', 'pre-cache'),
        ...makeSpans('custom.op', 'pre-custom'),
      ];
      const offendingSpans = [
        ...makeSpans('http.client', 'off-http'),
        ...makeSpans('cache.get', 'off-cache'),
        ...makeSpans('custom.op', 'off-custom'),
      ];

      const bothGroupsEvent = EventFixture({
        ...event,
        title: '/api/0/things/',
        startTimestamp: 0,
        endTimestamp: 1,
        occurrence: {
          type: 1006,
          evidenceData: {
            causeSpanIds: precedingSpans.map(s => s.span_id),
            offenderSpanIds: offendingSpans.map(s => s.span_id),
          },
          evidenceDisplay: [],
        },
        entries: [{type: EntryType.SPANS, data: [...precedingSpans, ...offendingSpans]}],
      });

      const result = issueAndEventToMarkdown({
        group: performanceGroup,
        event: bothGroupsEvent,
        organization,
      });

      const sampleLines = (result.match(/^ {2}- (?!…)/gm) ?? []).length;
      expect(sampleLines).toBeLessThanOrEqual(10);
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

      expect(formatSpanEvidenceToMarkdown(profileEvent, organization, performanceGroup))
        .toMatchInlineSnapshot(`
        "
        ## Span Evidence

        **Transaction Name:** app.start
        **File Path:** /data/cache.db
        "
      `);
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

      expect(formatSpanEvidenceToMarkdown(profileEvent, organization, performanceGroup))
        .toMatchInlineSnapshot(`
        "
        ## Span Evidence

        **Transaction:** app.start
        **File Path:** /data/cache.db
        "
      `);
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

      expect(
        formatSpanEvidenceToMarkdown(
          regressionEvent,
          organization,
          endpointRegressionGroup
        )
      ).toMatchInlineSnapshot(`
        "
        ## Regression Summary

        **Endpoint Name:** /api/0/users/
        **Change in Duration:** 2min to 3min (+100%)
        **Approx. Start Time:** Feb 28, 2024 11:00:00 PM UTC
        "
      `);
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

      expect(
        formatSpanEvidenceToMarkdown(
          regressionEvent,
          organization,
          functionRegressionGroup
        )
      ).toMatchInlineSnapshot(`
        "
        ## Regression Summary

        **Function Name:** processData
        **Package Name:** com.example.app
        **File Name:** MainActivity.kt
        **Change in Duration:** 1s to 2s (+100%)
        **Approx. Start Time:** Feb 28, 2024 11:00:00 PM UTC
        "
      `);
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

      const endpointResult = issueAndEventToMarkdown({
        group: endpointRegressionGroup,
        event: endpointRegressionEvent,
        organization,
      });

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

      const functionResult = issueAndEventToMarkdown({
        group: functionRegressionGroup,
        event: functionRegressionEvent,
        organization,
      });

      expect(functionResult).not.toContain('## Span Evidence');
      expect(functionResult).not.toContain('**Transaction:** ApiException');
    });

    it('does not include span evidence for non-performance issues', () => {
      const result = issueAndEventToMarkdown({group, event, organization});

      expect(result).not.toContain('## Span Evidence');
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
