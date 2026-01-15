import {PlatformIcon} from 'platformicons';

import {Flex} from '@sentry/scraps/layout';

import {ExternalLink} from 'sentry/components/core/link';

import ResultGrid from 'admin/components/resultGrid';

type Props = Partial<React.ComponentProps<typeof ResultGrid>> & {
  orgId: string;
};

function CustomerPlatforms({orgId, ...props}: Props) {
  return (
    <ResultGrid
      path={`/_admin/customers/${orgId}/`}
      endpoint={`/internal-stats/${orgId}/platforms/`}
      method="GET"
      defaultParams={{per_page: 10}}
      useQueryString={false}
      columns={[
        <th key="name">Project</th>,
        <th key="platform" style={{width: 250}}>
          Platform
        </th>,
      ]}
      columnsForRow={(row: any) => [
        <td key="name">
          <ExternalLink href={`/organizations/${orgId}/${row.slug}/`}>
            {row.project}
          </ExternalLink>
        </td>,
        <td key="platform">
          <Flex align="center" gap="md">
            <PlatformIcon platform={row.platform} size={16} />
            {row.platform}
          </Flex>
        </td>,
      ]}
      {...props}
    />
  );
}

export default CustomerPlatforms;
