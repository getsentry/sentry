import styled from '@emotion/styled';
import moment from 'moment-timezone';
import {PlatformIcon} from 'platformicons';

import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Link} from 'sentry/components/core/link';
import {IconProject} from 'sentry/icons';
import {space} from 'sentry/styles/space';

import ResultGrid from 'admin/components/resultGrid';

type Props = {
  orgId: string;
};

function CustomerProjects({orgId}: Props) {
  return (
    <ResultGrid
      inPanel
      panelTitle="Projects"
      path={`/_admin/customers/${orgId}/`}
      endpoint={`/organizations/${orgId}/projects/?statsPeriod=30d`}
      method="GET"
      defaultParams={{per_page: 10}}
      hasSearch
      columns={[
        <th key="name">Project</th>,
        <th key="status" style={{width: 150, textAlign: 'center'}}>
          Status
        </th>,
        <th key="events" style={{width: 120, textAlign: 'center'}}>
          Events (30d)
        </th>,
        <th key="created" style={{width: 150, textAlign: 'right'}}>
          Created
        </th>,
      ]}
      columnsForRow={(row: any) => [
        <td key="name">
          <ProjectName>
            <PlatformIcon size={16} platform={row.platform ?? 'other'} />
            <LinkButton
              external
              priority="link"
              href={`/${orgId}/${row.slug}/`}
              icon={<IconProject size="xs" />}
              title="View in Sentry"
              aria-label={'View in Sentry'}
            />
            <Link to={`/_admin/customers/${orgId}/projects/${row.slug}/`}>
              {row.slug}
            </Link>
          </ProjectName>
        </td>,
        <td key="status" style={{textAlign: 'center'}}>
          {row.status}
        </td>,
        <td key="events" style={{textAlign: 'center'}}>
          {row.stats.reduce((a: number, b: any) => a + b[1], 0).toLocaleString()}
        </td>,
        <td key="created" style={{textAlign: 'right'}}>
          {moment(row.dateCreated).fromNow()}
        </td>,
      ]}
    />
  );
}

const ProjectName = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
`;

export default CustomerProjects;
