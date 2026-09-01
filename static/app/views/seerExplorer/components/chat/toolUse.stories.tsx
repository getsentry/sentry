import {Fragment, useState} from 'react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

import {Text} from '@sentry/scraps/text';

import {SeerMarkdown} from 'sentry/components/seer/markdown';
import {AgentWriteApprovalProvider} from 'sentry/components/seer/markdown/embeds/components/agentWriteApproval';
import * as Storybook from 'sentry/stories';
import {BlockComponent} from 'sentry/views/seerExplorer/components/chat';
import type {
  AgentWriteApproval,
  Block,
  PendingUserInput,
} from 'sentry/views/seerExplorer/types';

// Minimal tool-result fixtures for the dev `/scraps` route. No backend or Seer is needed.

function block(overrides: Partial<Block>): Block {
  return {
    id: 'b1',
    message: {
      role: 'tool_use',
      content: null,
      tool_calls: [{id: 'call-1', function: 'sentry_api_execute', args: '{}'}],
    },
    timestamp: '2026-07-24T00:00:00Z',
    loading: false,
    tool_results: [
      {tool_call_id: 'call-1', tool_call_function: 'sentry_api_execute', content: 'ran'},
    ],
    ...overrides,
  };
}

const CODE_MODE_MANY_LINKS = block({
  tool_results: [
    {
      tool_call_id: 'call-1',
      tool_call_function: 'sentry_api_execute',
      content: 'ran',
      structuredContent: {
        links: [
          {kind: 'get_issue_details', params: {issue_id: '123'}},
          {kind: 'get_trace_waterfall', params: {trace_id: 'abc'}},
          {kind: 'get_replay_details', params: {replay_id: 'rep-9'}},
        ],
      },
    },
  ],
});

const CLASSIC_POSITIONAL = block({
  message: {
    role: 'tool_use',
    content: null,
    tool_calls: [{id: 'call-1', function: 'telemetry_live_search', args: '{}'}],
  },
  tool_results: [
    {tool_call_id: 'call-1', tool_call_function: 'telemetry_live_search', content: '{}'},
  ],
  tool_links: [{kind: 'telemetry_live_search', params: {}}],
});

const MIXED = block({
  message: {
    role: 'tool_use',
    content: null,
    tool_calls: [
      {id: 'call-1', function: 'telemetry_live_search', args: '{}'},
      {id: 'call-2', function: 'sentry_api_execute', args: '{}'},
    ],
  },
  tool_results: [
    {tool_call_id: 'call-1', tool_call_function: 'telemetry_live_search', content: '{}'},
    {
      tool_call_id: 'call-2',
      tool_call_function: 'sentry_api_execute',
      content: 'ran',
      structuredContent: {
        links: [{kind: 'get_issue_details', params: {issue_id: '123'}}],
      },
    },
  ],
  tool_links: [{kind: 'telemetry_live_search', params: {}}, null],
});

const APPROVAL_ID = '11111111-1111-4111-8111-111111111111';
const storyQueryClient = new QueryClient();

function AgentWriteApprovalStory() {
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const approval: AgentWriteApproval = {
    inputId: APPROVAL_ID,
    requiredScopes: ['event:write'],
    sessionId: 'story-session',
    status,
  };
  const pendingInput: PendingUserInput | null =
    status === 'pending'
      ? {
          id: APPROVAL_ID,
          input_type: 'agent_write_approval',
          data: {
            required_scopes: ['event:write'],
            session_id: 'story-session',
          },
        }
      : null;

  return (
    <QueryClientProvider client={storyQueryClient}>
      <AgentWriteApprovalProvider
        pendingInput={pendingInput}
        requestApproval={() => Promise.resolve({scopes: approval.requiredScopes})}
        respondToUserInput={(_inputId, responseData) => {
          setStatus(responseData?.decision === 'approve' ? 'approved' : 'rejected');
        }}
      >
        <SeerMarkdown
          raw="{% agentWriteApproval /%}"
          structuredContent={{agentWriteApproval: approval}}
        />
      </AgentWriteApprovalProvider>
    </QueryClientProvider>
  );
}

export default Storybook.story('ToolUseBlock', story => {
  story('Code Mode execute — many links (bus)', () => (
    <Fragment>
      <p>
        A single Code Mode execute produces several deep-links, carried on the tool
        result's <Storybook.JSXNode name="structuredContent" />
        .links. Each renders as a labeled link below the row — no index alignment.
      </p>
      <BlockComponent
        block={CODE_MODE_MANY_LINKS}
        blockIndex={0}
        blocks={[CODE_MODE_MANY_LINKS]}
      />
    </Fragment>
  ));

  story('Classic tool — positional fallback', () => (
    <Fragment>
      <p>
        No structuredContent on the result (older seer / classic tool): the row renders as
        a link from the positional block.tool_links.
      </p>
      <BlockComponent
        block={CLASSIC_POSITIONAL}
        blockIndex={0}
        blocks={[CLASSIC_POSITIONAL]}
      />
    </Fragment>
  ));

  story('Mixed block — classic row + Code Mode row', () => (
    <Fragment>
      <p>
        One block with two tool calls: the classic tool renders via its positional row
        link, the Code Mode execute renders its link from the bus — each row independent.
      </p>
      <BlockComponent block={MIXED} blockIndex={0} blocks={[MIXED]} />
    </Fragment>
  ));

  story('Agent write approval — structured content', () => (
    <Fragment>
      <Text>
        The actionable approval card is delivered through structured content and explains
        the requested access in plain language.
      </Text>
      <AgentWriteApprovalStory />
    </Fragment>
  ));
});
