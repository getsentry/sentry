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
        provider: log.provider ?? 'unknown',
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

  const renderBodyCell = (
    column: GridColumnOrder<'provider' | 'flag' | 'action' | 'createdAt'>,
    dataRow: RawFlag,
    _rowIndex: number,
    _columnIndex: number
  ) =>
    column.key !== 'flag' ? (
      dataRow[column.key!]
    ) : (
      <code
        onClick={() => {
          onFlagClick(dataRow.flag);
        }}
        style={{cursor: 'pointer'}}
      >
        {dataRow.flag}
      </code>
    );

  return (
    <Fragment>
      <Flex justify="space-between">
        <h5>{t('Audit Logs')}</h5>
        {hasFilters && <Button onClick={resetFilters}>{t('View All')}</Button>}
      </Flex>
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
