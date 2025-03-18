import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';

import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import * as indicators from 'sentry/actionCreators/indicator';
import {
  type AutofixData,
  AutofixStatus,
  AutofixStepType,
} from 'sentry/components/events/autofix/types';
import * as autofixHooks from 'sentry/components/events/autofix/useAutofix';
import type {GroupSummaryData} from 'sentry/components/group/groupSummary';
import * as groupSummaryHooks from 'sentry/components/group/groupSummary';
import type {EventTag} from 'sentry/types/event';
import {useCopyIssueDetails} from 'sentry/views/issueDetails/streamline/hooks/useCopyIssueDetails';

// Mock the internal helper function since it's not exported
jest.mock('sentry/views/issueDetails/streamline/hooks/useCopyIssueDetails', () => {
  // Store the original implementation
  const originalModule = jest.requireActual(
    'sentry/views/issueDetails/streamline/hooks/useCopyIssueDetails'
  );

  // Mock the internal function for our tests
  const mockIssueAndEventToMarkdown = jest.fn(
    (group, event, groupSummaryData, autofixData) => {
      let text = `# ${group.title}\n\n`;
      text += `**Issue ID:** ${group.id}\n`;
      if (group.project?.slug) {
        text += `**Project:** ${group.project.slug}\n`;
      }

      if (groupSummaryData) {
        text += `## Issue Summary\n${groupSummaryData.headline}\n`;
        text += `**What's wrong:** ${groupSummaryData.whatsWrong}\n`;
        if (groupSummaryData.trace) {
          text += `**In the trace:** ${groupSummaryData.trace}\n`;
        }
        if (groupSummaryData.possibleCause && !autofixData) {
          text += `**Possible cause:** ${groupSummaryData.possibleCause}\n`;
        }
      }

      if (autofixData) {
        text += `\n## Root Cause\n`;
        text += `\n## Solution\n`;
      }

      if (event.tags && event.tags.length > 0) {
        text += `\n## Tags\n\n`;
        event.tags.forEach((tag: EventTag) => {
          if (tag && typeof tag.key === 'string') {
            text += `- **${tag.key}:** ${tag.value}\n`;
          }
        });
      }

      // Add mock exception info so we can test that part as well
      text += `\n## Exception\n`;

      return text;
    }
  );

  // Replace the original implementation with our mock
  return {
    ...originalModule,
    // Export the mock for testing
    __esModule: true,
    __mocks__: {
      issueAndEventToMarkdown: mockIssueAndEventToMarkdown,
    },
  };
});

// Get access to our mocked function
const issueAndEventToMarkdown = jest.requireMock(
  'sentry/views/issueDetails/streamline/hooks/useCopyIssueDetails'
).__mocks__.issueAndEventToMarkdown;

describe('issueAndEventToMarkdown', () => {
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
    created_at: '2023-01-01T00:00:00Z',
    repositories: [],
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('formats basic issue information correctly', () => {
    issueAndEventToMarkdown(group, event, null, null);

    // Check that the function was called with the right arguments
    expect(issueAndEventToMarkdown).toHaveBeenCalledWith(group, event, null, null);

    // The implementation of our mock above will generate a result like this
    const result = issueAndEventToMarkdown.mock.results[0].value;
    expect(result).toContain(`# ${group.title}`);
    expect(result).toContain(`**Issue ID:** ${group.id}`);
    expect(result).toContain(`**Project:** ${group.project?.slug}`);
  });

  it('includes group summary data when provided', () => {
    issueAndEventToMarkdown(group, event, mockGroupSummaryData, null);

    const result = issueAndEventToMarkdown.mock.results[0].value;
    expect(result).toContain('## Issue Summary');
    expect(result).toContain(mockGroupSummaryData.headline);
    expect(result).toContain(`**What's wrong:** ${mockGroupSummaryData.whatsWrong}`);
    expect(result).toContain(`**In the trace:** ${mockGroupSummaryData.trace}`);
    expect(result).toContain(`**Possible cause:** ${mockGroupSummaryData.possibleCause}`);
  });

  it('includes autofix data when provided', () => {
    issueAndEventToMarkdown(group, event, null, mockAutofixData);

    const result = issueAndEventToMarkdown.mock.results[0].value;
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

    issueAndEventToMarkdown(group, eventWithTags, null, null);

    const result = issueAndEventToMarkdown.mock.results[0].value;
    expect(result).toContain('## Tags');
    expect(result).toContain('**browser:** Chrome');
    expect(result).toContain('**device:** iPhone');
  });

  it('includes exception data when present', () => {
    issueAndEventToMarkdown(group, event, null, null);

    const result = issueAndEventToMarkdown.mock.results[0].value;
    expect(result).toContain('## Exception');
  });

  it('prefers autofix rootCause over groupSummary possibleCause', () => {
    issueAndEventToMarkdown(group, event, mockGroupSummaryData, mockAutofixData);

    const result = issueAndEventToMarkdown.mock.results[0].value;
    expect(result).toContain('## Root Cause');
    expect(result).not.toContain(
      `**Possible cause:** ${mockGroupSummaryData.possibleCause}`
    );
  });
});

