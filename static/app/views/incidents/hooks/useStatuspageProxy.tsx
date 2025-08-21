import {fetchMutation, useMutation} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import {useCreateIncidentComponent} from 'sentry/views/incidents/hooks/useCreateIncidentComponent';

export interface StatuspageComponent {
  description: string;
  id: string;
  name: string;
  page_id: string;
}

export function useStatuspageProxy({organizationSlug}: {organizationSlug: string}) {
  const {createMutation} = useCreateIncidentComponent({organizationSlug});
  const listComponents = useMutation<
    StatuspageComponent[],
    RequestError,
    {page_id: string}
  >({
    mutationFn: ({page_id}) =>
      fetchMutation({
        url: `/organizations/${organizationSlug}/integrations/statuspage/direct-api/`,
        method: 'POST',
        data: {action: 'list_components', page_id},
      }),
    onSuccess: (data: StatuspageComponent[]) => {
      data.forEach(component => {
        createMutation.mutate({
          name: component.name,
          description: component.description,
          status_page_component_id: component.id,
        });
      });
    },
  });

  const createComponent = useMutation<
    StatuspageComponent,
    RequestError,
    {description: string; name: string; page_id: string}
  >({
    mutationFn: ({name, description, page_id}) =>
      fetchMutation({
        url: `/organizations/${organizationSlug}/integrations/statuspage/direct-api/`,
        method: 'POST',
        data: {action: 'create_component', page_id, name, description},
      }),
    onSuccess: (data: StatuspageComponent) => {
      createMutation.mutate({name: data.name, description: data.description});
    },
  });
  return {listComponents, createComponent};
}
