import type {Automation, NewAutomation} from 'sentry/types/workflowEngine/automations';
import {useApiQuery, useMutation, useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

const mockAutomations: Automation[] = [];

export interface UseAutomationsQueryOptions {
  query?: string;
  sort?: string;
}
export function useAutomationsQuery(_options: UseAutomationsQueryOptions = {}) {
  // const { slug } = useOrganization();
  const data = mockAutomations;
  return {data};

  // return useApiQuery<Automation[]>([`/organizations/${slug}/workflows/`], {
  //   staleTime: 0,
  //   retry: false,
  // })
}

export const makeAutomationQueryKey = (
  orgSlug: string,
  automationId = ''
): [url: string] => [`/organizations/${orgSlug}/workflows/${automationId}/`];

export function useCreateAutomation(automation: NewAutomation) {
  const org = useOrganization();

  return useApiQuery<Automation[]>(
    [...makeAutomationQueryKey(org.slug), {method: 'POST', data: automation}],
    {
      staleTime: 0,
      retry: false,
    }
  );
}

export function useAutomationQuery(automationId: string) {
  const org = useOrganization();

  return useApiQuery<Automation>([...makeAutomationQueryKey(org.slug, automationId)], {
    staleTime: 0,
    retry: false,
  });
}

export function useAutomationMutation(automation: Partial<Automation> & {id: string}) {
  const api = useApi({persistInFlight: true});
  const queryClient = useQueryClient();
  const org = useOrganization();
  const queryKey = makeAutomationQueryKey(org.slug, automation.id);
  return useMutation<Automation>({
    mutationFn: data =>
      api.requestPromise(queryKey[0], {
        method: 'PUT',
        data,
      }),
    onSuccess: _ => {
      queryClient.invalidateQueries({queryKey});
      // setApiQueryData<Project>(
      //   queryClient,
      //   makeDetailedProjectQueryKey({
      //     orgSlug: organization.slug,
      //     projectSlug: project.slug,
      //   }),
      //   existingData => (updatedProject ? updatedProject : existingData)
      // );
      // return onSuccess?.(updatedProject);
    },
    onError: _ => {},
  });
}
