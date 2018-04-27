import React from 'react';

import createReactClass from 'create-react-class';

import OrganizationHomeSidebar from 'app/components/organizations/homeSidebar';
import OrganizationState from 'app/mixins/organizationState';
import ProjectSelector from 'app/components/projectHeader/projectSelector';
import Tooltip from 'app/components/tooltip';
import {t} from 'app/locale';

import Button from 'app/components/buttons/button';

const HomeContainer = createReactClass({
  displayName: 'HomeContainer',

  mixins: [OrganizationState],

  render() {
    let org = this.getOrganization();
    let access = this.getAccess();

    return (
      <div className={`${this.props.className || ''} organization-home`}>
        <div className="sub-header flex flex-container flex-vertically-centered">
          <div>
            <ProjectSelector organization={org} />
          </div>
          <div className="align-right hidden-xs">
            {access.has('project:write') ? (
              <Button
                to={`/organizations/${org.slug}/projects/new/`}
                priority="primary"
                style={{marginRight: 5}}
              >
                {t('New Project')}
              </Button>
            ) : (
              <Tooltip
                title={t('You do not have enough permission to create new projects')}
                tooltipOptions={{placement: 'bottom'}}
              >
                <Button
                  priority="primary"
                  disabled
                  data-placement="bottom"
                  style={{marginRight: 5}}
                >
                  {t('New Project')}
                </Button>
              </Tooltip>
            )}
            {access.has('team:write') ? (
              <Button to={`/organizations/${org.slug}/teams/new/`} priority="primary">
                {t('New Team')}
              </Button>
            ) : (
              <Tooltip
                title={t('You do not have enough permission to create new teams')}
                tooltipOptions={{placement: 'bottom'}}
              >
                <Button priority="primary" disabled>
                  {t('New Team')}
                </Button>
              </Tooltip>
            )}
          </div>
        </div>
        <div className="container">
          <div className="content row">
            <div className="col-md-2 org-sidebar">
              <OrganizationHomeSidebar />
            </div>
            <div className="col-md-10">{this.props.children}</div>
          </div>
        </div>
      </div>
    );
  },
});

export default HomeContainer;
