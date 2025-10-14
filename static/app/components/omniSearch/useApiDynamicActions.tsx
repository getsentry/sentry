import {useCallback, useEffect, useMemo, useState} from 'react';
import {useNavigate} from 'react-router-dom';

import MemberBadge from 'sentry/components/idBadge/memberBadge';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {TeamBadge} from 'sentry/components/idBadge/teamBadge';
import {
  createDocIntegrationResults,
  createMemberResults,
  createProjectResults,
  createTeamResults,
  queryResults,
} from 'sentry/components/search/sources/apiSource';
import type {ResultItem} from 'sentry/components/search/sources/types';
import {IconDocs} from 'sentry/icons';
import {t} from 'sentry/locale';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

import type {OmniAction} from './types';

function createOmniAction(result: ResultItem, index: number): OmniAction {
  switch (result.sourceType) {
    case 'project':
      return {
        key: `project-${result.model?.id}-${index}`,
        areaKey: 'global',
        label: result.title as string,
        details: (result.description || result.model?.description) ?? '',
        section: t('Projects'),
        actionIcon: <ProjectBadge project={result.model} avatarSize={16} hideName />,
      };
    case 'team':
      return {
        key: `team-${result.model?.id}-${index}`,
        areaKey: 'global',
        label: result.title as string,
        details: (result.description || result.model?.description) ?? '',
        section: t('Teams'),
        actionIcon: <TeamBadge team={result.model} avatarSize={16} hideName />,
      };
    case 'member':
      return {
        key: `member-${result.model?.id}-${index}`,
        areaKey: 'global',
        label: result.title as string,
        details: (result.description || result.model?.description) ?? '',
        section: t('Members'),
        actionIcon: (
          <MemberBadge member={result.model} avatarSize={16} hideName hideEmail />
        ),
      };
    case 'docIntegration':
      return {
        key: `doc-integration-${result.model?.id}-${index}`,
        areaKey: 'global',
        label: result.title as string,
        details: (result.description || result.model?.description) ?? '',
        section: t('Doc Integrations'),
        actionIcon: <IconDocs />,
      };
    default:
      return {
        key: `api-${result.resultType}-${index}`,
        areaKey: 'global',
        label: result.title as string,
        details: (result.description || result.model?.description) ?? '',
        section: t('Documentation'),
        actionIcon: <IconDocs />,
      };
  }
}

/**
 * Hook that fetches API results and converts them to dynamic actions
 * for the OmniSearch palette.
 *
 * @param query - The search query string (should be debounced)
 * @returns Array of dynamic actions based on API results
 */
export function useApiDynamicActions(query: string): OmniAction[] {
  const api = useApi();
  const organization = useOrganization({allowNull: true});
  const navigate = useNavigate();
  const [results, setResults] = useState<ResultItem[]>([]);

  // TODO: Use useApiQueries instead
  const handleSearch = useCallback(async () => {
    const pendingResults: Array<Promise<ResultItem[] | null>> = [];

    if (organization) {
      const org = organization;
      const slug = organization.slug;

      const q = (url: string) => queryResults(api, url, query, 5);

      const searchQueries = [
        createProjectResults(q(`/organizations/${slug}/projects/`), org),
        createTeamResults(q(`/organizations/${slug}/teams/`), org),
        createMemberResults(q(`/organizations/${slug}/members/`), org),
        createDocIntegrationResults(q('/doc-integrations/'), org),
      ];
      pendingResults.push(...searchQueries);
    }

    const resolvedResults = await Promise.all(pendingResults);
    setResults(resolvedResults.flat().filter(i => i !== null));
  }, [api, query, organization]);

  useEffect(() => {
    void handleSearch();
  }, [handleSearch]);

  const dynamicActions = useMemo(() => {
    const actions: OmniAction[] = [];
    if (query) {
      results.forEach((result, index) => {
        actions.push({
          ...createOmniAction(result, index),
          onAction: () => {
            if (result.to) {
              navigate(result.to);
            }
          },
        });
      });
    }

    return actions;
  }, [navigate, query, results]);

  return dynamicActions;
}
