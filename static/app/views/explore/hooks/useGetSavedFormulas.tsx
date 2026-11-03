import {useCallback, useEffect, useMemo} from 'react';
import * as Sentry from '@sentry/react';
import {keepPreviousData, useQuery, useQueryClient} from '@tanstack/react-query';

import type {Organization} from 'sentry/types/organization';
import type {User} from 'sentry/types/user';
import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {parseLinkHeader} from 'sentry/utils/parseLinkHeader';
import {useOrganization} from 'sentry/utils/useOrganization';

const FORMULAS_PER_PAGE = 25;
const MAX_FORMULAS_PER_PAGE = 100;
const EMPTY_FORMULAS: SavedFormula[] = [];

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
  /** Null for prebuilt formulas, which are created by Sentry. */
  createdBy: User | null;
  dataset: FormulaDataset;
  description: string | null;
  formula: string;
  id: string;
  /** Prefixed with `formula.` so it cannot collide with a built in function. */
  name: string;
  params: FormulaParam[];
  /** True for the formulas Sentry ships. */
  prebuilt: boolean;
  references: FormulaReference[];
  type: FormulaType;
  unit: string | null;
  updatedBy: User | null;
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

export function useGetSavedFormulas({
  cursor,
  sortBy,
}: {
  cursor?: string;
  sortBy?: string;
}) {
  const organization = useOrganization();

  const {data, isPending, isError, refetch} = useQuery({
    ...savedFormulasApiOptions(organization, {
      cursor,
      sortBy,
      per_page: FORMULAS_PER_PAGE,
    }),
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

export function useDatasetFormulas(dataset: FormulaDataset) {
  const organization = useOrganization();

  const {data} = useQuery({
    ...savedFormulasApiOptions(organization, {per_page: MAX_FORMULAS_PER_PAGE}),
    enabled: organization.features.includes('explore-saved-formulas'),
    select: selectJsonWithHeaders,
  });

  const hasNextPage = Boolean(parseLinkHeader(data?.headers.Link ?? null).next?.results);
  useEffect(() => {
    if (hasNextPage) {
      Sentry.logger.error('Saved formulas exceeded the max page size', {
        organizationId: organization.id,
        dataset,
        maxPerPage: MAX_FORMULAS_PER_PAGE,
      });
    }
  }, [hasNextPage, organization.id, dataset]);

  return useMemo(
    () => data?.json.filter(formula => formula.dataset === dataset) ?? EMPTY_FORMULAS,
    [data, dataset]
  );
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
