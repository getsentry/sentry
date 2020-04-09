import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import {Client} from 'app/api';
import {Organization, Project, Team} from 'app/types';
import {PageContent} from 'app/styles/organization';
import {Panel, PanelBody} from 'app/components/panels';
import {addErrorMessage} from 'app/actionCreators/indicator';
import {joinTeam} from 'app/actionCreators/teams';
import {t} from 'app/locale';
import Button from 'app/components/button';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import HeroIcon from 'app/components/heroIcon';
import LoadingIndicator from 'app/components/loadingIndicator';
import Projects from 'app/utils/projects';
import Well from 'app/components/well';
import space from 'app/styles/space';
import withApi from 'app/utils/withApi';

type Props = {
  api: Client;
  organization: Organization;
  project: Project;
};

class MissingProjectMembership extends React.Component<Props> {
  static propTypes = {
    api: PropTypes.object,
    organization: PropTypes.object.isRequired,
  };

  state = {
    loading: false,
    error: false,
  };

  joinTeam(team: Team) {
    this.setState({
      loading: true,
    });

    joinTeam(
      this.props.api,
      {
        orgId: this.props.organization.slug,
        teamId: team.slug,
      },
      {
        success: () => {
          this.setState({
            loading: false,
            error: false,
          });
        },
        error: () => {
          this.setState({
            loading: false,
            error: true,
          });
          addErrorMessage(t('There was an error while trying to leave the team.'));
        },
      }
    );
  }

  renderJoinTeam(team, features) {
    if (!team) {
      return null;
    }
    if (this.state.loading) {
      return (
        <Button busy disabled>
          ...
        </Button>
      );
    } else if (team.isPending) {
      return <Button disabled>{t('Request Pending')}</Button>;
    } else if (features.has('open-membership')) {
      return (
        <Button type="button" onClick={this.joinTeam.bind(this, team)}>
          {t('Join Team')}
        </Button>
      );
    }
    return (
      <Button type="button" onClick={this.joinTeam.bind(this, team)}>
        {t('Request Access')}
      </Button>
    );
  }

  renderExplanation(features) {
    const {teams} = this.props.project;

    if (features.has('open-membership')) {
      return t('To view this data you must join one of the following teams.');
    }

    if (!teams.length) {
      return t('To view this data you must ask an admin to add a team to this project.');
    }

    return t(
      'To view this data you must first request access to one of the following teams:'
    );
  }

  renderJoinTeams(features) {
    const {teams} = this.props.project;

    if (!teams.length) {
      return null;
    }

    return (
      <JoinTeams>
        <TeamTable>
          {teams.map(team => (
            <React.Fragment key={team.slug}>
              <span>#{team.slug}</span>
              <span>{this.renderJoinTeam(team, features)}</span>
            </React.Fragment>
          ))}
        </TeamTable>
      </JoinTeams>
    );
  }

  render() {
    const {organization} = this.props;
    const features = new Set(organization.features);

    return (
      <PageContent>
        <Panel>
          <PanelBody>
            <EmptyStateWarning>
              <p>{t("You're not a member of this project.")}</p>
              <p>{this.renderExplanation(features)}</p>
              {this.renderJoinTeams(features)}
            </EmptyStateWarning>
          </PanelBody>
        </Panel>
      </PageContent>
    );
  }
}

export {MissingProjectMembership};

export default withApi(MissingProjectMembership);

const JoinTeams = styled('div')`
  display: flex;
  justify-content: center;
`;

const TeamTable = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-gap: ${space(2)};
  align-items: center;
  text-align: left;
`;
