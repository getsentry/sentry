import {RouteComponentProps} from 'react-router';

import Link from 'sentry/components/links/link';
import ResultGrid from 'sentry/components/resultGrid';
import {t} from 'sentry/locale';

type Props = RouteComponentProps<{}, {}>;

const getRow = (row: any) => [
  <td key={row.id}>
    <strong>
      <Link to={`/${row.slug}/`}>{row.name}</Link>
    </strong>
    <br />
    <small>{row.slug}</small>
  </td>,
];

function AdminOrganizations(props: Props) {
  return (
    <div>
      <h3>{t('Organizations')}</h3>
      <ResultGrid
        path="/manage/organizations/"
        endpoint="/organizations/?show=all"
        method="GET"
        columns={[<th key="column-org">Organization</th>]}
        columnsForRow={getRow}
        hasSearch
        sortOptions={[
          ['date', 'Date Joined'],
          ['members', 'Members'],
          ['events', 'Events'],
          ['projects', 'Projects'],
          ['employees', 'Employees'],
        ]}
        defaultSort="date"
        {...props}
      />
    </div>
  );
}

export default AdminOrganizations;
