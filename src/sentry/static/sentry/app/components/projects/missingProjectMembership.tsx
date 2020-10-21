import { Component } from 'react';
import styled from '@emotion/styled';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {joinTeam} from 'app/actionCreators/teams';
import {t} from 'app/locale';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import {IconFlag} from 'app/icons';
import Well from 'app/components/well';
import space from 'app/styles/space';
import withApi from 'app/utils/withApi';
import {Client} from 'app/api';
import {Organization, Project, Team} from 'app/types';

type Props = {
  api: Client;
  organization: Organization;
  projectId: string;
};

type State = {
  loading: boolean;
  error: boolean;
  project?: Project;
};

class MissingProjectMembership extends Component<Props, State> {
  constructor(props: Props) {
    super(props);

    const {organization, projectId} = this.props;
    const project = organization.projects.find(p => p.slug === projectId);

    this.state = {
      loading: false,
      error: false,
      project,
    };
  }

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

  renderJoinTeam(team: Team, features: Set<string>) {
    if (!team) {
      return null;
    }
    if (this.state.loading) {
      return <a className="btn btn-default btn-loading btn-disabled">...</a>;
    } else if (team.isPending) {
      return <a className="btn btn-default btn-disabled">{t('Request Pending')}</a>;
    } else if (features.has('open-membership')) {
      return (
        <a className="btn btn-default" onClick={this.joinTeam.bind(this, team)}>
          {t('Join Team')}
        </a>
      );
    }
    return (
      <a className="btn btn-default" onClick={this.joinTeam.bind(this, team)}>
        {t('Request Access')}
      </a>
    );
  }

  renderExplanation(features: Set<string>) {
    if (features.has('open-membership')) {
      return t('To view this data you must one of the following teams.');
    } else {
      return t(
        'To view this data you must first request access to one of the following teams:'
      );
    }
  }

  renderJoinTeams(features: Set<string>) {
    const teams = this.state.project?.teams ?? [];

    if (!teams.length) {
      return (
        <EmptyMessage>
          {t(
            'No teams have access to this project yet. Ask an admin to add your team to this project.'
          )}
        </EmptyMessage>
      );
    }

    return teams.map((team: Team) => (
      <p key={team.slug}>
        #{team.slug}: {this.renderJoinTeam(team, features)}
      </p>
    ));
  }

  render() {
    const {organization} = this.props;
    const features = new Set(organization.features);

    return (
      <div className="container">
        <StyledWell centered>
          <StyledIconFlag size="xxl" />
          <p>{t("You're not a member of this project.")}</p>
          <p>{this.renderExplanation(features)}</p>
          {this.renderJoinTeams(features)}
        </StyledWell>
      </div>
    );
  }
}

const StyledWell = styled(Well)`
  margin-top: ${space(2)};
`;

const StyledIconFlag = styled(IconFlag)`
  margin-bottom: ${space(2)};
`;

export {MissingProjectMembership};

export default withApi(MissingProjectMembership);
