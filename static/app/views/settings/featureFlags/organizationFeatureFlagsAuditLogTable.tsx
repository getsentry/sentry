import {Fragment, useCallback, useMemo, useState} from 'react';

import Tag from 'sentry/components/badge/tag';
import {Button} from 'sentry/components/button';
import {Flex} from 'sentry/components/container/flex';
import GridEditable, {type GridColumnOrder} from 'sentry/components/gridEditable';
import Pagination from 'sentry/components/pagination';
import useQueryBasedColumnResize from 'sentry/components/replays/useQueryBasedColumnResize';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {FIELD_FORMATTERS} from 'sentry/utils/discover/fieldRenderers';
import {decodeScalar} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import type {RawFlag} from 'sentry/views/issueDetails/streamline/featureFlagUtils';
import {useOrganizationFlagLog} from 'sentry/views/issueDetails/streamline/hooks/useOrganizationFlagLog';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

type ColumnKey = 'provider' | 'flag' | 'action' | 'createdAt';

const BASE_COLUMNS: Array<GridColumnOrder<ColumnKey>> = [
  {key: 'provider', name: t('Provider')},
  {key: 'flag', name: t('Feature Flag'), width: 600},
  {key: 'action', name: t('Action')},
  {key: 'createdAt', name: t('Created')},
];

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

  const [activeRowKey, setActiveRowKey] = useState<number | undefined>(undefined);
  const [hasFilters, setHasFilters] = useState<boolean>(false);

  const clearQuery = useCallback(() => {
    const {width} = location.query;
    navigate({
      pathname: location.pathname,
      query: width ? {width} : {},
    });
    setHasFilters(false);
  }, [navigate, location.pathname, location.query]);

  const onFlagClick = useCallback(
    (flag: string) => {
      const {cursor: _, ...queryParams} = location.query; // persist the current query but reset cursor.
      navigate({
        pathname: location.pathname,
        query: {
          ...queryParams,
          flag,
        },
      });
      setHasFilters(true);
    },
    [navigate, location.pathname, location.query]
  );

  const onProviderClick = useCallback(
    (provider: string | null | undefined) => {
      const {cursor: _, ...queryParams} = location.query; // persist the current query but reset cursor.
      navigate({
        pathname: location.pathname,
        query: {
          ...queryParams,
          provider: provider || 'unknown',
        },
      });
      setHasFilters(true);
    },
    [navigate, location.pathname, location.query]
  );

  const renderBodyCell = (
    column: GridColumnOrder<ColumnKey>,
    dataRow: RawFlag,
    _rowIndex: number,
    _columnIndex: number
  ) => {
    switch (column.key) {
      case 'flag':
        return (
          <Tooltip title={t('Click to filter by this flag')}>
            <code
              onClick={() => {
                onFlagClick(dataRow.flag);
              }}
              style={{cursor: 'pointer'}}
            >
              {dataRow.flag}
            </code>
          </Tooltip>
        );
      case 'provider':
        return (
          <Tooltip title={t('Click to filter by this provider')}>
            <div
              onClick={() => {
                onProviderClick(dataRow.provider);
              }}
              style={{cursor: 'pointer'}}
            >
              {dataRow.provider || t('unknown')}
            </div>
          </Tooltip>
        );
      case 'createdAt':
        return FIELD_FORMATTERS.date.renderFunc('createdAt', dataRow);
      case 'action': {
        const type =
          dataRow.action === 'created'
            ? 'info'
            : dataRow.action === 'deleted'
              ? 'error'
              : undefined;
        const capitalized =
          dataRow.action.charAt(0).toUpperCase() + dataRow.action.slice(1);
        return <Tag type={type}>{capitalized}</Tag>;
      }
      default:
        return dataRow[column.key!];
    }
  };

  const {columns, handleResizeColumn} = useQueryBasedColumnResize({
    columns: BASE_COLUMNS,
    location,
  });

  return (
    <Fragment>
      <Flex justify="space-between">
        <h5>{t('Audit Logs')}</h5>
        {hasFilters && <Button onClick={clearQuery}>{t('View All')}</Button>}
      </Flex>
      <TextBlock>
        {t(
          'Verify your webhook integration(s) by checking the audit logs below for recent changes to your feature flags.'
        )}
      </TextBlock>
      <GridEditable
        error={error}
        isLoading={isPending}
        data={responseData?.data ?? []}
        columnOrder={columns}
        columnSortBy={[]}
        grid={{
          renderBodyCell,
          onResizeColumn: handleResizeColumn,
        }}
        onRowMouseOver={(_dataRow, key) => {
          setActiveRowKey(key);
        }}
        onRowMouseOut={() => {
          setActiveRowKey(undefined);
        }}
        highlightedRowKey={activeRowKey}
        scrollable={false}
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
