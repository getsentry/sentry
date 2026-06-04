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
      const result = issueAndEventToMarkdown(group, event, null, null, undefined);

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
        undefined
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
        undefined
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

      const result = issueAndEventToMarkdown(group, eventWithTags, null, null, undefined);

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
        undefined
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
      const result = issueAndEventToMarkdown(group, eventWithThreads, null, null, 1);

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
      const result = issueAndEventToMarkdown(group, eventWithThreads, null, null, 2);

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
        undefined
      );

      expect(result).not.toContain('## Thread');
      expect(result).not.toContain('mainFunction');
    });

    it('includes span evidence for performance issues', () => {
      // 1006 is the occurrence type for N+1 DB Queries
      const performanceEvent = EventFixture({
        ...event,
        title: '/api/0/users/',
        occurrence: {
          type: 1006,
          evidenceData: {
            parentSpanIds: ['parent'],
            causeSpanIds: ['cause'],
            offenderSpanIds: ['offender1', 'offender2'],
            patternSize: 5,
          },
          evidenceDisplay: [],
        },
        entries: [
          {
            type: EntryType.SPANS,
            data: [
              {span_id: 'parent', op: 'http.server', description: 'GET /api/0/users/'},
              {span_id: 'cause', op: 'db', description: 'SELECT * FROM users'},
              {span_id: 'offender1', op: 'db', description: 'SELECT * FROM orders'},
              {span_id: 'offender2', op: 'db', description: 'SELECT * FROM items'},
            ],
          },
        ],
      });

      const result = issueAndEventToMarkdown(
        group,
        performanceEvent,
        null,
        null,
        undefined
      );

      expect(result).toContain('## Span Evidence');
      expect(result).toContain('**Transaction:** /api/0/users/');
      expect(result).toContain('**Parent Span:** http.server - GET /api/0/users/');
      expect(result).toContain('**Preceding Span:** db - SELECT * FROM users');
      expect(result).toContain('**Offending Spans (2):**');
      expect(result).toContain('- db - SELECT * FROM orders');
      expect(result).toContain('- db - SELECT * FROM items');
      expect(result).toContain('**Pattern Size:** 5');
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

      const result = issueAndEventToMarkdown(group, profileEvent, null, null, undefined);

      expect(result).toContain('## Span Evidence');
      expect(result).toContain('**Transaction Name:** app.start');
      expect(result).toContain('**File Path:** /data/cache.db');
    });

    it('includes endpoint regression metrics from the span evidence panel', () => {
      const endpointRegressionEvent = EventFixture({
        ...event,
        projectID: '1',
        title: '/api/0/issues/',
        occurrence: {
          type: 1018,
          evidenceData: {
            transaction: '/api/0/issues/',
            aggregateRange1: 2000,
            aggregateRange2: 3000,
            trendDifference: 1000,
            trendPercentage: 1.5,
            breakpoint: 1700000000,
          },
          evidenceDisplay: [],
        },
      });

      const result = issueAndEventToMarkdown(
        group,
        endpointRegressionEvent,
        null,
        null,
        undefined,
        organization
      );

      expect(result).toContain('## Span Evidence');
      expect(result).toContain('**Endpoint Name:** /api/0/issues/');
      expect(result).toContain('**Change in Duration:**');
      expect(result).toContain('**Approx. Start Time:**');
    });

    it('includes function regression metrics from the span evidence panel', () => {
      const functionRegressionEvent = EventFixture({
        ...event,
        projectID: '1',
        occurrence: {
          type: 2010,
          evidenceData: {
            function: 'loadIssue',
            package: 'sentry.issues',
            file: 'issues.py',
            aggregateRange1: 2_000_000_000,
            aggregateRange2: 4_000_000_000,
            trendDifference: 2_000_000_000,
            trendPercentage: 2,
            breakpoint: 1700000000,
          },
          evidenceDisplay: [],
        },
      });

      const result = issueAndEventToMarkdown(
        group,
        functionRegressionEvent,
        null,
        null,
        undefined,
        organization
      );

      expect(result).toContain('## Span Evidence');
      expect(result).toContain('**Function Name:** loadIssue');
      expect(result).toContain('**Package Name:** sentry.issues');
      expect(result).toContain('**File Name:** issues.py');
      expect(result).toContain('**Change in Duration:**');
      expect(result).toContain('**Approx. Start Time:**');
    });

    it('does not include span evidence for non-performance issues', () => {
      const result = issueAndEventToMarkdown(group, event, null, null, undefined);

      expect(result).not.toContain('## Span Evidence');
    });

    it('prefers autofix rootCause over groupSummary possibleCause', () => {
      const result = issueAndEventToMarkdown(
        group,
        event,
        mockGroupSummaryData,
        mockAutofixData,
        undefined
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
