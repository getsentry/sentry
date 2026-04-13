import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {Referrer} from 'sentry/views/insights/pages/agents/utils/referrers';

export function useShowConversationOnboarding(): {
  isLoading: boolean;
  refetch: () => void;
  showOnboarding: boolean;
} {
  const {selection} = usePageFilters();

  const request = useSpans(
    {
      search: 'has:gen_ai.conversation.id',
      fields: ['id'],
      limit: 1,
      pageFilters: selection,
    },
    Referrer.CONVERSATIONS_ONBOARDING
  );

  return {
    showOnboarding: !request.isLoading && !request.data?.length,
    isLoading: request.isLoading,
    refetch: request.refetch,
  };
}
