import PropTypes from 'prop-types';
import React from 'react';
import {map} from 'lodash';

import {tct} from 'app/locale';
import AddIntegration from 'app/views/organizationIntegrations/addIntegration';
import AlertLink from 'app/components/alertLink';

export default class MigrationWarnings extends React.Component {
  static propTypes = {
    unmigratableRepos: PropTypes.object.isRequired,
    providers: PropTypes.array.isRequired,
    onInstall: PropTypes.func.isRequired,
  };

  render() {
    return map(this.props.unmigratableRepos, (repos, orgName) => {
      // Repos use 'visualstudio', Integrations use 'vsts'. Normalize to 'vsts'.
      const key = repos[0].provider.id == 'visualstudio' ? 'vsts' : repos[0].provider.id;

      const provider = this.props.providers.find(p => p.key === key);

      return (
        <AddIntegration
          key={provider.key}
          provider={provider}
          onInstall={this.props.onInstall}
        >
          {onClick => (
            <AlertLink onClick={onClick} href="#">
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
    });
  }
}
