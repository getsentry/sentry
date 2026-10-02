import {Fragment, useState} from 'react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

import {Container} from '@sentry/scraps/layout';
import {PictureInPictureProvider} from '@sentry/scraps/pictureInPicture';

import * as Storybook from 'sentry/stories';
import {OrganizationContext} from 'sentry/utils/organizationContext';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SeerExplorerContent} from 'sentry/views/seerExplorer/components/seerExplorerContent';
import {
  SeerExplorerChatDispatchContext,
  SeerExplorerChatStateContext,
} from 'sentry/views/seerExplorer/seerExplorerChatStateContext';
import {SeerExplorerSessionsProvider} from 'sentry/views/seerExplorer/seerExplorerSessionContext';
import type {
  Block,
  PendingUserInput,
  SeerExplorerResponse,
} from 'sentry/views/seerExplorer/types';

const RUN_ID = 4242;

// Fixture times count from shortly before the story loads: a run awaiting input shows a live
// elapsed timer, which fixed dates would put hours in the past.
const CONVERSATION_START = Date.now() - 70_000;
const at = (secondsIn: number) =>
  new Date(CONVERSATION_START + secondsIn * 1000).toISOString();
const APPROVAL_ID = '11111111-1111-4111-8111-111111111111';

type Session = NonNullable<SeerExplorerResponse['session']>;

/**
 * Answers every query the chat window makes from fixtures, so the story never reaches the API.
 * Per-query options outrank client defaults, which is why this replaces `queryFn` after
 * defaulting rather than setting a default. Sending a message is a mutation and is not stubbed.
 */
class FixtureQueryClient extends QueryClient {
  session: Session;

  constructor(session: Session) {
    super({defaultOptions: {queries: {retry: false}}});
    this.session = session;
  }

  respond(url: string): unknown {
    if (url.includes(`/seer/explorer-chat/${RUN_ID}/`)) {
      return {session: this.session} satisfies SeerExplorerResponse;
    }
    // Run history, integrations and the like: every other query in the window is a list.
    return [];
  }

  override defaultQueryOptions: QueryClient['defaultQueryOptions'] = options => {
    const defaulted = super.defaultQueryOptions(options);
    const url = String(defaulted.queryKey[0]);
    const queryFn = () => Promise.resolve({json: this.respond(url), headers: {}});
    // Each fixture matches the response type of the query that asked for it.
    return {...defaulted, queryFn: queryFn as never};
  };
}

const noopDispatch = () => {};

/**
 * The whole Explorer chat window — header, transcript, pending-input blocks, and composer — as
 * the sidebar renders it, for a fixed run.
 */
function ChatWindow({session}: {session: Session}) {
  const organization = useOrganization();
  const [queryClient] = useState(() => new FixtureQueryClient(session));

  return (
    <OrganizationContext.Provider
      value={{
        ...organization,
        openMembership: true,
        hideAiFeatures: false,
        features: [...organization.features, 'seer-explorer'],
      }}
    >
      <QueryClientProvider client={queryClient}>
        {/* Provided directly rather than through `SeerExplorerChatStateProvider`, which would
            persist the story's run over the viewer's own Explorer session. */}
        <SeerExplorerChatDispatchContext.Provider value={noopDispatch}>
          <SeerExplorerChatStateContext.Provider
            value={{runId: RUN_ID, chatPrompt: null, chatStates: {}}}
          >
            <PictureInPictureProvider>
              <SeerExplorerSessionsProvider>
                <Container height="720px" width="480px" border="primary" radius="md">
                  <SeerExplorerContent
                    getPageReferrer={() => '/issues/'}
                    onClose={() => {}}
                  />
                </Container>
              </SeerExplorerSessionsProvider>
            </PictureInPictureProvider>
          </SeerExplorerChatStateContext.Provider>
        </SeerExplorerChatDispatchContext.Provider>
      </QueryClientProvider>
    </OrganizationContext.Provider>
  );
}

