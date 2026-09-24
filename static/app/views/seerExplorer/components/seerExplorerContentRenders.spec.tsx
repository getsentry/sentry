import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {PictureInPictureProvider} from '@sentry/scraps/pictureInPicture';

import {SeerExplorerContent} from 'sentry/views/seerExplorer/components/seerExplorerContent';
import * as useSeerExplorerModule from 'sentry/views/seerExplorer/hooks/useSeerExplorer';
import {SeerExplorerSessionsProvider} from 'sentry/views/seerExplorer/seerExplorerSessionContext';
import type {Block} from 'sentry/views/seerExplorer/types';

const mockMarkdownRender = jest.fn();

// Count every markdown render: parsing markdown is the expensive part of each message, so it is a
// good proxy for how much of the transcript re-renders.
jest.mock('sentry/components/seer/markdown', () => {
  const actual = jest.requireActual('sentry/components/seer/markdown');
  return {
    ...actual,
    SeerMarkdown: (props: any) => {
      mockMarkdownRender(props.raw);
      return <actual.SeerMarkdown {...props} />;
    },
  };
});

const TURNS = 20;

function makeTurn(turn: number): Block[] {
  const ts = new Date(Date.UTC(2024, 0, 1, 0, turn)).toISOString();
  return [
    {
      id: `user-${turn}`,
      message: {role: 'user', content: `Question ${turn}`},
      timestamp: ts,
      loading: false,
    },
    {
      id: `tool-${turn}`,
      message: {
        role: 'tool_use',
        content: null,
        thinking_content: `Thinking about question ${turn}`,
        tool_calls: [
          {id: `call-${turn}`, function: 'telemetry_live_search', args: '{"q":"x"}'},
        ],
      },
      timestamp: ts,
      loading: false,
      tool_results: [
        {
          tool_call_id: `call-${turn}`,
          tool_call_function: 'telemetry_live_search',
          content: '{}',
        },
      ],
      tool_links: [{kind: 'telemetry_live_search', params: {}}],
      // A todo list in a settled turn: every row reads the conversation's latest snapshot.
      todos: turn === 0 ? [{content: 'Investigate', status: 'in_progress'}] : undefined,
    },
    {
      id: `answer-${turn}`,
      message: {role: 'assistant', content: `Answer ${turn}`},
      timestamp: ts,
      loading: false,
    },
  ];
}

const defaultHookReturn: ReturnType<typeof useSeerExplorerModule.useSeerExplorer> = {
  sessionData: null,
  isPolling: false,
  isError: false,
  errorStatusCode: undefined,
  isTimedOut: false,
  runId: 1,
  overrideBashModeEnabled: false,
  overrideCtxEngEnable: true,
  overrideCodeModeEnable: 'off',
  hasSentInterrupt: false,
  sendMessage: jest.fn(),
  switchToRun: jest.fn(),
  startNewSession: jest.fn(),
  interruptRun: jest.fn(),
  respondToUserInput: jest.fn(),
  createPR: jest.fn(),
  setOverrideBashModeEnabled: jest.fn(),
  setOverrideCtxEngEnable: jest.fn(),
  setOverrideCodeModeEnable: jest.fn(),
};

describe('SeerExplorerContent re-renders', () => {
  const organization = OrganizationFixture({
    features: ['seer-explorer', 'gen-ai-features', 'seer-explorer-code-mode-tools'],
    hideAiFeatures: false,
  });
  const getPageReferrer = () => '/issues/';

  const completedBlocks = Array.from({length: TURNS}, (_, i) => makeTurn(i)).flat();

  function renderContent() {
    return render(
      <PictureInPictureProvider>
        <SeerExplorerSessionsProvider>
          <SeerExplorerContent getPageReferrer={getPageReferrer} onClose={() => {}} />
        </SeerExplorerSessionsProvider>
      </PictureInPictureProvider>,
      {organization}
    );
  }

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    sessionStorage.clear();
    mockMarkdownRender.mockClear();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/runs/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/`,
      body: [],
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not re-render the transcript while typing', async () => {
    jest.spyOn(useSeerExplorerModule, 'useSeerExplorer').mockReturnValue({
      ...defaultHookReturn,
      sessionData: {
        blocks: completedBlocks,
        status: 'completed',
        updated_at: '2024-01-01T01:00:00Z',
      },
    });

    renderContent();
    const textarea = await screen.findByTestId('seer-explorer-input');
    expect(screen.getByText(`Answer ${TURNS - 1}`)).toBeInTheDocument();

    mockMarkdownRender.mockClear();
    await userEvent.type(textarea, 'hello');
    expect(textarea).toHaveValue('hello');

    expect(mockMarkdownRender).not.toHaveBeenCalled();
  });

  it('only re-renders the response that changed when polled', async () => {
    const liveUser: Block = {
      id: 'user-live',
      message: {role: 'user', content: 'Live question'},
      timestamp: '2024-01-01T02:00:00Z',
      loading: false,
    };
    const liveTool: Block = {
      id: 'tool-live-1',
      message: {
        role: 'tool_use',
        content: null,
        thinking_content: 'Live thinking 1',
        tool_calls: [
          {id: 'call-live-1', function: 'telemetry_live_search', args: '{"q":"x"}'},
        ],
      },
      timestamp: '2024-01-01T02:00:01Z',
      loading: true,
    };
    const hook = jest.spyOn(useSeerExplorerModule, 'useSeerExplorer');
    // Each poll hands back fresh session and blocks arrays; only changed blocks are new objects.
    const poll = (blocks: Block[], updatedAt: string) =>
      hook.mockReturnValue({
        ...defaultHookReturn,
        isPolling: true,
        sessionData: {blocks: [...blocks], status: 'processing', updated_at: updatedAt},
      });
    const content = (
      <PictureInPictureProvider>
        <SeerExplorerSessionsProvider>
          <SeerExplorerContent getPageReferrer={getPageReferrer} onClose={() => {}} />
        </SeerExplorerSessionsProvider>
      </PictureInPictureProvider>
    );

    poll([...completedBlocks, liveUser, liveTool], '2024-01-01T02:00:01Z');
    const {rerender} = render(content, {organization});
    expect(await screen.findByText('Live question')).toBeInTheDocument();

    // Nothing new: nothing re-renders.
    mockMarkdownRender.mockClear();
    poll([...completedBlocks, liveUser, liveTool], '2024-01-01T02:00:02Z');
    act(() => rerender(content));
    expect(mockMarkdownRender).not.toHaveBeenCalled();

    // A new step in the live response: only that response re-renders.
    mockMarkdownRender.mockClear();
    poll(
      [
        ...completedBlocks,
        liveUser,
        liveTool,
        {
          ...liveTool,
          id: 'tool-live-2',
          message: {...liveTool.message, thinking_content: 'Live thinking 2'},
        },
      ],
      '2024-01-01T02:00:03Z'
    );
    act(() => rerender(content));
    expect(await screen.findByText('Live thinking 2')).toBeInTheDocument();
    expect(mockMarkdownRender).toHaveBeenCalled();
    for (const [raw] of mockMarkdownRender.mock.calls) {
      expect(raw).toMatch(/^Live thinking/);
    }
  });
});
