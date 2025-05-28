import {useMemo} from 'react';

import type {ColumnKey} from 'sentry/components/featureFlags/featureFlagsLogTable';
import {FeatureFlagsLogTable} from 'sentry/components/featureFlags/featureFlagsLogTable';
import type {RawFlag} from 'sentry/components/featureFlags/utils';
import type {GridColumnOrder} from 'sentry/components/gridEditable';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import {decodeScalar} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {ReleasesDrawerFields} from 'sentry/views/releases/drawer/utils';
import {useDrawerFlags} from 'sentry/views/releases/utils/useDrawerFlags';

const BASE_COLUMNS: Array<GridColumnOrder<ColumnKey>> = [
  {key: 'provider', name: t('Provider')},
  {key: 'flag', name: t('Feature Flag'), width: 600},
  {key: 'action', name: t('Action')},
  {key: 'createdAt', name: t('Date')},
];

interface Props {
  eventId: string;
  groupId: string;
  pageFilters: PageFilters;
  onRowMouseOut?: (dataRow: RawFlag, key: number) => void;
  onRowMouseOver?: (dataRow: RawFlag, key: number) => void;
}

export function ReleasesDrawerFeatureFlagsTable({
  pageFilters,
  eventId,
  groupId,
  onRowMouseOver,
  onRowMouseOut,
}: Props) {
  const datetime = normalizeDateTimeParams(pageFilters.datetime);
  const locationQuery = useLocationQuery({
    fields: {
      [ReleasesDrawerFields.FLAGS_CURSOR]: decodeScalar,
    },
  });
  const query = useMemo(() => {
    return {
      ...datetime,
      cursor: locationQuery[ReleasesDrawerFields.FLAGS_CURSOR],
      per_page: 10,
      queryReferrer: 'featureFlagsSettings',
    };
  }, [locationQuery, datetime]);

  const {flags, isPending, error, pageLinks} = useDrawerFlags({
    eventId,
    groupId,
    query,
    enabled: Boolean(eventId && groupId),
  });

  return (
    <FeatureFlagsLogTable
      columns={BASE_COLUMNS}
      flags={flags}
      isPending={isPending}
      error={error}
      pageLinks={pageLinks}
      cursorKeyName={ReleasesDrawerFields.FLAGS_CURSOR}
      onRowMouseOver={onRowMouseOver}
      onRowMouseOut={onRowMouseOut}
    />
  );
}
