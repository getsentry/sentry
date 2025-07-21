import moment from 'moment-timezone';

import {ExternalLink} from 'sentry/components/core/link';

import ResultGrid from 'admin/components/resultGrid';

const getRow = (row: any) => [
  <td key="name">
    <ExternalLink href={row.url}>
      {row.name} {' — '} {row.version}
    </ExternalLink>
  </td>,
  <td key="user" style={{textAlign: 'center'}}>
    {!!row.consent && (row.consent.userEmail || row.consent.userName)}
  </td>,
  <td key="when" style={{textAlign: 'right'}}>
    {!!row.consent && moment(row.consent.createdAt).fromNow()}
  </td>,
];

function CustomerPolicies({orgId}: any) {
  return (
    <ResultGrid
      inPanel
      panelTitle="Policies and Consent"
      path={`/_admin/customers/${orgId}/`}
      endpoint={`/customers/${orgId}/policies/`}
      method="GET"
      defaultParams={{per_page: 10}}
      useQueryString={false}
      columns={[
        <th key="name">Policy</th>,
        <th key="user" style={{width: 150, textAlign: 'center'}}>
          User
        </th>,
        <th key="when" style={{width: 150, textAlign: 'right'}}>
          When
        </th>,
      ]}
      keyForRow={row => row.slug}
      rowsFromData={data => Object.values(data)}
      columnsForRow={getRow}
    />
  );
}

export default CustomerPolicies;
