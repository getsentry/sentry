import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {joinTeam} from 'app/actionCreators/teams';
import {t} from 'app/locale';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import HeroIcon from 'app/components/heroIcon';
import Well from 'app/components/well';
import space from 'app/styles/space';
import withApi from 'app/utils/withApi';

class MissingProjectMembership extends React.Component {
  static propTypes = {
    api: PropTypes.object,
    organization: PropTypes.object.isRequired,
    projectId: PropTypes.string.isRequired,
  };

  constructor(props) {
    super(props);

    const {organization, projectId} = this.props;
    const project = organization.projects.find(p => p.slug === projectId);

    this.state = {
      loading: false,
      error: false,
      project,
    };
  }

  joinTeam(team) {
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

  renderExplanation(features) {
    if (features.has('open-membership')) {
      return t('To view this data you must one of the following teams.');
    } else {
      return t(
        'To view this data you must first request access to one of the following teams:'
      );
    }
  }

  renderJoinTeams(features) {
    const {teams} = this.state.project;
    if (!teams.length) {
      return (
        <EmptyMessage>
          {t(
            'No teams have access to this project yet. Ask an admin to add your team to this project.'
          )}
        </EmptyMessage>
      );
    }

    return teams.map(team => (
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
          <StyledHeroIcon src="icon-circle-exclamation" />
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

const StyledHeroIcon = styled(HeroIcon)`
  margin-bottom: ${space(2)};
`;

export {MissingProjectMembership};

export default withApi(MissingProjectMembership);
