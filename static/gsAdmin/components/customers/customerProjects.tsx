import {IconProject} from '@sentry/icons/project';
import moment from 'moment-timezone';
import {PlatformIcon} from 'platformicons';

import {LinkButton} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';

import {ResultGrid} from 'sentry/components/resultGrid';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';

type Props = {
  orgId: string;
};

export function CustomerProjects({orgId}: Props) {
  return (
    <ResultGrid
      inPanel
      panelTitle="Projects"
      path={`/_admin/customers/${orgId}/`}
      endpoint={getApiUrl('/organizations/$organizationIdOrSlug/projects/', {
        path: {organizationIdOrSlug: orgId},
      })}
      defaultParams={{per_page: 10, statsPeriod: '30d'}}
      useQueryString={false}
      hasSearch
      columns={[
        {key: 'name', label: 'Project'},
        {key: 'status', label: 'Status', width: 150, align: 'center'},
        {key: 'events', label: 'Events (30d)', width: 120, align: 'center'},
        {key: 'created', label: 'Created', width: 150, align: 'right'},
      ]}
      columnsForRow={(row: any) => [
        <SimpleTable.RowCell key="name">
          <Flex align="center" gap="md">
            <PlatformIcon size={16} platform={row.platform ?? 'other'} />
            <LinkButton
              external
              variant="link"
              href={`/${orgId}/${row.slug}/`}
              icon={<IconProject size="xs" />}
              tooltipProps={{title: 'View in Sentry'}}
              aria-label="View in Sentry"
            />
            <Link to={`/_admin/customers/${orgId}/projects/${row.slug}/`}>
              {row.slug}
            </Link>
          </Flex>
        </SimpleTable.RowCell>,
        <SimpleTable.RowCell key="status" justify="center">
          {row.status}
        </SimpleTable.RowCell>,
        <SimpleTable.RowCell key="events" justify="center">
          {row.stats.reduce((a: number, b: any) => a + b[1], 0).toLocaleString()}
        </SimpleTable.RowCell>,
        <SimpleTable.RowCell key="created" justify="end">
          {moment(row.dateCreated).fromNow()}
        </SimpleTable.RowCell>,
      ]}
    />
  );
}
