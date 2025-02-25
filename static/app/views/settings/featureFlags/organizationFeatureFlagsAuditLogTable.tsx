import {Fragment, useMemo, useState} from 'react';

import GridEditable from 'sentry/components/gridEditable';
import Pagination from 'sentry/components/pagination';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useApiQuery} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';

const PAGE_SIZE = 20;

type AuditLog = {
  action: string;
  createdAt: string;
  flag: string;
  provider: string;
};

type AuditLogResponse = {
  data: AuditLog[];
};

export function OrganizationFeatureFlagsAuditLogTable() {
  const organization = useOrganization();
  const navigate = useNavigate();

  const _query = useLocationQuery({
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
      Object.entries(_query).filter(([_key, val]) => val !== '')
    );
    return {
      ...filteredFields,
      per_page: PAGE_SIZE,
      queryReferrer: 'featureFlagsSettings',
    };
  }, [_query]);

  const {
    data: responseData,
    isLoading,
    error,
    getResponseHeader,
  } = useApiQuery<AuditLogResponse>(
    [
      `/organizations/${organization.slug}/flags/logs/`,
      {
        query,
      },
    ],
    {
      refetchInterval: 10_000,
      staleTime: 0,
    }
  );
  const pageLinks = getResponseHeader?.('Link') ?? null;

  const data = useMemo(() => {
    return (
      responseData?.data?.map(log => ({
        ...log,
        provider: log.provider ?? 'unknown', // TODO: camel case?
        createdAt: new Date(log.createdAt).toLocaleString(),
      })) ?? []
    );
  }, [responseData]);

  const [activeRowKey, setActiveRowKey] = useState<number | undefined>(undefined);

  return (
    <Fragment>
      <GridEditable
        error={error}
        isLoading={isLoading}
        data={data}
        columnOrder={[
          {key: 'provider', name: t('Provider')},
          {key: 'flag', name: t('Feature Flag'), width: 600},
          {key: 'action', name: t('Action')},
          {key: 'createdAt', name: t('Created')},
        ]}
        columnSortBy={[]}
        grid={{}} // renderHeadCell, renderBodyCell
        onRowMouseOver={(_dataRow, key) => {
          setActiveRowKey(key);
        }}
        onRowMouseOut={() => {
          setActiveRowKey(undefined);
        }}
        highlightedRowKey={activeRowKey}
      />
      {/* TODO: filter by flag/provider on row click (needs to reset cursor) */}

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
