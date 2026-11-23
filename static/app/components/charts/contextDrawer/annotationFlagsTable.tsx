import {useQuery} from '@tanstack/react-query';
import {parseAsString, useQueryState} from 'nuqs';

import {EmptyState} from '@sentry/scraps/emptyState';

import {
  FeatureFlagsLogTable,
  type ColumnKey,
} from 'sentry/components/featureFlags/featureFlagsLogTable';
import {organizationFlagLogOptions} from 'sentry/components/featureFlags/hooks/useOrganizationFlagLog';
import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import type {GridColumnOrder} from 'sentry/components/tables/dataGrid';
import {t} from 'sentry/locale';
import {selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

const COLUMNS: Array<GridColumnOrder<ColumnKey>> = [
  {key: 'flag', name: t('Feature Flag')},
  {key: 'action', name: t('Action')},
  {key: 'createdAt', name: t('Date')},
];

interface AnnotationFlagsTableProps {
  cursorKeyName: string;
}

export function AnnotationFlagsTable({cursorKeyName}: AnnotationFlagsTableProps) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const [cursor] = useQueryState(cursorKeyName, parseAsString);
  const {data, isPending, error} = useQuery({
    ...organizationFlagLogOptions({
      organization,
      query: {
        ...normalizeDateTimeParams(selection.datetime),
        cursor: cursor ?? undefined,
        sort: '-created_at',
        per_page: 15,
        queryReferrer: 'chartContextDrawer',
      },
    }),
    select: selectJsonWithHeaders,
  });

  return (
    <FeatureFlagsLogTable
      columns={COLUMNS}
      flags={data?.json.data ?? []}
      isPending={isPending}
      error={error}
      pageLinks={data?.headers.Link ?? null}
      cursorKeyName={cursorKeyName}
      emptyMessage={
        <EmptyState
          title={t('No flag changes')}
          description={t('There are no flag changes within this timeframe.')}
        />
      }
    />
  );
}