const USER_QUESTION: Block = {
  id: 'user-1',
  message: {role: 'user', content: 'Why is checkout slow since this morning?'},
  timestamp: at(0),
  loading: false,
};

const SEARCH_SPANS: Block = {
  id: 'tool-1',
  message: {
    role: 'tool_use',
    content: null,
    thinking_content:
      'I should look at the slowest checkout spans and see what changed around the regression.',
    tool_calls: [
      {
        id: 'call-1',
        function: 'telemetry_live_search',
        args: JSON.stringify({
          question: 'slowest spans in POST /api/checkout/ since 08:00',
          dataset: 'spans',
          project_slugs: ['storefront'],
        }),
      },
    ],
  },
  timestamp: at(5),
  loading: false,
  tool_results: [
    {tool_call_id: 'call-1', tool_call_function: 'telemetry_live_search', content: '{}'},
  ],
  tool_links: [{kind: 'telemetry_live_search', params: {}}],
};

const INSPECT_ISSUE: Block = {
  id: 'tool-2',
  message: {
    role: 'tool_use',
    content: null,
    thinking_content:
      'Most of the time is in a database query. There is an open issue for an N+1 on the same endpoint.',
    tool_calls: [
      {
        id: 'call-2',
        function: 'get_issue_details',
        args: JSON.stringify({issue_id: '1234'}),
      },
    ],
  },
  timestamp: at(12),
  loading: false,
  tool_results: [
    {tool_call_id: 'call-2', tool_call_function: 'get_issue_details', content: '{}'},
  ],
  tool_links: [{kind: 'get_issue_details', params: {short_id: 'STOREFRONT-42'}}],
};

const ANSWER: Block = {
  id: 'assistant-1',
  message: {
    role: 'assistant',
    content: [
      'Checkout p95 went from **420ms** to **1.8s** at 08:14, right after release `2.31.0`.',
      '',
      'Nearly all of the extra time is an N+1 query in `CartSerializer` — each line item now loads its',
      'product individually. This is tracked as **STOREFRONT-42**.',
      '',
      'Prefetching `product` in the cart query should bring it back to its previous latency.',
    ].join('\n'),
  },
  timestamp: at(20),
  loading: false,
};

const COMPLETED_SESSION: Session = {
  status: 'completed',
  updated_at: at(20),
  blocks: [USER_QUESTION, SEARCH_SPANS, INSPECT_ISSUE, ANSWER],
};

const APPROVAL_PENDING_INPUT: PendingUserInput = {
  id: APPROVAL_ID,
  input_type: 'agent_write_approval',
  data: {required_scopes: ['alerts:write'], session_id: 'story-session'},
};

const AWAITING_APPROVAL_SESSION: Session = {
  status: 'awaiting_user_input',
  updated_at: at(70),
  pending_user_input: APPROVAL_PENDING_INPUT,
  blocks: [
    USER_QUESTION,
    SEARCH_SPANS,
    INSPECT_ISSUE,
    ANSWER,
    {
      id: 'user-2',
      message: {
        role: 'user',
        content: 'Mute the checkout latency monitor until the fix ships.',
      },
      timestamp: at(60),
      loading: false,
    },
    {
      id: 'tool-3',
      message: {
        role: 'tool_use',
        content: null,
        thinking_content: 'Updating the monitor needs write access to alerts.',
        tool_calls: [{id: 'call-3', function: 'sentry_api_execute', args: '{}'}],
      },
      timestamp: at(65),
      loading: false,
      tool_results: [
        {
          tool_call_id: 'call-3',
          tool_call_function: 'sentry_api_execute',
          content: '{% agentWriteApproval /%}',
          structuredContent: {
            agentWriteApproval: {
              inputId: APPROVAL_ID,
              requiredScopes: ['alerts:write'],
              sessionId: 'story-session',
              status: 'pending',
            },
          },
        },
      ],
      tool_links: [
        {kind: 'sentry_api_execute', params: {is_error: true, pending_approval: true}},
      ],
    },
  ],
};

