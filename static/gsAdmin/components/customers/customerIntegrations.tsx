import {Flex} from '@sentry/scraps/layout';

import {ExternalLink} from 'sentry/components/core/link';
import {PluginIcon} from 'sentry/plugins/components/pluginIcon';

import ResultGrid from 'admin/components/resultGrid';

type Props = Partial<React.ComponentProps<typeof ResultGrid>> & {
  orgId: string;
};

function CustomerIntegrations({orgId, ...props}: Props) {
  return (
    <ResultGrid
      path={`/_admin/customers/${orgId}/`}
      endpoint={`/internal-stats/${orgId}/integrations/`}
      method="GET"
      defaultParams={{per_page: 10}}
      useQueryString={false}
      keyForRow={row => row.integration}
      columns={[
        <th key="name">Project</th>,
        <th key="integration" style={{width: 250}}>
          Plugin
        </th>,
      ]}
      columnsForRow={(row: any) => [
        <td key="name">
          <ExternalLink href={`/organizations/${orgId}/${row.project}/`}>
            {row.project}
          </ExternalLink>
        </td>,
        <td key="integration">
          <Flex align="center" gap="md">
            <PluginIcon size={16} pluginId={row.integration} />
            {row.integration}
          </Flex>
        </td>,
      ]}
      {...props}
    />
  );
}

export default CustomerIntegrations;
