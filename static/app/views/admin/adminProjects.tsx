import {RouteComponentProps} from 'react-router';
import moment from 'moment';

import ResultGrid from 'sentry/components/resultGrid';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';

type Row = {
  dateCreated: string;
  name: string;
  organization: Organization;
  slug: string;
  status: string;
};

type Props = RouteComponentProps<{}, {}>;

const getRow = (row: Row) => [
  <td key="name">
    <strong>
      <a href={`/${row.organization.slug}/${row.slug}/`}>{row.name}</a>
    </strong>
    <br />
    <small>{row.organization.name}</small>
  </td>,
  <td key="status" style={{textAlign: 'center'}}>
    {row.status}
  </td>,
  <td key="dateCreated" style={{textAlign: 'right'}}>
    {moment(row.dateCreated).format('ll')}
  </td>,
];

function AdminProjects(props: Props) {
  const columns = [
    <th key="name">Project</th>,
    <th key="status" style={{width: 150, textAlign: 'center'}}>
      Status
    </th>,
    <th key="dateCreated" style={{width: 200, textAlign: 'right'}}>
      Created
    </th>,
  ];

  return (
    <div>
      <h3>{t('Projects')}</h3>
      <ResultGrid
        path="/manage/projects/"
        endpoint="/projects/?show=all"
        method="GET"
        columns={columns}
        columnsForRow={getRow}
        hasSearch
        filters={{
          status: {
            name: 'Status',
            options: [
              ['active', 'Active'],
              ['deleted', 'Deleted'],
            ],
          },
        }}
        sortOptions={[['date', 'Date Created']]}
        defaultSort="date"
        {...props}
      />
    </div>
  );
}

export default AdminProjects;
