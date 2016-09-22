import React from 'react';
import {Link} from 'react-router';

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
    onShowPanel: React.PropTypes.func,
    hidePanel: React.PropTypes.func,
    currentPanel: React.PropTypes.string
  },

  contextTypes: {
    location: React.PropTypes.object
  },

  mixins: [
    AppState,
  ],

  getLinkNode(org, child, className) {
    let url = `/${org.slug}/`;
    if (!this.context.location) {
      return <a className={className} href={url}>{child}</a>;
    }
    return <Link className={className} to={`/${org.slug}/`}>{child}</Link>;
  },

  render() {
    // TODO: what to do in single org state?
    // let isSingleOrg = ConfigStore.get('singleOrganization');
    let activeOrg = this.props.organization;

    // if (isSingleOrg || !activeOrg) {
    //   return null;
    // }

    let features = ConfigStore.get('features');

    let classNames = 'org-selector divider-bottom';
    if(this.props.currentPanel == 'org-selector') {
      classNames += ' active';
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
                    {this.getLinkNode(org, <LetterAvatar displayName={org.name} identifier={org.slug}/>, 'org-avatar')}
                    <h5>{this.getLinkNode(org, org.name)}</h5>
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
