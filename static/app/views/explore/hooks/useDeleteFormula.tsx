import {useMutation} from '@tanstack/react-query';

import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useInvalidateSavedFormulas} from 'sentry/views/explore/hooks/useGetSavedFormulas';

export function useDeleteFormula() {
  const organization = useOrganization();
  const invalidateSavedFormulas = useInvalidateSavedFormulas();

  const {mutateAsync: deleteFormula} = useMutation({
    mutationFn: (id: string) =>
      fetchMutation({
        url: getApiUrl('/organizations/$organizationIdOrSlug/explore/formulas/$id/', {
          path: {organizationIdOrSlug: organization.slug, id},
        }),
        method: 'DELETE',
      }),
    onSuccess: invalidateSavedFormulas,
  });

  return {deleteFormula};
}
