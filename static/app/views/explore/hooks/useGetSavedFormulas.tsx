import {useCallback} from 'react';
import {keepPreviousData, useQuery, useQueryClient} from '@tanstack/react-query';

import type {Organization} from 'sentry/types/organization';
import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

const FORMULAS_PER_PAGE = 25;

export type FormulaDataset = 'spans' | 'logs' | 'metrics';

export type FormulaParamType = 'column' | 'number' | 'calculation';

type FormulaType = 'duration' | 'size' | 'number';

export type FormulaParam = {
  name: string;
  order: number;
  type: FormulaParamType;
  value: string;
};

export type FormulaReference = {
  name: string;
  value: string;
};

export type SavedFormula = {
  dataset: FormulaDataset;
  description: string | null;
  formula: string;
  id: string;
  /** Prefixed with `formula.` so it cannot collide with a built in function. */
  name: string;
  params: FormulaParam[];
  /** True for the formulas Sentry ships, which cannot be edited. */
  prebuilt: boolean;
  references: FormulaReference[];
  type: FormulaType;
  unit: string | null;
};

function savedFormulasApiOptions(
  organization: Organization,
  query?: Record<string, unknown>
) {
  return apiOptions.as<SavedFormula[]>()(
    '/organizations/$organizationIdOrSlug/explore/formulas/',
    {
      path: {organizationIdOrSlug: organization.slug},
      query,
      staleTime: 0,
    }
  );
}

export function useGetSavedFormulas({cursor}: {cursor?: string}) {
  const organization = useOrganization();

  const {data, isPending, isError, refetch} = useQuery({
    ...savedFormulasApiOptions(organization, {cursor, per_page: FORMULAS_PER_PAGE}),
    select: selectJsonWithHeaders,
    placeholderData: keepPreviousData,
  });

  return {
    formulas: data?.json,
    pageLinks: data?.headers.Link,
    isPending,
    isError,
    refetch,
  };
}

function savedFormulaApiOptions(organization: Organization, id: string) {
  return apiOptions.as<SavedFormula>()(
    '/organizations/$organizationIdOrSlug/explore/formulas/$id/',
    {
      path: {organizationIdOrSlug: organization.slug, id},
      staleTime: 0,
    }
  );
}

export function useGetSavedFormula(id: string) {
  const organization = useOrganization();

  return useQuery(savedFormulaApiOptions(organization, id));
}

export function useInvalidateSavedFormulas() {
  const organization = useOrganization();
  const queryClient = useQueryClient();

  return useCallback(
    (id?: string) => {
      queryClient.invalidateQueries({
        queryKey: savedFormulasApiOptions(organization).queryKey,
      });
      if (id) {
        queryClient.invalidateQueries({
          queryKey: savedFormulaApiOptions(organization, id).queryKey,
        });
      }
    },
    [queryClient, organization]
  );
}
