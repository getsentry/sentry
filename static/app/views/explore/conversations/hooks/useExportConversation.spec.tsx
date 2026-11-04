import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';

import {useExportConversation} from './useExportConversation';

const CONVERSATION_ID = 'conv-1';
const URL = `/organizations/org-slug/agents/conversations/${CONVERSATION_ID}/`;

function spanFixture(answer: string, overrides: Record<string, unknown>) {
  return {
    'gen_ai.conversation.id': CONVERSATION_ID,
    parent_span: 'parent-1',
    project: 'test-project',
    'project.id': 1,
    'span.status': 'ok',
    trace: 'trace-1',
    'gen_ai.operation.type': 'ai_client',
    'gen_ai.output.messages': JSON.stringify([{role: 'assistant', content: answer}]),
    ...overrides,
  };
}

describe('useExportConversation', () => {
  const organization = OrganizationFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    act(() => {
      PageFiltersStore.reset();
      PageFiltersStore.init();
    });
  });

  it('paginates every page when the conversation is not fully loaded', async () => {
    MockApiClient.addMockResponse({
      url: URL,
      headers: {Link: `<${URL}?cursor=c1>; rel="next"; results="true"; cursor="c1"`},
      body: {
        conversationId: CONVERSATION_ID,
        title: 'My Run',
        spans: [
          spanFixture('Page one', {
            span_id: 'span-a',
            'span.name': 'first turn',
            'precise.start_ts': 1000,
            'precise.finish_ts': 1000.5,
          }),
        ],
        stats: {},
      },
      match: [(_url, options) => !options.query?.cursor],
    });
    MockApiClient.addMockResponse({
      url: URL,
      body: {
        conversationId: CONVERSATION_ID,
        title: 'My Run',
        spans: [
          spanFixture('Page two', {
            span_id: 'span-b',
            'span.name': 'second turn',
            'precise.start_ts': 2000,
            'precise.finish_ts': 2000.5,
          }),
        ],
        stats: {},
      },
      match: [(_url, options) => options.query?.cursor === 'c1'],
    });

    const blobs: Blob[] = [];
    window.URL.createObjectURL = jest.fn((blob: Blob) => {
      blobs.push(blob);
      return 'blob:conversation';
    });
    window.URL.revokeObjectURL = jest.fn();
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const {result} = renderHookWithProviders(
      () => useExportConversation({conversationId: CONVERSATION_ID}),
      {organization}
    );

    act(() => {
      result.current.downloadConversation();
    });

    await waitFor(() => expect(blobs).toHaveLength(1));

    const markdown = await blobs[0]!.text();
    expect(markdown).toContain('Page one');
    expect(markdown).toContain('Page two');
  });
});
