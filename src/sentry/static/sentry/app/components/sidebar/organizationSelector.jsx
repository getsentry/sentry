import React from 'react';
import {Link} from 'react-router';

import MenuItem from '../menuItem';
import DropdownLink from '../dropdownLink';
import SidebarPanel from '../sidebarPanel';
import LetterAvatar from '../letterAvatar';

import AppState from '../../mixins/appState';
import OrganizationStore from '../../stores/organizationStore';
import ConfigStore from '../../stores/configStore';

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

    let hoverIntent;
    let hoverTime = 500;

    return (
      <div className={classNames}
        onMouseEnter={()=> {hoverIntent = setTimeout(this.props.onShowPanel, hoverTime);}}
        onMouseLeave={()=> {this.props.hidePanel(); clearTimeout(hoverIntent); }}>

        <div className="hover-bar-container">
          <div className="hover-bar"/>
        </div>

        <a className="active-org" href="/">
          <LetterAvatar displayName={activeOrg.name} identifier={activeOrg.slug}/>
        </a>

        {this.props.showPanel && this.props.currentPanel == 'org-selector' &&
          <SidebarPanel
            title={t('Organizations')}
            hidePanel={this.props.hidePanel}>
            <ul className="org-list list-unstyled">
              {OrganizationStore.getAll().map((org) => {
                return (
                  <li className={activeOrg.id === org.id ? 'org active' : 'org'} key={org.slug}>
                    <Link className="org-avatar" to={`/${org.slug}/`}>
                      <LetterAvatar displayName={org.name} identifier={org.slug}/>
                    </Link>
                    <h5><Link to={`/${org.slug}/`}>{org.name}</Link></h5>
                    <p>
                      <a href={`/organizations/${org.slug}/settings/`}>
                        <span className="icon-settings"/> {t('Settings')}
                      </a>
                      <a href={`/organizations/${org.slug}/members/`}>
                        <span className="icon-users"/> {t('Members')}
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
