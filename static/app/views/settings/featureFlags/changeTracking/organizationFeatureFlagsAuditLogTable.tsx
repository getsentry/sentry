import {Fragment, useCallback, useMemo, useState} from 'react';

import type {ColumnKey} from 'sentry/components/featureFlags/featureFlagsLogTable';
import {FeatureFlagsLogTable} from 'sentry/components/featureFlags/featureFlagsLogTable';
import {useOrganizationFlagLog} from 'sentry/components/featureFlags/hooks/useOrganizationFlagLog';
import type {RawFlag} from 'sentry/components/featureFlags/utils';
import type {GridColumnOrder} from 'sentry/components/tables/gridEditable';
import useQueryBasedColumnResize from 'sentry/components/tables/gridEditable/useQueryBasedColumnResize';
import {t} from 'sentry/locale';
import {decodeScalar} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

const BASE_COLUMNS: Array<GridColumnOrder<ColumnKey>> = [
  {key: 'provider', name: t('Provider')},
  {key: 'flag', name: t('Feature Flag'), width: 600},
  {key: 'action', name: t('Action')},
  {key: 'createdAt', name: t('Date')},
];

export function OrganizationFeatureFlagsAuditLogTable({
  pageSize = 15,
}: {
  pageSize?: number;
}) {
  const organization = useOrganization();
  const location = useLocation();
  const locationQuery = useLocationQuery({
    fields: {
      cursor: decodeScalar,
      end: decodeScalar,
      flag: decodeScalar,
      sort: (value: any) => decodeScalar(value, '-created_at'),
      start: decodeScalar,
      statsPeriod: decodeScalar,
      utc: decodeScalar,
    },
  });

  const query = useMemo(() => {
    const filteredFields = Object.fromEntries(
      Object.entries(locationQuery).filter(([_key, val]) => val !== '')
    );
    return {
      ...filteredFields,
      per_page: pageSize,
      queryReferrer: 'featureFlagsSettings',
    };
  }, [locationQuery, pageSize]);

  const {
    data: flags,
    isPending,
    error,
    getResponseHeader,
  } = useOrganizationFlagLog({
    organization,
    query,
  });
  const pageLinks = getResponseHeader?.('Link') ?? null;

  const [activeRowKey, setActiveRowKey] = useState<number | undefined>();

  const {columns, handleResizeColumn} = useQueryBasedColumnResize<ColumnKey>({
    columns: BASE_COLUMNS,
    location,
  });

  const handleMouseOver = useCallback((_dataRow: RawFlag, key: number) => {
    setActiveRowKey(key);
  }, []);
  const handleMouseOut = useCallback(() => {
    setActiveRowKey(undefined);
  }, []);

  return (
    <Fragment>
      <h5>{t('Audit Logs')}</h5>
      <TextBlock>
        {t(
          'Verify your webhook integration(s) by checking the audit logs below for recent changes to your feature flags.'
        )}
      </TextBlock>
      <FeatureFlagsLogTable
        columns={columns}
        flags={flags?.data ?? []}
        isPending={isPending}
        error={error}
        onRowMouseOver={handleMouseOver}
        onRowMouseOut={handleMouseOut}
        onResizeColumn={handleResizeColumn}
        highlightedRowKey={activeRowKey}
        pageLinks={pageLinks}
      />
    </Fragment>
  );
}
