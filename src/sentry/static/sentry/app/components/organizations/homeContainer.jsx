import React from 'react';
import styled from 'styled-components';

import OrganizationHomeSidebar from './homeSidebar';
import OrganizationState from '../../mixins/organizationState';
import ProjectSelector from '../projectHeader/projectSelector';
import TooltipMixin from '../../mixins/tooltip';
import {t} from '../../locale';

import Button from '../button';

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
            <ProjectSelector organization={org} />
          </div>
          <div className="align-right hidden-xs">
            {access.has('project:write')
              ? <HomeContainerButton
                  href={`/organizations/${org.slug}/projects/new/`}
                  priority="primary">
                  {t('New Project')}
                </HomeContainerButton>
              : <HomeContainerButton
                  disabled
                  priority="primary"
                  className="tip"
                  data-placement="bottom"
                  title={t('You do not have enough permission to create new projects')}>
                  {t('New Project')}
                </HomeContainerButton>}
            {access.has('team:write')
              ? <HomeContainerButton
                  priority="primary"
                  href={`/organizations/${org.slug}/teams/new/`}>
                  {t('New Team')}
                </HomeContainerButton>
              : <HomeContainerButton
                  disabled
                  priority="primary"
                  className="tip"
                  data-placement="bottom"
                  title={t('You do not have enough permission to create new teams')}>
                  {t('New Team')}
                </HomeContainerButton>}
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

// Customize Button in this component

const HomeContainerButton = styled(Button)`
  padding-top: 10px;
  padding-bottom: 10px;
  margin-left: 5px;
`;

export default HomeContainer;
