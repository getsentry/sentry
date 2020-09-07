import PropTypes from 'prop-types';
import React from 'react';

import {openCreateTeamModal} from 'app/actionCreators/modal';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import {t} from 'app/locale';
import Button from 'app/components/button';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import SentryTypes from 'app/sentryTypes';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import recreateRoute from 'app/utils/recreateRoute';
import {IconAdd} from 'app/icons';

import AllTeamsList from './allTeamsList';

class OrganizationTeams extends React.Component {
  static propTypes = {
    allTeams: PropTypes.arrayOf(SentryTypes.Team),
    activeTeams: PropTypes.arrayOf(SentryTypes.Team),
    organization: SentryTypes.Organization,
    access: PropTypes.object,
    features: PropTypes.object,
    routes: PropTypes.array,
    params: PropTypes.object,
  };

  render() {
    const {
      allTeams,
      activeTeams,
      organization,
      access,
      features,
      routes,
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
        icon={<IconAdd size="xs" isCircled />}
      >
        {t('Create Team')}
      </Button>
    );

    const teamRoute = routes.find(({path}) => path === 'teams/');
    const urlPrefix = recreateRoute(teamRoute, {routes, params, stepBack: -2});

    const activeTeamIds = new Set(activeTeams.map(team => team.id));
    const otherTeams = allTeams.filter(team => !activeTeamIds.has(team.id));
    const title = t('Teams');

    return (
      <div data-test-id="team-list">
        <SentryDocumentTitle title={title} objSlug={organization.slug} />
        <SettingsPageHeader title={title} action={action} />
        <Panel>
          <PanelHeader>{t('Your Teams')}</PanelHeader>
          <PanelBody>
            <AllTeamsList
              urlPrefix={urlPrefix}
              organization={org}
              teamList={activeTeams}
              access={access}
              openMembership={false}
            />
          </PanelBody>
        </Panel>
        <Panel>
          <PanelHeader>{t('Other Teams')}</PanelHeader>
          <PanelBody>
            <AllTeamsList
              urlPrefix={urlPrefix}
              organization={org}
              teamList={otherTeams}
              access={access}
              openMembership={
                !!(features.has('open-membership') || access.has('org:write'))
              }
            />
          </PanelBody>
        </Panel>
      </div>
    );
  }
}

export default OrganizationTeams;
