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
      const result = issueAndEventToMarkdown(group, event, null, null);

      expect(result).toContain(`# ${group.title}`);
      expect(result).toContain(`**Issue ID:** ${group.id}`);
      expect(result).toContain(`**Project:** ${group.project?.slug}`);
    });

    it('includes group summary data when provided', () => {
      const result = issueAndEventToMarkdown(group, event, mockGroupSummaryData, null);

      expect(result).toContain('## Issue Summary');
      expect(result).toContain(mockGroupSummaryData.headline);
      expect(result).toContain(`**What's wrong:** ${mockGroupSummaryData.whatsWrong}`);
      expect(result).toContain(`**In the trace:** ${mockGroupSummaryData.trace}`);
      expect(result).toContain(
        `**Possible cause:** ${mockGroupSummaryData.possibleCause}`
      );
    });

    it('includes autofix data when provided', () => {
      const result = issueAndEventToMarkdown(group, event, null, mockAutofixData);

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

      const result = issueAndEventToMarkdown(group, eventWithTags, null, null);

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

      const result = issueAndEventToMarkdown(group, eventWithException, null, null);

      expect(result).toContain('## Exception');
      expect(result).toContain('**Type:** TypeError');
      expect(result).toContain('**Value:** Cannot read property of undefined');
      expect(result).toContain('#### Stacktrace');
    });

    it('prefers autofix rootCause over groupSummary possibleCause', () => {
      const result = issueAndEventToMarkdown(
        group,
        event,
        mockGroupSummaryData,
        mockAutofixData
      );

      expect(result).toContain('## Root Cause');
      expect(result).not.toContain(
        `**Possible cause:** ${mockGroupSummaryData.possibleCause}`
      );
    });
  });

  describe('useCopyIssueDetails', () => {
    const mockClipboard = {writeText: jest.fn()};
    const mockOnClick = jest.fn().mockImplementation(() => {
      mockClipboard.writeText('test');
      indicators.addSuccessMessage('Copied issue to clipboard as Markdown');
      return Promise.resolve();
    });
    const mockCopyToClipboard = jest.fn();
    let generatedText: string;

    beforeEach(() => {
      jest.clearAllMocks();

      Object.defineProperty(window.navigator, 'clipboard', {
        value: mockClipboard,
        writable: true,
      });

      mockCopyToClipboard.mockImplementation(({text}) => {
        generatedText = text;
        return {
          onClick: mockOnClick,
          label: 'Copy',
        };
      });

      jest.mocked(copyToClipboardModule.default).mockImplementation(mockCopyToClipboard);

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

    it('sets up useCopyToClipboard with the correct parameters', () => {
      renderHook(() => useCopyIssueDetails(group, event));

      // Check that the hook was called with the expected parameters
      expect(mockCopyToClipboard).toHaveBeenCalledWith({
        text: expect.any(String),
        successMessage: 'Copied issue to clipboard as Markdown',
        errorMessage: 'Could not copy issue to clipboard',
        onCopy: expect.any(Function),
      });
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
      renderHook(() => useCopyIssueDetails(group, undefined));

      expect(generatedText).toContain(`# ${group.title}`);
      expect(generatedText).toContain(`**Issue ID:** ${group.id}`);
      expect(generatedText).toContain(`**Project:** ${group.project?.slug}`);
      expect(generatedText).toContain('## Issue Summary');
      expect(generatedText).toContain('## Root Cause');
      expect(generatedText).toContain('## Solution');
      expect(generatedText).not.toContain('## Exception');
    });

    it('generates markdown with the correct data when event is provided', () => {
      renderHook(() => useCopyIssueDetails(group, event));

      expect(generatedText).toContain(`# ${group.title}`);
      expect(generatedText).toContain(`**Issue ID:** ${group.id}`);
    });
  });
});
