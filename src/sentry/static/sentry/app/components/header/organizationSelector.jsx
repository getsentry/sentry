import React from 'react';

import MenuItem from '../menuItem';
import DropdownLink from '../dropdownLink';
import AppState from '../../mixins/appState';
import OrganizationStore from '../../stores/organizationStore';
import ConfigStore from '../../stores/configStore';
import {t} from '../../locale';

const OrganizationSelector = React.createClass({
  propTypes: {
    organization: React.PropTypes.object
  },

  mixins: [
    AppState,
  ],

  shouldComponentUpdate(nextProps, nextState) {
    return (nextProps.organization || {}).id !== (this.props.organization || {}).id;
  },

  render() {
    let singleOrganization = ConfigStore.get('singleOrganization');
    let activeOrg = this.props.organization;

    if (singleOrganization || !activeOrg) {
      return null;
    }

    let urlPrefix = ConfigStore.get('urlPrefix');
    let features = ConfigStore.get('features');

    return (
      <DropdownLink
          menuClasses="dropdown-menu-right"
          topLevelClasses={(this.props.className || '') + ' org-selector'}
          title={activeOrg.name}>
        {OrganizationStore.getAll().map((org) => {
          return (
            <MenuItem key={org.slug} to={`/${org.slug}/`}
                      isActive={activeOrg.id === org.id}>
              {org.name}
            </MenuItem>
          );
        })}
        {features.has('organizations:create') && OrganizationStore.getAll().length && 
          <MenuItem divider={true} />
        }
        {features.has('organizations:create') &&
          <MenuItem href={urlPrefix + '/organizations/new/'}>{t('New Organization')}</MenuItem>
        }
      </DropdownLink>
    );
  }
});

export default OrganizationSelector;
