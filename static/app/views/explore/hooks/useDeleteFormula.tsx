import {useMutation} from '@tanstack/react-query';

import {apiFetch} from 'sentry/utils/api/apiFetch';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useInvalidateSavedFormulas} from 'sentry/views/explore/hooks/useGetSavedFormulas';

export function useDeleteFormula() {
  const organization = useOrganization();
  const invalidateSavedFormulas = useInvalidateSavedFormulas();

  const {mutateAsync: deleteFormula} = useMutation({
    mutationFn: (id: string) =>
      apiFetch({
        queryKey: [
          getApiUrl('/organizations/$organizationIdOrSlug/explore/formulas/$id/', {
            path: {organizationIdOrSlug: organization.slug, id},
          }),
          {method: 'DELETE'},
        ],
      }),
    onSuccess: invalidateSavedFormulas,
  });

  return {deleteFormula};
}
