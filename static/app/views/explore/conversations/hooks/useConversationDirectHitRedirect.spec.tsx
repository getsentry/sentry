import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import type {Conversation} from 'sentry/views/explore/conversations/hooks/useConversations';

import {useConversationDirectHitRedirect} from './useConversationDirectHitRedirect';

const CONVERSATION: Conversation = {
  conversationId: 'conv-1',
  duration: 1000,
  endTimestamp: 2000,
  errors: 0,
  firstInput: null,
  inputTokens: 0,
  lastOutput: null,
  llmCalls: 1,
  outputTokens: 0,
  startTimestamp: 1000,
  toolCalls: 0,
  toolErrors: 0,
  toolNames: [],
  totalCost: null,
  totalTokens: 100,
  traceCount: 1,
  traceIds: ['trace-1'],
  user: null,
};

describe('useConversationDirectHitRedirect', () => {
  const organization = OrganizationFixture();

  it('redirects to the conversation detail on a single direct hit', async () => {
    const {router} = renderHookWithProviders(useConversationDirectHitRedirect, {
      organization,
      initialProps: {isDirectHit: true, conversations: [CONVERSATION]},
    });

    await waitFor(() => {
      expect(router.location.pathname).toBe(
        `/organizations/${organization.slug}/explore/conversations/conv-1/`
      );
    });
  });

  it('does not redirect when it is not a direct hit', () => {
    const {router} = renderHookWithProviders(useConversationDirectHitRedirect, {
      organization,
      initialRouterConfig: {location: {pathname: '/conversations-list/'}},
      initialProps: {isDirectHit: false, conversations: [CONVERSATION]},
    });

    expect(router.location.pathname).toBe('/conversations-list/');
  });

  it('does not redirect when more than one conversation is returned', () => {
    const {router} = renderHookWithProviders(useConversationDirectHitRedirect, {
      organization,
      initialRouterConfig: {location: {pathname: '/conversations-list/'}},
      initialProps: {
        isDirectHit: true,
        conversations: [CONVERSATION, {...CONVERSATION, conversationId: 'conv-2'}],
      },
    });

    expect(router.location.pathname).toBe('/conversations-list/');
  });
});
