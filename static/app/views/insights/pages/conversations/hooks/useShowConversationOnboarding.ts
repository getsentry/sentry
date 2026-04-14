import {useEffect, useMemo} from 'react';

import {ALL_ACCESS_PROJECTS} from 'sentry/components/pageFilters/constants';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {Referrer} from 'sentry/views/insights/pages/agents/utils/referrers';

/**
 * Whether the current project selection represents "all projects" (-1 or empty).
 */
function isAllProjectsSelection(projects: number[]): boolean {
  return projects.length === 0 || projects[0] === ALL_ACCESS_PROJECTS;
}

export function useShowConversationOnboarding(): {
  isLoading: boolean;
  refetch: () => void;
  showOnboarding: boolean;
} {
  const {selection} = usePageFilters();
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

  const request = useSpans(
    {
      search: 'has:gen_ai.conversation.id',
      fields: ['id'],
      limit: 1,
      pageFilters: selection,
    },
    Referrer.CONVERSATIONS_ONBOARDING
  );

  const hasData = !request.isLoading && (request.data?.length ?? 0) > 0;

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

  return {
    showOnboarding:
      !request.isLoading &&
      !request.data?.length &&
      !selectedProjectsHaveKnownConversations,
    isLoading: selectedProjectsHaveKnownConversations ? false : request.isLoading,
    refetch: request.refetch,
  };
}
