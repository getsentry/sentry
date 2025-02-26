import {Fragment, useCallback, useMemo, useState} from 'react';

import {Button} from 'sentry/components/button';
import {Flex} from 'sentry/components/container/flex';
import GridEditable, {type GridColumnOrder} from 'sentry/components/gridEditable';
import Pagination from 'sentry/components/pagination';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {decodeScalar} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import type {RawFlag} from 'sentry/views/issueDetails/streamline/featureFlagUtils';
import {useOrganizationFlagLog} from 'sentry/views/issueDetails/streamline/hooks/useOrganizationFlagLog';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

export function OrganizationFeatureFlagsAuditLogTable({
  pageSize = 15,
}: {
  pageSize?: number;
}) {
  const organization = useOrganization();
  const navigate = useNavigate();
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
    data: responseData,
    isPending,
    error,
    getResponseHeader,
  } = useOrganizationFlagLog({
    organization,
    query,
  });
  const pageLinks = getResponseHeader?.('Link') ?? null;

  const data: RawFlag[] = useMemo(() => {
    return (
      responseData?.data?.map(log => ({
        ...log,
        provider: log.provider,
        createdAt: new Date(log.createdAt).toLocaleString(),
      })) ?? []
    );
  }, [responseData]);

  const [activeRowKey, setActiveRowKey] = useState<number | undefined>(undefined);
  const [hasFilters, setHasFilters] = useState<boolean>(false);

  const resetFilters = useCallback(() => {
    navigate({
      pathname: location.pathname,
    });
    setHasFilters(false);
  }, [navigate, location.pathname]);

  const onFlagClick = useCallback(
    (flag: string) => {
      navigate({
        pathname: location.pathname,
        query: {
          flag,
        },
      });
      setHasFilters(true);
    },
    [navigate, location.pathname, setHasFilters]
  );

  const onProviderClick = useCallback(
    (provider: string | null | undefined) => {
      navigate({
        pathname: location.pathname,
        query: {
          provider: provider ? provider : 'unknown',
        },
      });
      setHasFilters(true);
    },
    [navigate, location.pathname, setHasFilters]
  );

  const renderBodyCell = (
    column: GridColumnOrder<'provider' | 'flag' | 'action' | 'createdAt'>,
    dataRow: RawFlag,
    _rowIndex: number,
    _columnIndex: number
  ) =>
    column.key === 'flag' ? (
      <code
        onClick={() => {
          onFlagClick(dataRow.flag);
        }}
        style={{cursor: 'pointer'}}
      >
        {dataRow.flag}
      </code>
    ) : column.key === 'provider' ? (
      <div
        onClick={() => {
          onProviderClick(dataRow.provider);
        }}
        style={{cursor: 'pointer'}}
      >
        {dataRow.provider ? dataRow.provider : t('unknown')}
      </div>
    ) : (
      dataRow[column.key!]
    );

  return (
    <Fragment>
      <Flex justify="space-between">
        <h5>{t('Audit Logs')}</h5>
        {hasFilters && <Button onClick={resetFilters}>{t('View All')}</Button>}
      </Flex>
      <TextBlock>
        {t(
          'Verify your webhook integration(s) by checking the audit logs below for recent changes to your feature flags. Clicking a flag or provider will filter results by that flag or provider.'
        )}
      </TextBlock>
      <GridEditable
        error={error}
        isLoading={isPending}
        data={data}
        columnOrder={[
          {key: 'provider', name: t('Provider')},
          {key: 'flag', name: t('Feature Flag'), width: 600},
          {key: 'action', name: t('Action')},
          {key: 'createdAt', name: t('Created')},
        ]}
        columnSortBy={[]}
        scrollable={false}
        onRowMouseOver={(_dataRow, key) => {
          setActiveRowKey(key);
        }}
        onRowMouseOut={() => {
          setActiveRowKey(undefined);
        }}
        highlightedRowKey={activeRowKey}
        grid={{renderBodyCell}}
      />

      <Pagination
        pageLinks={pageLinks}
        onCursor={(cursor, path, searchQuery) => {
          trackAnalytics('flags.logs-paginated', {
            direction: cursor?.endsWith(':1') ? 'prev' : 'next',
            organization,
            surface: 'settings',
          });
          navigate({
            pathname: path,
            query: {...searchQuery, cursor},
          });
        }}
      />
    </Fragment>
  );
}

export default OrganizationFeatureFlagsAuditLogTable;
