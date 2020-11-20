import React from 'react';
import groupBy from 'lodash/groupBy';

import AlertLink from 'app/components/alertLink';
import AsyncComponent from 'app/components/asyncComponent';
import {tct} from 'app/locale';
import {Integration, IntegrationProvider, Repository} from 'app/types';
import AddIntegration from 'app/views/organizationIntegrations/addIntegration';

type Props = {
  orgId: string;
  providers: IntegrationProvider[];
  onInstall: (integration: Integration) => void;
} & AsyncComponent['props'];

type State = {
  unmigratableRepos: Repository[];
} & AsyncComponent['state'];

export default class MigrationWarnings extends AsyncComponent<Props, State> {
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {orgId} = this.props;

    return [['unmigratableRepos', `/organizations/${orgId}/repos/?status=unmigratable`]];
  }

  get unmigratableReposByOrg() {
    // Group by [GitHub|BitBucket|VSTS] Org name
    return groupBy(this.state.unmigratableRepos, repo => repo.name.split('/')[0]);
  }

  render() {
    return Object.entries(this.unmigratableReposByOrg).map(
      ([orgName, repos]: [string, Repository[]]) => {
        // Repos use 'visualstudio', Integrations use 'vsts'. Normalize to 'vsts'.
        const key =
          repos[0].provider.id === 'visualstudio' ? 'vsts' : repos[0].provider.id;
        const provider = this.props.providers.find(p => p.key === key);

        // The Org might not have access to this Integration yet.
        if (!provider) {
          return '';
        }

        return (
          <AddIntegration
            key={provider.key}
            provider={provider}
            onInstall={this.props.onInstall}
          >
            {onClick => (
              <AlertLink href="" onClick={() => onClick()}>
                {tct(
                  "Your [orgName] repositories can't send commit data to Sentry. Add a [orgName] [providerName] instance here.",
                  {
                    orgName,
                    providerName: provider.name,
                  }
                )}
              </AlertLink>
            )}
          </AddIntegration>
        );
      }
    );
  }
}
