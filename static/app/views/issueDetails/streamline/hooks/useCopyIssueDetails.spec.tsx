import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHook} from 'sentry-test/reactTestingLibrary';

import * as indicators from 'sentry/actionCreators/indicator';
import {
  AutofixStatus,
  AutofixStepType,
  type AutofixData,
} from 'sentry/components/events/autofix/types';
import * as autofixHooks from 'sentry/components/events/autofix/useAutofix';
import type {GroupSummaryData} from 'sentry/components/group/groupSummary';
import * as groupSummaryHooks from 'sentry/components/group/groupSummary';
import {EntryType} from 'sentry/types/event';
import * as copyToClipboardModule from 'sentry/utils/useCopyToClipboard';
import * as useOrganization from 'sentry/utils/useOrganization';
import {
  issueAndEventToMarkdown,
  useCopyIssueDetails,
} from 'sentry/views/issueDetails/streamline/hooks/useCopyIssueDetails';

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

  // Create a mock AutofixData with steps that includes root cause and solution steps
  const mockAutofixData: AutofixData = {
    last_triggered_at: '2023-01-01T00:00:00Z',
    request: {
      repos: [],
    },
    codebases: {},
    run_id: '123',
    status: AutofixStatus.COMPLETED,
    steps: [
      {
        id: 'root-cause-step',
        index: 0,
        progress: [],
        status: AutofixStatus.COMPLETED,
        title: 'Root Cause',
        type: AutofixStepType.ROOT_CAUSE_ANALYSIS,
        causes: [
          {
            id: 'cause-1',
            description: 'Root cause text',
          },
        ],
        selection: null,
      },
      {
        id: 'solution-step',
        index: 1,
        progress: [],
        status: AutofixStatus.COMPLETED,
        title: 'Solution',
        type: AutofixStepType.SOLUTION,
        solution: [
          {
            timeline_item_type: 'internal_code',
            title: 'Solution title',
            code_snippet_and_analysis: 'Solution text',
          },
        ],
        solution_selected: true,
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
      expect(result).toContain('## Solution');
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

      jest.mocked(copyToClipboardModule.default).mockReturnValue({
        copy: mockCopy,
      });

      jest.spyOn(groupSummaryHooks, 'useGroupSummaryData').mockReturnValue({
        data: mockGroupSummaryData,
        isPending: false,
      });

      jest.spyOn(autofixHooks, 'useAutofixData').mockReturnValue({
        data: mockAutofixData,
        isPending: false,
      });

      jest.spyOn(indicators, 'addSuccessMessage').mockImplementation(() => {});
      jest.spyOn(indicators, 'addErrorMessage').mockImplementation(() => {});
      jest.spyOn(useOrganization, 'default').mockReturnValue(organization);
    });

    it('calls useCopyToClipboard hook', () => {
      renderHook(() => useCopyIssueDetails(group, event));

      // Check that the hook was called
      expect(copyToClipboardModule.default).toHaveBeenCalled();
    });

    it('sets up hotkeys with the correct callbacks', () => {
      const useHotkeysMock = jest.spyOn(require('sentry/utils/useHotkeys'), 'useHotkeys');

      renderHook(() => useCopyIssueDetails(group, event));

      expect(useHotkeysMock).toHaveBeenCalledWith([
        {
          match: 'command+alt+c',
          callback: expect.any(Function),
          skipPreventDefault: expect.any(Boolean),
        },
        {
          match: 'ctrl+alt+c',
          callback: expect.any(Function),
          skipPreventDefault: expect.any(Boolean),
        },
      ]);
    });

    it('provides partial data when event is undefined', () => {
      let capturedText = '';

      mockCopy.mockImplementation((text: string) => {
        capturedText = text;
        return Promise.resolve(text);
      });

      renderHook(() => useCopyIssueDetails(group, undefined));

      // Trigger the keyboard event (command+alt+c)
      const keyboardEvent = new KeyboardEvent('keydown', {
        keyCode: 67, // 'C'.charCodeAt(0)
        metaKey: true,
        altKey: true,
        bubbles: true,
      } as KeyboardEventInit);
      document.dispatchEvent(keyboardEvent);

      expect(capturedText).toContain(`# ${group.title}`);
      expect(capturedText).toContain(`**Issue ID:** ${group.id}`);
      expect(capturedText).toContain(`**Project:** ${group.project?.slug}`);
      expect(capturedText).toContain('## Issue Summary');
      expect(capturedText).toContain('## Root Cause');
      expect(capturedText).toContain('## Solution');
      expect(capturedText).not.toContain('## Exception');
    });

    it('generates markdown with the correct data when event is provided', () => {
      let capturedText = '';

      mockCopy.mockImplementation((text: string) => {
        capturedText = text;
        return Promise.resolve(text);
      });

      renderHook(() => useCopyIssueDetails(group, event));

      // Trigger the keyboard event (command+alt+c)
      const keyboardEvent = new KeyboardEvent('keydown', {
        keyCode: 67, // 'C'.charCodeAt(0)
        metaKey: true,
        altKey: true,
        bubbles: true,
      } as KeyboardEventInit);
      document.dispatchEvent(keyboardEvent);

      expect(capturedText).toContain(`# ${group.title}`);
      expect(capturedText).toContain(`**Issue ID:** ${group.id}`);
    });
  });
});