const APPROVAL_REQUEST_BLOCK = AWAITING_APPROVAL_SESSION.blocks!.at(-1)!;

// The run after the user approved: the request's status line resolves, and the agent keeps
// reasoning and calling tools inside the same thinking block before answering.
const RESUMED_AFTER_APPROVAL_SESSION: Session = {
  status: 'completed',
  updated_at: at(90),
  blocks: [
    ...AWAITING_APPROVAL_SESSION.blocks!.slice(0, -1),
    {
      ...APPROVAL_REQUEST_BLOCK,
      tool_results: APPROVAL_REQUEST_BLOCK.tool_results!.map(result => ({
        ...result!,
        structuredContent: {
          agentWriteApproval: {
            inputId: APPROVAL_ID,
            requiredScopes: ['alerts:write'],
            sessionId: 'story-session',
            status: 'approved',
          },
        },
      })),
      tool_links: [{kind: 'sentry_api_execute', params: {}}],
    },
    {
      id: 'tool-4',
      message: {
        role: 'tool_use',
        content: null,
        thinking_content:
          'Access was granted. Muting the monitor until Friday, when the fix is scheduled to ship.',
        tool_calls: [
          {
            id: 'call-4',
            function: 'telemetry_live_search',
            args: JSON.stringify({
              question: 'checkout latency monitor status',
              dataset: 'issues',
              project_slugs: ['storefront'],
            }),
          },
        ],
      },
      timestamp: at(80),
      loading: false,
      tool_results: [
        {
          tool_call_id: 'call-4',
          tool_call_function: 'telemetry_live_search',
          content: '{}',
        },
      ],
      tool_links: [{kind: 'telemetry_live_search', params: {}}],
    },
    {
      id: 'assistant-2',
      message: {
        role: 'assistant',
        content:
          'Muted **Checkout p95 latency** until Friday. It will alert again after that.',
      },
      timestamp: at(90),
      loading: false,
    },
  ],
};

const AWAITING_ANSWER_SESSION: Session = {
  status: 'awaiting_user_input',
  updated_at: at(10),
  pending_user_input: {
    id: 'question-1',
    input_type: 'ask_user_question',
    data: {
      questions: [
        {
          question: 'Which environment should I look at?',
          options: [
            {label: 'production', description: 'Where the regression was reported'},
            {label: 'staging', description: 'Release 2.31.0 landed here first'},
          ],
        },
      ],
    },
  },
  blocks: [USER_QUESTION, SEARCH_SPANS],
};

export default Storybook.story('ChatWindow', story => {
  story('Completed conversation', () => (
    <Fragment>
      <p>
        The full Explorer chat window for a finished run: the user's question, a response
        whose reasoning and tool calls collapse into one thinking block, and the final
        answer. Data comes from fixtures, so nothing reaches the API until you send a
        message.
      </p>
      <ChatWindow session={COMPLETED_SESSION} />
    </Fragment>
  ));

  story('Awaiting write approval', () => (
    <Fragment>
      <p>
        Seer hit a 403 on a write and paused for{' '}
        <Storybook.JSXNode name="agent_write_approval" />. The thinking block records the
        request as a status line, and the Approve/Reject prompt sits above the composer.
      </p>
      <ChatWindow session={AWAITING_APPROVAL_SESSION} />
    </Fragment>
  ));

  story('Resumed after approval', () => (
    <Fragment>
      <p>
        The same run after the user approved. The status line resolves to granted access,
        and the agent's next reasoning and tool calls follow it in the same thinking
        block.
      </p>
      <ChatWindow session={RESUMED_AFTER_APPROVAL_SESSION} />
    </Fragment>
  ));

  story('Awaiting an answer', () => (
    <Fragment>
      <p>
        Seer asked the user to choose between options. The question renders above the
        composer, which carries its Next/Back controls.
      </p>
      <ChatWindow session={AWAITING_ANSWER_SESSION} />
    </Fragment>
  ));
});
