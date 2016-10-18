import React from 'react';
import OrganizationHomeSidebar from './homeSidebar';
import OrganizationState from '../../mixins/organizationState';
import ProjectSelector from '../projectHeader/projectSelector';
import TooltipMixin from '../../mixins/tooltip';
import {t} from '../../locale';

const HomeContainer = React.createClass({
  mixins: [
    OrganizationState,
    TooltipMixin({
      selector: '.tip'
    })
  ],

  render() {
    let org = this.getOrganization();
    let access = this.getAccess();

    return (
      <div className="organization-home">
        <div className="sub-header flex flex-container flex-vertically-centered">
          <div>
            <ProjectSelector
                organization={org} />
          </div>
          <div className="align-right hidden-xs">
            {access.has('project:write') ?
              <a href={`/organizations/${org.slug}/projects/new/`} className="btn btn-primary"
                 style={{marginRight: 5}}>
                {t('New Project')}
              </a>
            :
              <a className="btn btn-primary btn-disabled tip" data-placement="bottom"
                 title={t('You do not have enough permission to create new projects')}
                 style={{marginRight: 5}}>
                {t('New Project')}
              </a>
            }
            {access.has('team:write') ?
              <a href={`/organizations/${org.slug}/teams/new/`} className="btn btn-primary">
                {t('New Team')}
              </a>
            :
              <a className="btn btn-primary btn-disabled tip" data-placement="bottom"
                 title={t('You do not have enough permission to create new teams')}>
                {t('New Team')}
              </a>
            }
          </div>
        </div>
        <div className="container">
          <div className="content row">
            <div className="col-md-2 org-sidebar">
              <OrganizationHomeSidebar />
            </div>
            <div className="col-md-10">
              {this.props.children}
            </div>
          </div>
        </div>
      </div>
    );
  }
});

export default HomeContainer;
