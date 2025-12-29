import {useMemo} from 'react';

import {Alert} from 'sentry/components/core/alert';
import type {ColumnKey} from 'sentry/components/featureFlags/featureFlagsLogTable';
import {FeatureFlagsLogTable} from 'sentry/components/featureFlags/featureFlagsLogTable';
import {useFlagsInEventPaginated} from 'sentry/components/featureFlags/hooks/useFlagsInEvent';
import type {RawFlag} from 'sentry/components/featureFlags/utils';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import Placeholder from 'sentry/components/placeholder';
import type {GridColumnOrder} from 'sentry/components/tables/gridEditable';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import {decodeScalar} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {ReleasesDrawerFields} from 'sentry/views/releases/drawer/utils';

const BASE_COLUMNS: Array<GridColumnOrder<ColumnKey>> = [
  {key: 'provider', name: t('Provider')},
  {key: 'flag', name: t('Feature Flag'), width: 390},
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
      queryReferrer: 'releasesDrawer',
    };
  }, [locationQuery, datetime]);

  const {flags, isPending, error, pageLinks} = useFlagsInEventPaginated({
    eventId,
    groupId,
    query,
    enabled: Boolean(eventId && groupId),
  });

  if (isPending) {
    return <Placeholder />;
  }

  if (error) {
    return (
      <Alert type="danger" showIcon={false}>
        {t('Error fetching feature flags')}
      </Alert>
    );
  }

  // If there are no flags, don't render anything
  // TOOD: Add a CTA
  if (flags.length === 0) {
    return null;
  }

  return (
    <FeatureFlagsLogTable
      columns={BASE_COLUMNS}
      flags={flags}
      isPending={false}
      error={null}
      pageLinks={pageLinks}
      cursorKeyName={ReleasesDrawerFields.FLAGS_CURSOR}
      onRowMouseOver={onRowMouseOver}
      onRowMouseOut={onRowMouseOut}
      scrollable
    />
  );
}
