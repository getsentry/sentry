import React from 'react';
import createReactClass from 'create-react-class';

import {t} from 'app/locale';
import Button from 'app/components/buttons/button';
import OrganizationState from 'app/mixins/organizationState';
import ProjectSelector from 'app/components/projectHeader/projectSelector';
import Tooltip from 'app/components/tooltip';

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
          </div>
        </div>
        <div className="container">{this.props.children}</div>
      </div>
    );
  },
});

export default HomeContainer;
