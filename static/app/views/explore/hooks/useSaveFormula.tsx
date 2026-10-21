import {useMutation} from '@tanstack/react-query';

import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  useInvalidateSavedFormulas,
  type FormulaDataset,
  type FormulaParam,
  type FormulaReference,
  type SavedFormula,
} from 'sentry/views/explore/hooks/useGetSavedFormulas';

export type SavedFormulaRequest = {
  dataset: FormulaDataset;
  description: string | null;
  formula: string;
  name: string;
  params: FormulaParam[];
  references: FormulaReference[];
  unit: string | null;
};

export function useSaveFormula() {
  const organization = useOrganization();
  const invalidateSavedFormulas = useInvalidateSavedFormulas();

  const {mutateAsync: saveFormula, isPending: isSaving} = useMutation({
    mutationFn: ({id, ...formula}: SavedFormulaRequest & {id?: string}) =>
      fetchMutation<SavedFormula>({
        url: id
          ? getApiUrl('/organizations/$organizationIdOrSlug/explore/formulas/$id/', {
              path: {organizationIdOrSlug: organization.slug, id},
            })
          : getApiUrl('/organizations/$organizationIdOrSlug/explore/formulas/', {
              path: {organizationIdOrSlug: organization.slug},
            }),
        method: id ? 'PUT' : 'POST',
        data: formula,
      }),
    onSuccess: formula => invalidateSavedFormulas(formula.id),
  });

  return {saveFormula, isSaving};
}
