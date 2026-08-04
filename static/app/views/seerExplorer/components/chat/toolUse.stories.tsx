import {Fragment} from 'react';

import * as Storybook from 'sentry/stories';
import {BlockComponent} from 'sentry/views/seerExplorer/components/chat';
import type {Block} from 'sentry/views/seerExplorer/types';

// Minimal block fixtures for eyeballing the links-bus render (code-mode-effects-registry).
// View at the dev `/stories` route. No backend/seer needed — BlockComponent is a pure function
// of the block, so these exercise exactly the render path the links bus lands on.

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

export default Storybook.story('ToolUseBlock (links bus)', story => {
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
});
