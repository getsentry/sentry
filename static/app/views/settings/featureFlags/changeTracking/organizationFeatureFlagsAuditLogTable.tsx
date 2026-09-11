import {Fragment, useCallback, useMemo, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {createParser, parseAsString, useQueryStates} from 'nuqs';

import type {ColumnKey} from 'sentry/components/featureFlags/featureFlagsLogTable';
import {FeatureFlagsLogTable} from 'sentry/components/featureFlags/featureFlagsLogTable';
import {organizationFlagLogOptions} from 'sentry/components/featureFlags/hooks/useOrganizationFlagLog';
import type {RawFlag} from 'sentry/components/featureFlags/utils';
import type {GridColumnOrder} from 'sentry/components/tables/gridEditable';
import {useQueryBasedColumnResize} from 'sentry/components/tables/gridEditable/useQueryBasedColumnResize';
import {t} from 'sentry/locale';
import {selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import {TextBlock} from 'sentry/views/settings/components/text/textBlock';

const BASE_COLUMNS: Array<GridColumnOrder<ColumnKey>> = [
  {key: 'provider', name: t('Provider')},
  {key: 'flag', name: t('Feature Flag'), width: 600},
  {key: 'action', name: t('Action')},
  {key: 'createdAt', name: t('Date')},
];

// The default has to cover a blank `?sort=` as well as an absent key, which is
// what the previous `decodeScalar(value, '-created_at')` did. A plain
// `withDefault` only fills in an absent key, leaving `''` to be stripped below.
const parseAsSortKey = createParser({
  parse: (value: string) => value || null,
  serialize: (value: string) => value,
}).withDefault('-created_at');

const auditLogParsers = {
  cursor: parseAsString.withDefault(''),
  end: parseAsString.withDefault(''),
  flag: parseAsString.withDefault(''),
  sort: parseAsSortKey,
  start: parseAsString.withDefault(''),
  statsPeriod: parseAsString.withDefault(''),
  utc: parseAsString.withDefault(''),
};

export function OrganizationFeatureFlagsAuditLogTable() {
  const organization = useOrganization();
  const [locationQuery] = useQueryStates(auditLogParsers);

  const query = useMemo(() => {
    const filteredFields = Object.fromEntries(
      Object.entries(locationQuery).filter(([_key, val]) => val !== '')
    );
    return {
      ...filteredFields,
      per_page: 15,
      queryReferrer: 'featureFlagsSettings',
    };
  }, [locationQuery]);

  const {data, isPending, error} = useQuery({
    ...organizationFlagLogOptions({
      organization,
      query,
    }),
    select: selectJsonWithHeaders,
  });
  const flags = data?.json;
  const pageLinks = data?.headers.Link ?? null;

  const [activeRowKey, setActiveRowKey] = useState<number | undefined>();

  const {columns, handleResizeColumn} = useQueryBasedColumnResize({
    columns: BASE_COLUMNS,
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
