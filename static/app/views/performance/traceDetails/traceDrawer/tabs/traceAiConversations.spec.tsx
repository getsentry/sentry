import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {SpanFields} from 'sentry/views/insights/types';
import {EapSpanNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/eapSpanNode';
import {makeEAPSpan} from 'sentry/views/performance/traceDetails/traceModels/traceTreeTestUtils';

import {TraceAiConversations} from './traceAiConversations';

const organization = OrganizationFixture();
const TRACE_ID = 'trace-1';
const CONVERSATION_A = 'conv-a-1';
const CONVERSATION_B = 'conv-b-1';

function aiSpanFixture({
  id,
  model,
  conversationId,
  operation = 'chat',
}: {
  id: string;
  model: string;
  conversationId?: string;
  operation?: string;
}) {
  return new EapSpanNode(
    null,
    makeEAPSpan({
      event_id: id,
      op: `gen_ai.${operation}`,
      description: `gen_ai.${operation} ${model}`,
      start_timestamp: 1000,
      end_timestamp: 1000.5,
      duration: 0.5,
      additional_attributes: {
        [SpanFields.GEN_AI_OPERATION_TYPE]: 'ai_client',
        [SpanFields.GEN_AI_OPERATION_NAME]: operation,
        [SpanFields.GEN_AI_REQUEST_MODEL]: model,
        [SpanFields.GEN_AI_RESPONSE_MODEL]: model,
        [SpanFields.GEN_AI_RESPONSE_TEXT]: `${model} answer`,
        ...(conversationId ? {[SpanFields.GEN_AI_CONVERSATION_ID]: conversationId} : {}),
      },
    }),
    {organization}
  );
}

const generationA = aiSpanFixture({
  id: 'span-a',
  model: 'model-a',
  conversationId: CONVERSATION_A,
});
const generationB = aiSpanFixture({
  id: 'span-b',
  model: 'model-b',
  conversationId: CONVERSATION_B,
});
const evaluation = aiSpanFixture({
  id: 'span-evaluation',
  model: 'synthetic-evaluator',
  operation: 'evaluate',
});
const unassociatedGeneration = aiSpanFixture({
  id: 'span-unassociated',
  model: 'unassociated-model',
});
const allAiNodes = [generationA, generationB, evaluation, unassociatedGeneration];
const conversationIds = [CONVERSATION_A, CONVERSATION_B];

function mockConversation(conversationId: string, node: EapSpanNode) {
  const {[SpanFields.GEN_AI_RESPONSE_TEXT]: responseText, ...attributes} =
    node.attributes ?? {};
  return MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/agents/conversations/${conversationId}/`,
    body: {
      conversationId,
      title: null,
      spans: [
        {
          ...attributes,
          [SpanFields.GEN_AI_OUTPUT_MESSAGES]: JSON.stringify([
            {role: 'assistant', content: responseText},
          ]),
          span_id: node.id,
          'span.name': node.op,
          'span.status': 'ok',
          parent_span: '',
          'precise.start_ts': 1000,
          'precise.finish_ts': 1000.5,
          project: 'project-slug',
          'project.id': 1,
          trace: TRACE_ID,
        },
        {
          ...attributes,
          span_id: `${node.id}-other-trace`,
          'span.name': node.op,
          'span.status': 'ok',
          parent_span: '',
          'precise.start_ts': 1000,
          'precise.finish_ts': 1000.5,
          project: 'project-slug',
          'project.id': 1,
          trace: 'another-trace',
          [SpanFields.GEN_AI_OUTPUT_MESSAGES]: JSON.stringify([
            {role: 'assistant', content: 'Other trace answer'},
          ]),
        },
      ],
    },
  });
}

async function selectTimelineScope(label: string) {
  await userEvent.click(screen.getByRole('button', {name: /Scope/}));
  await userEvent.click(screen.getByRole('option', {name: label}));
}

describe('TraceAiConversations', () => {
  beforeEach(() => {
    jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1000);
    Element.prototype.scrollTo = jest.fn();
    Element.prototype.scrollIntoView = jest.fn();
    MockApiClient.clearMockResponses();
    act(() => {
      PageFiltersStore.reset();
      PageFiltersStore.init();
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace-items/attributes/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {data: [], meta: {fields: {}}},
    });
    mockConversation(CONVERSATION_A, generationA);
    mockConversation(CONVERSATION_B, generationB);
  });

  it('shows every AI span without conversation IDs, including ai_client evaluations', async () => {
    render(
      <TraceAiConversations
        traceSlug={TRACE_ID}
        allAiNodes={[evaluation, unassociatedGeneration]}
        conversationIds={[]}
      />,
      {organization}
    );

    expect(
      await screen.findByRole('button', {name: /synthetic-evaluator/})
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /unassociated-model/})).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: /Scope|Conversation/})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Show full conversation'})
    ).not.toBeInTheDocument();
    expect(screen.queryByText('LLM Calls')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', {name: 'Transcript'}));
    expect(await screen.findByText('unassociated-model answer')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Show full conversation'})
    ).not.toBeInTheDocument();
  });

  it('defaults mixed traces to all AI spans without conversation-specific chrome', async () => {
    render(
      <TraceAiConversations
        traceSlug={TRACE_ID}
        allAiNodes={allAiNodes}
        conversationIds={conversationIds}
      />,
      {organization}
    );

    expect(screen.getByRole('button', {name: /Scope All AI spans/})).toBeInTheDocument();
    for (const model of [
      'model-a',
      'model-b',
      'synthetic-evaluator',
      'unassociated-model',
    ]) {
      expect(
        await screen.findByRole('button', {name: new RegExp(model)})
      ).toBeInTheDocument();
    }
    expect(
      screen.queryByRole('button', {name: 'Show full conversation'})
    ).not.toBeInTheDocument();
    expect(screen.queryByText('LLM Calls')).not.toBeInTheDocument();
  });

  it('scopes the timeline, aggregates and link to either conversation, then restores all spans', async () => {
    render(
      <TraceAiConversations
        traceSlug={TRACE_ID}
        allAiNodes={allAiNodes}
        conversationIds={conversationIds}
      />,
      {organization}
    );

    await selectTimelineScope(CONVERSATION_A.slice(0, 8));
    expect(await screen.findByRole('button', {name: /model-a/})).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: /model-b|synthetic-evaluator|unassociated-model/,
      })
    ).not.toBeInTheDocument();
    expect(screen.getByText('LLM Calls')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Show full conversation'})).toHaveAttribute(
      'href',
      expect.stringContaining(`/${CONVERSATION_A}/`)
    );

    await selectTimelineScope(CONVERSATION_B.slice(0, 8));
    expect(await screen.findByRole('button', {name: /model-b/})).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: /model-a|synthetic-evaluator|unassociated-model/,
      })
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Show full conversation'})).toHaveAttribute(
      'href',
      expect.stringContaining(`/${CONVERSATION_B}/`)
    );

    await userEvent.click(screen.getByRole('tab', {name: 'Transcript'}));
    expect(await screen.findByText('model-b answer')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: /Conversation/}));
    await userEvent.click(screen.getByRole('option', {name: CONVERSATION_A.slice(0, 8)}));
    expect(await screen.findByText('model-a answer')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', {name: 'Timeline'}));
    expect(await screen.findByRole('button', {name: /model-a/})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Show full conversation'})).toHaveAttribute(
      'href',
      expect.stringContaining(`/${CONVERSATION_A}/`)
    );
    await selectTimelineScope('All AI spans');
    expect(
      await screen.findByRole('button', {name: /synthetic-evaluator/})
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Show full conversation'})
    ).not.toBeInTheDocument();
    expect(screen.queryByText('LLM Calls')).not.toBeInTheDocument();
  });

  it('keeps Transcript conversation-scoped and preserves all-spans scope across tab switches', async () => {
    render(
      <TraceAiConversations
        traceSlug={TRACE_ID}
        allAiNodes={allAiNodes}
        conversationIds={conversationIds}
      />,
      {organization}
    );

    await userEvent.click(screen.getByRole('tab', {name: 'Transcript'}));
    expect(await screen.findByText('model-a answer')).toBeInTheDocument();
    expect(screen.queryByText('model-b answer')).not.toBeInTheDocument();
    expect(screen.queryByText('unassociated-model answer')).not.toBeInTheDocument();
    expect(screen.queryByText('Other trace answer')).not.toBeInTheDocument();
    expect(screen.getByText('LLM Calls')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: /Conversation/}));
    await userEvent.click(screen.getByRole('option', {name: CONVERSATION_B.slice(0, 8)}));
    expect(await screen.findByText('model-b answer')).toBeInTheDocument();
    expect(screen.queryByText('model-a answer')).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Show full conversation'})).toHaveAttribute(
      'href',
      expect.stringContaining(`/${CONVERSATION_B}/`)
    );
    await userEvent.click(screen.getByText('model-b answer'));
    expect(screen.getByRole('button', {name: 'Show full conversation'})).toHaveAttribute(
      'href',
      expect.stringContaining('spanId=span-b')
    );

    await userEvent.click(screen.getByRole('tab', {name: 'Timeline'}));
    expect(screen.getByRole('button', {name: /Scope All AI spans/})).toBeInTheDocument();
    expect(
      await screen.findByRole('button', {name: /unassociated-model/})
    ).toBeInTheDocument();
    expect(screen.queryByText('LLM Calls')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', {name: 'Transcript'}));
    expect(await screen.findByText('model-b answer')).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Show full conversation'})
    ).not.toHaveAttribute('href', expect.stringContaining('spanId='));
  });

  it('offers conversation scope for a single conversation and resets scope on trace changes', async () => {
    const {rerender} = render(
      <TraceAiConversations
        traceSlug={TRACE_ID}
        allAiNodes={[generationA, evaluation]}
        conversationIds={[CONVERSATION_A]}
      />,
      {organization}
    );

    await selectTimelineScope(CONVERSATION_A.slice(0, 8));
    expect(
      screen.queryByRole('button', {name: /synthetic-evaluator/})
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', {name: 'Transcript'}));
    expect(await screen.findByText('model-a answer')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: /Conversation/})).not.toBeInTheDocument();

    rerender(
      <TraceAiConversations
        traceSlug="new-trace"
        allAiNodes={[generationA, evaluation]}
        conversationIds={[CONVERSATION_A]}
      />
    );
    expect(screen.getByRole('tab', {name: 'Timeline'})).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(
      await screen.findByRole('button', {name: /synthetic-evaluator/})
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Show full conversation'})
    ).not.toBeInTheDocument();
  });

  it('falls back to all spans when a timeline conversation selection becomes stale', async () => {
    const {rerender} = render(
      <TraceAiConversations
        traceSlug={TRACE_ID}
        allAiNodes={allAiNodes}
        conversationIds={conversationIds}
      />,
      {organization}
    );
    await selectTimelineScope(CONVERSATION_A.slice(0, 8));

    rerender(
      <TraceAiConversations
        traceSlug={TRACE_ID}
        allAiNodes={[generationB, evaluation]}
        conversationIds={[CONVERSATION_B]}
      />
    );
    expect(
      await screen.findByRole('button', {name: /synthetic-evaluator/})
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /Scope All AI spans/})).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Show full conversation'})
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', {name: 'Transcript'}));
    expect(await screen.findByText('model-b answer')).toBeInTheDocument();
  });
});
