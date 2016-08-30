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

  getInitial(orgName) {
    // TODO: Generate proper letter avatar

    let initial = orgName.charAt(0);
    return initial.toUpperCase();
  },

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
            <ul className="org-list list-unstyled">
              {OrganizationStore.getAll().map((org) => {
                return (
                  <li className={activeOrg.id === org.id ? "org active" : "org"} key={org.slug}>
                    <Link className="org-avatar" to={`/${org.slug}/`}>
                      {this.getInitial(org.name)}
                    </Link>
                    <h5><Link to={`/${org.slug}/`}>{org.name}</Link></h5>
                    <p>
                      <a href={`/organizations/${org.slug}/settings/`}>
                        <span className="icon-settings"/> {t("Settings")}
                      </a>
                      <a href={`/organizations/${org.slug}/members/`}>
                        <span className="icon-users"/> {t("Members")}
                      </a>
                    </p>
                  </li>
                );
              })}

              {features.has('organizations:create') &&
                <li className="org-create">
                  <a href="/organizations/new/" className="btn btn-default btn-block">{t('New Organization')}</a>
                </li>
              }
            </ul>
          </SidebarPanel>
        }
      </div>
    );
  }
});

export default OrganizationSelector;
