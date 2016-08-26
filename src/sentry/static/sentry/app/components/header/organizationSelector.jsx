import React from 'react';

import MenuItem from '../menuItem';
import DropdownLink from '../dropdownLink';
import SidebarPanel from '../sidebarPanel';
import AppState from '../../mixins/appState';
import OrganizationStore from '../../stores/organizationStore';
import ConfigStore from '../../stores/configStore';
import {Link} from 'react-router';
import {t} from '../../locale';

const OrganizationSelector = React.createClass({
  propTypes: {
    organization: React.PropTypes.object,
    showPanel: React.PropTypes.bool,
    currentPanel: React.PropTypes.string
  },

  mixins: [
    AppState,
  ],
  //
  // shouldComponentUpdate(nextProps, nextState) {
  //   console.log(nextProps, nextState);
  //   return (nextProps.organization || {}).id !== (this.props.organization || {}).id;
  // },

  render() {
    let singleOrganization = ConfigStore.get('singleOrganization');
    let activeOrg = this.props.organization;


    // if (singleOrganization || !activeOrg) {
    //   return null;
    // }

    let features = ConfigStore.get('features');

    let classNames = "org-selector divider-bottom";
    if(this.props.currentPanel == 'org-selector') {
      classNames += " active";
    }

    return (
      <div className={classNames}
        onMouseEnter={this.props.onShowPanel}
        onMouseLeave={this.props.hidePanel}>

        <a className="active-org" href="/">
          <img src="https://pbs.twimg.com/profile_images/497432038492733440/eW6tXeq3_400x400.png" />
        </a>

        {this.props.showPanel && this.props.currentPanel == 'org-selector' &&
          <SidebarPanel
            title={t('Organizations')}
            hidePanel={this.props.hidePanel}>
            <ul class="org-list">
              <li>
              {OrganizationStore.getAll().map((org) => {
                return (
                  <Link className={activeOrg.id === org.id && "active"} key={org.slug} to={`/${org.slug}/`}>
                    {org.name}
                  </Link>
                );
              })}
              </li>
              {features.has('organizations:create') &&
                <li><a href="/organizations/new/">{t('New Organization')}</a></li>
              }
            </ul>
          </SidebarPanel>
        }
      </div>
    );
  }
});

export default OrganizationSelector;
