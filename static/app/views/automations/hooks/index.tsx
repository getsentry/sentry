import type {ActionHandler} from 'sentry/types/workflowEngine/actions';
import type {Automation} from 'sentry/types/workflowEngine/automations';
import type {
  DataConditionHandler,
  DataConditionHandlerGroupType,
} from 'sentry/types/workflowEngine/dataConditions';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {useApiQueries, useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

const makeAutomationsQueryKey = ({
  orgSlug,
  query,
  sort,
  ids,
  limit,
  cursor,
  projects,
}: {
  orgSlug: string;
  cursor?: string;
  ids?: string[];
  limit?: number;
  projects?: number[];
  query?: string;
  sort?: string;
}): ApiQueryKey => [
  `/organizations/${orgSlug}/workflows/`,
  {query: {query, sort, id: ids, per_page: limit, cursor, project: projects}},
];

const makeAutomationQueryKey = (orgSlug: string, automationId: string): ApiQueryKey => [
  `/organizations/${orgSlug}/workflows/${automationId}/`,
];

interface UseAutomationsQueryOptions {
  cursor?: string;
  ids?: string[];
  limit?: number;
  projects?: number[];
  query?: string;
  sort?: string;
}
export function useAutomationsQuery(options: UseAutomationsQueryOptions = {}) {
  const {slug: orgSlug} = useOrganization();

  return useApiQuery<Automation[]>(makeAutomationsQueryKey({orgSlug, ...options}), {
    staleTime: 0,
    retry: false,
  });
}

export function useAutomationQuery(automationId: string) {
  const {slug} = useOrganization();

  return useApiQuery<Automation>(makeAutomationQueryKey(slug, automationId), {
    staleTime: 0,
    retry: false,
  });
}

export function useDataConditionsQuery(groupType: DataConditionHandlerGroupType) {
  const {slug} = useOrganization();

  return useApiQuery<DataConditionHandler[]>(
    [`/organizations/${slug}/data-conditions/`, {query: {group: groupType}}],
    {
      staleTime: Infinity,
      retry: false,
    }
  );
}

export function useAvailableActionsQuery() {
  const {slug} = useOrganization();

  return useApiQuery<ActionHandler[]>([`/organizations/${slug}/available-actions/`], {
    staleTime: Infinity,
    retry: false,
  });
}

export function useDetectorQueriesByIds(automationIds: string[]) {
  const org = useOrganization();

  return useApiQueries<Automation>(
    automationIds.map(id => makeAutomationQueryKey(org.slug, id)),
    {
      staleTime: 0,
      retry: false,
    }
  );
}
