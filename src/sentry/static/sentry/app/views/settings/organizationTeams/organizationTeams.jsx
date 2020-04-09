import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import {IconAdd} from 'app/icons/iconAdd';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import {openCreateTeamModal} from 'app/actionCreators/modal';
import {t} from 'app/locale';
import Button from 'app/components/button';
import Input from 'app/views/settings/components/forms/controls/input';
import LoadingIndicator from 'app/components/loadingIndicator';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import SentryTypes from 'app/sentryTypes';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import recreateRoute from 'app/utils/recreateRoute';

import AllTeamsList from './allTeamsList';

class OrganizationTeams extends React.Component {
  static propTypes = {
    otherTeams: PropTypes.arrayOf(SentryTypes.Team),
    activeTeams: PropTypes.arrayOf(SentryTypes.Team),
    hasMoreTeams: PropTypes.bool,
    organization: SentryTypes.Organization,
    access: PropTypes.object,
    features: PropTypes.object,
    routes: PropTypes.array,
    params: PropTypes.object,

    onSearch: PropTypes.func,
    onRequestAccess: PropTypes.func,
    onJoinTeam: PropTypes.func,
    onLeaveTeam: PropTypes.func,
    onCreateTeam: PropTypes.func,
  };

  render() {
    const {
      otherTeams,
      activeTeams,
      hasMoreTeams,
      organization,
      access,
      features,
      routes,
      onSearch,
      onRequestAccess,
      onJoinTeam,
      onLeaveTeam,
      onCreateTeam,
      params,
    } = this.props;
    const org = organization;

    if (!organization) {
      return null;
    }

    const canCreateTeams = access.has('project:admin');

    const action = (
      <Button
        priority="primary"
        size="small"
        disabled={!canCreateTeams}
        title={
          !canCreateTeams ? t('You do not have permission to create teams') : undefined
        }
        onClick={() =>
          openCreateTeamModal({
            organization,
          })
        }
        icon={<IconAdd size="xs" circle />}
      >
        {t('Create Team')}
      </Button>
    );

    const teamRoute = routes.find(({path}) => path === 'teams/');
    const urlPrefix = recreateRoute(teamRoute, {routes, params, stepBack: -2});
    const title = t('Teams');

    return (
      <div data-test-id="team-list">
        <SentryDocumentTitle title={title} objSlug={organization.slug} />
        <SettingsPageHeader title={title} action={action} />
        <Panel>
          <PanelHeader>{t('Your Teams')}</PanelHeader>
          <PanelBody>
            {activeTeams === null ? (
              <LoadingIndicator />
            ) : (
              <AllTeamsList
                useCreateModal
                urlPrefix={urlPrefix}
                organization={org}
                teamList={activeTeams}
                access={access}
                openMembership={false}
                onLeaveTeam={onLeaveTeam}
                onCreateTeam={onCreateTeam}
              />
            )}
          </PanelBody>
        </Panel>
        <Panel>
          <PanelHeader hasButtons>
            <div>{t('Other Teams')}</div>

            <div>
              <Input
                name="teamSearch"
                placeholder={t('Search teams')}
                onChange={onSearch}
              />
            </div>
          </PanelHeader>
          <PanelBody>
            {otherTeams === null ? (
              <LoadingIndicator />
            ) : (
              <React.Fragment>
                <AllTeamsList
                  useCreateModal
                  urlPrefix={urlPrefix}
                  organization={org}
                  teamList={otherTeams}
                  access={access}
                  openMembership={
                    !!(features.has('open-membership') || access.has('org:write'))
                  }
                  onRequestAccess={onRequestAccess}
                  onJoinTeam={onJoinTeam}
                  onCreateTeam={onCreateTeam}
                />
                {hasMoreTeams && (
                  <MoreResults>
                    {t('More teams available, use search to narrow down results.')}
                  </MoreResults>
                )}
              </React.Fragment>
            )}
          </PanelBody>
        </Panel>
      </div>
    );
  }
}

export default OrganizationTeams;

const MoreResults = styled(PanelItem)`
  justify-content: center;
  color: ${p => p.theme.gray2};
`;
