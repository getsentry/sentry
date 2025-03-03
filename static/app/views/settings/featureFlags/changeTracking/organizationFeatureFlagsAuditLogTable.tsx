import {Fragment, useMemo, useState} from 'react';

import {Tag} from 'sentry/components/core/badge/tag';
import GridEditable, {type GridColumnOrder} from 'sentry/components/gridEditable';
import Pagination from 'sentry/components/pagination';
import useQueryBasedColumnResize from 'sentry/components/replays/useQueryBasedColumnResize';
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

  const renderBodyCell = (
    column: GridColumnOrder<ColumnKey>,
    dataRow: RawFlag,
    _rowIndex: number,
    _columnIndex: number
  ) => {
    switch (column.key) {
      case 'flag':
        return <code>{dataRow.flag}</code>;
      case 'provider':
        return dataRow.provider || t('unknown');
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
        return (
          <div style={{alignSelf: 'flex-start'}}>
            <Tag type={type}>{capitalized}</Tag>
          </div>
        );
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
      <h5>{t('Audit Logs')}</h5>
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
        data-test-id="audit-log-table"
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
