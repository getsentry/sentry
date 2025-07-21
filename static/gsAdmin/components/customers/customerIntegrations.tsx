import styled from '@emotion/styled';

import {ExternalLink} from 'sentry/components/core/link';
import {PluginIcon} from 'sentry/plugins/components/pluginIcon';
import {space} from 'sentry/styles/space';

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
          <IntegrationName>
            <PluginIcon size={16} pluginId={row.integration} />
            {row.integration}
          </IntegrationName>
        </td>,
      ]}
      {...props}
    />
  );
}

const IntegrationName = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

export default CustomerIntegrations;
