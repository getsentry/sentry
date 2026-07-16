import {useEffect, useRef} from 'react';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {Conversation} from 'sentry/views/explore/conversations/hooks/useConversations';
import {getConversationDetailUrl} from 'sentry/views/explore/conversations/utils/urlParams';

interface UseConversationDirectHitRedirectOptions {
  conversations: Conversation[];
  isDirectHit: boolean;
}

/**
 * Redirects to the conversation detail view when a conversation-ID search
 * resolves to a single direct hit, instead of showing a one-row list.
 */
export function useConversationDirectHitRedirect({
  conversations,
  isDirectHit,
}: UseConversationDirectHitRedirectOptions) {
  const organization = useOrganization();
  const navigate = useNavigate();
  const {selection} = usePageFilters();
  const hasRedirectedRef = useRef(false);

  useEffect(() => {
    const conversation = conversations[0];
    if (
      isDirectHit &&
      conversations.length === 1 &&
      conversation &&
      !hasRedirectedRef.current
    ) {
      hasRedirectedRef.current = true;
      navigate(
        getConversationDetailUrl(organization.slug, conversation, selection.projects),
        {replace: true}
      );
    }
  }, [isDirectHit, conversations, navigate, organization.slug, selection.projects]);
}
