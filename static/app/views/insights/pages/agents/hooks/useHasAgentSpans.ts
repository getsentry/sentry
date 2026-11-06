import {useQuery} from '@tanstack/react-query';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useHasFirstSpan} from 'sentry/views/insights/common/queries/useHasFirstSpan';
import {agentSpanDataOptions} from 'sentry/views/insights/pages/agents/queries/agentSpanDataOptions';
import {getHasAiSpansFilter} from 'sentry/views/insights/pages/agents/utils/query';
import {Referrer} from 'sentry/views/insights/pages/agents/utils/referrers';
import {ModuleName} from 'sentry/views/insights/types';

export function useHasAgentSpans({hasKnownData = false}: {hasKnownData?: boolean} = {}) {
  const organization = useOrganization();
  const {selection, isReady} = usePageFilters();
  const hasProjectFlag = useHasFirstSpan(ModuleName.AGENT_MODELS);
  const hasData = hasKnownData || hasProjectFlag;
  const request = useQuery({
    ...agentSpanDataOptions({
      organizationSlug: organization.slug,
      selection,
      query: `(${getHasAiSpansFilter()} OR has:gen_ai.conversation.id)`,
      referrer: Referrer.ONBOARDING,
    }),
    enabled: isReady && !hasData,
    retry: false,
  });

  return {
    hasAgenticSpans: hasData || (request.data?.data.length ?? 0) > 0,
    isLoading: !hasData && (!isReady || request.isPending),
    isError: !hasData && request.isError,
    refetch: request.refetch,
  };
}
