import React from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {joinTeam} from 'app/actionCreators/teams';
import {Client} from 'app/api';
import Button from 'app/components/button';
import {Panel} from 'app/components/panels';
import {IconFlag} from 'app/icons';
import {t} from 'app/locale';
import TeamStore from 'app/stores/teamStore';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import withApi from 'app/utils/withApi';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import SelectField from 'app/views/settings/components/forms/selectField';

type Props = {
  api: Client;
  organization: Organization;
  projectId?: string;
  groupId: string;
};

type State = {
  loading: boolean;
  error: boolean;
  project?: Project;
  team: string;
};

class MissingProjectMembership extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);

    const {organization, projectId} = this.props;
    const project = organization.projects.find(p => p.slug === projectId);

    this.state = {
      loading: false,
      error: false,
      project,
      team: '',
    };
  }

  joinTeam(team: string) {
    this.setState({
      loading: true,
    });

    joinTeam(
      this.props.api,
      {
        orgId: this.props.organization.slug,
        teamId: team,
      },
      {
        success: () => {
          this.setState({
            loading: false,
            error: false,
          });
          addSuccessMessage(t('Request to join team sent.'));
        },
        error: () => {
          this.setState({
            loading: false,
            error: true,
          });
          addErrorMessage(t('There was an error while trying to request access.'));
        },
      }
    );
  }

  renderJoinTeam(team: string, features: Set<string>) {
    const teamStatus = TeamStore.getBySlug(team);

    if (!team) {
      return null;
    }
    if (this.state.loading) {
      if (features.has('open-membership')) {
        return <StyledButton busy>Join Team</StyledButton>;
      }
      return <StyledButton busy>Request Access</StyledButton>;
    } else if (teamStatus?.isPending) {
      return <StyledButton disabled>Request Pending</StyledButton>;
    } else if (features.has('open-membership')) {
      return (
        <StyledButton
          priority="primary"
          type="button"
          onClick={this.joinTeam.bind(this, team)}
        >
          {t('Join Team')}
        </StyledButton>
      );
    }
    return (
      <StyledButton
        priority="primary"
        type="button"
        onClick={this.joinTeam.bind(this, team)}
      >
        {t('Request Access')}
      </StyledButton>
    );
  }

  getTeamsForAccess() {
    const request: string[] = [];
    const pending: string[] = [];
    const teams = this.state.project?.teams ?? [];
    const team = teams.map(tm => TeamStore.getBySlug(tm.slug));
    team.map(tm => (tm?.isPending ? pending.push(tm!.slug) : request.push(tm!.slug)));
    return [request, pending];
  }

  handleChange = (evt: string) => {
    const input = evt;
    this.setState({team: input});
  };

  renderPendingTeam = (team: string) => {
    return {
      value: team,
      label: <DisabledLabel>{`#${team}`}</DisabledLabel>,
    };
  };

  render() {
    const {organization, groupId} = this.props;
    const team = this.state.team;
    const teams = this.state.project?.teams ?? [];
    const features = new Set(organization.features);

    const teamAccess = [
      {
        label: t('Request Access'),
        options: this.getTeamsForAccess()[0].map(request => ({
          value: request,
          label: `#${request}`,
        })),
      },
      {
        label: t('Pending Requests'),
        options: this.getTeamsForAccess()[1].map(pending =>
          this.renderPendingTeam(pending)
        ),
      },
    ];

    return (
      <div className="container">
        <Panel>
          {!teams.length ? (
            <EmptyMessage icon={<StyledIconFlag size="xl" color="gray300" />}>
              {t(
                'No teams have access to this project yet. Ask an admin to add your team to this project.'
              )}
            </EmptyMessage>
          ) : (
            <EmptyMessage
              icon={<StyledIconFlag size="xl" color="gray300" />}
              title={t("You're not a member of this project.")}
              description={t(
                `You'll need to join a team with access to Issue ID ${groupId} before you can view it.`
              )}
              action={
                <StyledField>
                  <StyledSelectField
                    name="select"
                    placeholder={t('Select a Team')}
                    options={teamAccess}
                    onChange={this.handleChange}
                    flexibleControlStateSize
                  />
                  {team ? (
                    this.renderJoinTeam(team, features)
                  ) : (
                    <StyledButton disabled>{t('Select a Team')}</StyledButton>
                  )}
                </StyledField>
              }
            />
          )}
        </Panel>
      </div>
    );
  }
}

const StyledField = styled('div')`
  display: inline-block;
  text-align: left;
`;

const StyledSelectField = styled(SelectField)`
  width: 350px;
  border-bottom: 0;
  display: inline-block;
  & > div {
    width: 100%;
    padding: 0;
  }
`;

const StyledIconFlag = styled(IconFlag)`
  display: flex;
  justify-content: center;
  margin: auto;
`;

const StyledButton = styled(Button)`
  display: inline-block;
  justify-content: center;
  margin-right: ${space(2)};
`;

const DisabledLabel = styled('div')`
  display: flex;
  opacity: 0.5;
  overflow: hidden;
`;

export {MissingProjectMembership};

export default withApi(MissingProjectMembership);