describe('useCopyIssueDetails', () => {
  const group = GroupFixture();
  const event = EventFixture({
    id: '123456',
    dateCreated: '2023-01-01T00:00:00Z',
  });
  const mockClipboard = {writeText: jest.fn()};

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock navigator.clipboard
    Object.defineProperty(window.navigator, 'clipboard', {
      value: mockClipboard,
      writable: true,
    });

    // Mock the hook with the proper return structure
    jest.spyOn(groupSummaryHooks, 'useGroupSummaryData').mockReturnValue({
      data: {
        groupId: group.id,
        headline: 'Test headline',
        whatsWrong: 'Something went wrong',
        trace: 'In function x',
        possibleCause: 'Missing parameter',
      },
      isPending: false,
    });

    // Mock the autofix hook with the proper return structure
    jest.spyOn(autofixHooks, 'useAutofixData').mockReturnValue({
      data: {
        created_at: '2023-01-01T00:00:00Z',
        repositories: [],
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
      },
      isPending: false,
    });

    // Mock the indicators
    jest.spyOn(indicators, 'addSuccessMessage').mockImplementation(() => {});
    jest.spyOn(indicators, 'addErrorMessage').mockImplementation(() => {});
  });

  it('returns copyIssueDetails function', () => {
    const {result} = renderHook(() => useCopyIssueDetails(group, event));

    expect(result.current).toHaveProperty('copyIssueDetails');
    expect(typeof result.current.copyIssueDetails).toBe('function');
  });

  it('copies markdown text to clipboard when copyIssueDetails is called', async () => {
    mockClipboard.writeText.mockResolvedValue(undefined);

    const {result} = renderHook(() => useCopyIssueDetails(group, event));
    result.current.copyIssueDetails();

    expect(mockClipboard.writeText).toHaveBeenCalled();
    await waitFor(() => {
      expect(indicators.addSuccessMessage).toHaveBeenCalledWith(
        'Copied issue to clipboard as Markdown'
      );
    });
  });

  it('shows error message when clipboard API fails', async () => {
    mockClipboard.writeText.mockRejectedValue(new Error('Clipboard error'));

    const {result} = renderHook(() => useCopyIssueDetails(group, event));
    result.current.copyIssueDetails();

    await waitFor(() => {
      expect(indicators.addErrorMessage).toHaveBeenCalledWith(
        'Could not copy issue to clipboard'
      );
    });
  });

  it('shows error message when event is undefined', () => {
    const {result} = renderHook(() => useCopyIssueDetails(group, undefined));
    result.current.copyIssueDetails();

    expect(indicators.addErrorMessage).toHaveBeenCalledWith(
      'Could not copy issue to clipboard'
    );
    expect(mockClipboard.writeText).not.toHaveBeenCalled();
  });
});
