import {useEffect, useMemo} from 'react';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {getSelectedProjectList} from 'sentry/utils/project/useSelectedProjectsHaveField';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {Referrer} from 'sentry/views/insights/pages/agents/utils/referrers';

export function useShowConversationOnboarding(): {
  isLoading: boolean;
  refetch: () => void;
  showOnboarding: boolean;
} {
  const {selection} = usePageFilters();
  const {projects} = useProjects();
  const organization = useOrganization();

  const selectedProjectIds = useMemo(
    () => getSelectedProjectList(selection.projects, projects).map(p => Number(p.id)),
    [selection.projects, projects]
  );

  const [projectsWithConversations, setProjectsWithConversations] = useLocalStorageState<
    number[]
  >(`conversations-onboarding-projects-with-data:${organization.slug}`, []);

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
        const combined = new Set([...prev, ...selectedProjectIds]);
        if (combined.size === prev.length) {
          return prev;
        }
        return Array.from(combined);
      });
    }
  }, [hasData, selectedProjectIds, setProjectsWithConversations]);

  const selectedProjectsHaveKnownConversations = selectedProjectIds.some(id =>
    projectsWithConversations.includes(id)
  );

  return {
    showOnboarding:
      !request.isLoading &&
      !request.data?.length &&
      !selectedProjectsHaveKnownConversations,
    isLoading: selectedProjectsHaveKnownConversations ? false : request.isLoading,
    refetch: request.refetch,
  };
}
