import moment from 'moment-timezone';

import {ExternalLink} from '@sentry/scraps/link';

import {ResultGrid} from 'sentry/components/resultGrid';
import {SimpleTable} from 'sentry/components/tables/simpleTable';

const getRow = (row: any) => [
  <SimpleTable.RowCell key="name">
    <ExternalLink href={row.url}>
      {row.name} {' — '} {row.version}
    </ExternalLink>
  </SimpleTable.RowCell>,
  <SimpleTable.RowCell key="user" justify="center">
    {!!row.consent && (row.consent.userEmail || row.consent.userName)}
  </SimpleTable.RowCell>,
  <SimpleTable.RowCell key="when" justify="end">
    {!!row.consent && moment(row.consent.createdAt).fromNow()}
  </SimpleTable.RowCell>,
];

export function CustomerPolicies({orgId}: any) {
  return (
    <ResultGrid
      inPanel
      panelTitle="Policies and Consent"
      path={`/_admin/customers/${orgId}/`}
      endpoint={`/customers/${orgId}/policies/`}
      defaultParams={{per_page: 10}}
      useQueryString={false}
      columns={[
        {key: 'name', label: 'Policy'},
        {key: 'user', label: 'User', width: 150, align: 'center'},
        {key: 'when', label: 'When', width: 150, align: 'right'},
      ]}
      keyForRow={row => row.slug}
      rowsFromData={data => Object.values(data)}
      columnsForRow={getRow}
    />
  );
}
