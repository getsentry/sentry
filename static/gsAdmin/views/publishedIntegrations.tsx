import {SentryAppAvatar} from '@sentry/scraps/avatar';
import {Tag} from '@sentry/scraps/badge';
import {Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';

import {PageHeader} from 'admin/components/pageHeader';
import {ResultGrid} from 'admin/components/resultGrid';

type SentryAppRow = {
  id: number;
  installs: number;
  name: string;
  slug: string;
  status: string;
  uninstalls: number;
  uuid: string;
  avatars?: any[];
  owner?: {id: number; slug: string} | null;
};

const STATUS_VARIANT: Record<string, 'danger' | 'warning' | 'success'> = {
  unpublished: 'danger',
  internal: 'warning',
  publish_request_inprogress: 'warning',
};

function getRow(row: SentryAppRow) {
  return [
    <td key="name">
      <Flex align="center" gap="md">
        <SentryAppAvatar size={16} sentryApp={row} />
        <strong>
          <Link to={`/_admin/sentry-apps/${row.slug}/`}>{row.name}</Link>
        </strong>
      </Flex>
    </td>,

    <td key="owner" style={{textAlign: 'center'}}>
      {row.owner ? (
        <Link to={`/_admin/customers/${row.owner.slug}/`}>{row.owner.slug}</Link>
      ) : (
        '—'
      )}
    </td>,

    <td key="status" style={{textAlign: 'center'}}>
      <Tag variant={STATUS_VARIANT[row.status] ?? 'success'}>{row.status}</Tag>
    </td>,

    <td key="installs" style={{textAlign: 'right'}}>
      {row.installs.toLocaleString()}
    </td>,

    <td key="uninstalls" style={{textAlign: 'right'}}>
      {row.uninstalls.toLocaleString()}
    </td>,
  ];
}

export function PublishedIntegrations() {
  return (
    <div>
      <PageHeader title="Published Integrations" />

      <ResultGrid
        inPanel
        path="/_admin/published-integrations/"
        endpoint="/sentry-apps-stats/"
        method="GET"
        defaultParams={{status: 'published', per_page: 50}}
        columns={[
          <th key="name">Name</th>,
          <th key="owner" style={{width: 180, textAlign: 'center'}}>
            Owner
          </th>,
          <th key="status" style={{width: 160, textAlign: 'center'}}>
            Status
          </th>,
          <th key="installs" style={{width: 120, textAlign: 'right'}}>
            Installs
          </th>,
          <th key="uninstalls" style={{width: 120, textAlign: 'right'}}>
            Uninstalls
          </th>,
        ]}
        columnsForRow={getRow}
        hasSearch={false}
        sortOptions={[
          ['installs', 'Total Installs'],
          ['uninstalls', 'Total Uninstalls'],
        ]}
        defaultSort="installs"
        filters={{
          period: {
            name: 'Period',
            options: [
              ['all', 'All Time'],
              ['7d', 'Last 7 Days'],
              ['30d', 'Last 30 Days'],
              ['90d', 'Last 90 Days'],
            ],
          },
        }}
      />
    </div>
  );
}
