import moment from 'moment-timezone';

import {Link} from '@sentry/scraps/link';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Text} from '@sentry/scraps/text';

import ResultGrid from 'admin/components/resultGrid';
import {StartupFlags} from 'admin/components/startups/startupFlags';
import {StartupStatusBadge} from 'admin/components/startups/startupStatusBadge';

interface StartupApplicationRow {
  contact_email: string;
  date_added: string;
  flag_company_age: boolean;
  flag_possible_duplicate: boolean;
  founders_name: string;
  founding_date_text: string;
  funding_details: string;
  id: number;
  org_slug: string;
  startup_name: string;
  startup_website: string;
  status: string;
  reviewer?: {
    email: string;
    name: string;
  };
}

const getRow = (row: StartupApplicationRow) => [
  <td key="name">
    <strong>
      <Link to={`/_admin/startups/${row.id}/`}>{row.startup_name}</Link>
    </strong>
  </td>,
  <td key="website">
    <a href={row.startup_website} target="_blank" rel="noopener noreferrer">
      <Text size="sm" truncate>
        {row.startup_website.replace(/^https?:\/\//, '')}
      </Text>
    </a>
  </td>,
  <td key="slug">
    <Link to={`/_admin/customers/${row.org_slug}/`}>{row.org_slug}</Link>
  </td>,
  <td key="date" style={{textAlign: 'center'}}>
    <Tooltip title={moment(row.date_added).format('MMMM D, YYYY h:mm A')}>
      <span>{moment(row.date_added).fromNow()}</span>
    </Tooltip>
  </td>,
  <td key="founded" style={{textAlign: 'center'}}>
    {row.founding_date_text}
  </td>,
  <td key="funding">
    <Text size="sm" truncate style={{maxWidth: 200}}>
      {row.funding_details}
    </Text>
  </td>,
  <td key="status" style={{textAlign: 'center'}}>
    <StartupStatusBadge status={row.status} />
  </td>,
  <td key="flags" style={{textAlign: 'center'}}>
    <StartupFlags
      flagPossibleDuplicate={row.flag_possible_duplicate}
      flagCompanyAge={row.flag_company_age}
    />
  </td>,
  <td key="reviewer" style={{textAlign: 'center'}}>
    {row.reviewer?.name ?? '-'}
  </td>,
];

export function StartupApplications() {
  return (
    <ResultGrid
      inPanel
      path="/_admin/startups/"
      endpoint="/_admin/startups/applications/"
      method="GET"
      columns={[
        <th key="name">Startup Name</th>,
        <th key="website" style={{width: 150}}>
          Website
        </th>,
        <th key="slug" style={{width: 120}}>
          Org Slug
        </th>,
        <th key="date" style={{width: 120, textAlign: 'center'}}>
          Applied
        </th>,
        <th key="founded" style={{width: 100, textAlign: 'center'}}>
          Founded
        </th>,
        <th key="funding" style={{width: 200}}>
          Funding
        </th>,
        <th key="status" style={{width: 100, textAlign: 'center'}}>
          Status
        </th>,
        <th key="flags" style={{width: 80, textAlign: 'center'}}>
          Flags
        </th>,
        <th key="reviewer" style={{width: 100, textAlign: 'center'}}>
          Reviewer
        </th>,
      ]}
      columnsForRow={getRow}
      hasSearch
      filters={{
        status: {
          name: 'Status',
          options: [
            ['pending', 'Pending'],
            ['needs_info', 'Needs Info'],
            ['accepted', 'Accepted'],
            ['rejected', 'Rejected'],
            ['duplicate', 'Duplicate'],
          ],
        },
        flagged: {
          name: 'Flagged',
          options: [
            ['1', 'Yes'],
            ['0', 'No'],
          ],
        },
      }}
      sortOptions={[
        ['date', 'Applied Date'],
        ['startup_name', 'Startup Name'],
        ['status', 'Status'],
      ]}
      defaultSort="date"
      title="Startup Program Applications"
    />
  );
}
