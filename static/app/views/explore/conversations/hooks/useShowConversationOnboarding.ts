import {useEffect, useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';

import {ALL_ACCESS_PROJECTS} from 'sentry/components/pageFilters/constants';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useOrganization} from 'sentry/utils/useOrganization';
import {Referrer} from 'sentry/views/explore/conversations/utils/referrers';
import {useHasAgentSpans} from 'sentry/views/insights/pages/agents/hooks/useHasAgentSpans';
import {agentSpanDataOptions} from 'sentry/views/insights/pages/agents/queries/agentSpanDataOptions';

/**
 * Whether the current project selection represents "all projects" (-1 or empty).
 */
function isAllProjectsSelection(projects: number[]): boolean {
  return projects.length === 0 || projects[0] === ALL_ACCESS_PROJECTS;
}

export function useShowConversationOnboarding(): {
  hasAgenticSpans: boolean;
  hasConversations: boolean;
  isError: boolean;
  isLoading: boolean;
  refetch: () => void;
  showOnboarding: boolean;
} {
  const {selection, isReady} = usePageFilters();
  const organization = useOrganization();

  // Store the raw selection values — either specific IDs like [1, 5]
  // or [-1] for "all projects". We intentionally do NOT expand "all projects"
  // into individual IDs to avoid incorrectly marking every project as having data.
  const rawSelectedProjectIds = useMemo(
    () =>
      isAllProjectsSelection(selection.projects)
        ? [ALL_ACCESS_PROJECTS]
        : selection.projects,
    [selection.projects]
  );

  const [projectsWithConversations, setProjectsWithConversations] = useLocalStorageState<
    number[]
  >(`conversations:projects-with-data:${organization.slug}`, []);

  const request = useQuery({
    ...agentSpanDataOptions({
      organizationSlug: organization.slug,
      selection,
      query: 'has:gen_ai.conversation.id',
      referrer: Referrer.ONBOARDING,
    }),
    enabled: isReady,
    retry: false,
  });

  const hasData = (request.data?.data.length ?? 0) > 0;

  useEffect(() => {
    if (hasData) {
      setProjectsWithConversations(prev => {
        const combined = new Set([...prev, ...rawSelectedProjectIds]);
        if (combined.size === prev.length) {
          return prev;
        }
        return Array.from(combined);
      });
    }
  }, [hasData, rawSelectedProjectIds, setProjectsWithConversations]);

  const selectedProjectsHaveKnownConversations = isAllProjectsSelection(
    rawSelectedProjectIds
  )
    ? projectsWithConversations.length > 0
    : rawSelectedProjectIds.some(id => projectsWithConversations.includes(id));
  const hasConversations = hasData || selectedProjectsHaveKnownConversations;

  const agentSpans = useHasAgentSpans({hasKnownData: hasConversations});
  const isLoading =
    !hasConversations && (!isReady || request.isPending || agentSpans.isLoading);
  const isError = !hasConversations && (request.isError || agentSpans.isError);

  return {
    hasAgenticSpans: agentSpans.hasAgenticSpans,
    hasConversations,
    showOnboarding: !isLoading && !isError && !hasConversations,
    isLoading,
    isError,
    refetch: () => {
      void request.refetch();
      void agentSpans.refetch();
    },
  };
}
