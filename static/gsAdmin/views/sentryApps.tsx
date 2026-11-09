import {SentryAppAvatar} from '@sentry/scraps/avatar';
import {Tag} from '@sentry/scraps/badge';
import {Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';

import {ResultGrid} from 'sentry/components/resultGrid';
import {SimpleTable} from 'sentry/components/tables/simpleTable';

import {PageHeader} from 'admin/components/pageHeader';

const getRow = (row: any) => [
  <SimpleTable.RowCell key="name">
    <Flex align="center" gap="md">
      <SentryAppAvatar size={16} sentryApp={row} />
      <strong>
        <Link to={`/_admin/sentry-apps/${row.slug}/`}>{row.name}</Link>
      </strong>
    </Flex>
  </SimpleTable.RowCell>,

  <SimpleTable.RowCell key="owner" justify="center">
    <strong>
      <Link to={`/_admin/customers/${row.owner.slug}/`}>{row.owner.slug}</Link>
    </strong>
  </SimpleTable.RowCell>,
  <SimpleTable.RowCell key="status" justify="end">
    <Tag
      variant={
        row.status === 'unpublished'
          ? 'danger'
          : row.status === 'internal'
            ? 'warning'
            : 'success'
      }
    >
      {row.status}
    </Tag>
  </SimpleTable.RowCell>,
];

export function SentryApps() {
  return (
    <div>
      <PageHeader title="Integration Platform Apps" />

      <ResultGrid
        inPanel
        path="/_admin/sentry-apps/"
        endpoint="/sentry-apps/"
        columns={[
          {key: 'name', label: 'Name'},
          {key: 'owner', label: 'Owner', width: 200, align: 'center'},
          {key: 'status', label: 'Status', width: 150, align: 'right'},
        ]}
        columnsForRow={getRow}
      />
    </div>
  );
}
