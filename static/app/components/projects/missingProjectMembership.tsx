import {Component} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {joinTeam} from 'sentry/actionCreators/teams';
import {Client} from 'sentry/api';
import {Button} from 'sentry/components/button';
import EmptyMessage from 'sentry/components/emptyMessage';
import SelectControl from 'sentry/components/forms/controls/selectControl';
import Panel from 'sentry/components/panels/panel';
import {IconFlag} from 'sentry/icons';
import {t} from 'sentry/locale';
import TeamStore from 'sentry/stores/teamStore';
import {space} from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import withApi from 'sentry/utils/withApi';

type Props = {
  api: Client;
  organization: Organization;
  project?: Project | null;
};

type State = {
  error: boolean;
  loading: boolean;
  team: string | null;
  project?: Project | null;
};

class MissingProjectMembership extends Component<Props, State> {
  state: State = {
    loading: false,
    error: false,
    project: this.props.project,
    team: '',
  };

  joinTeam(teamSlug: string) {
    this.setState({
      loading: true,
    });

    joinTeam(
      this.props.api,
      {
        orgId: this.props.organization.slug,
        teamId: teamSlug,
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

  renderJoinTeam(teamSlug: string, features: string[]) {
    const team = TeamStore.getBySlug(teamSlug);

    if (!team) {
      return null;
    }
    if (this.state.loading) {
      if (features.includes('open-membership')) {
        return <Button busy>{t('Join Team')}</Button>;
      }
      return <Button busy>{t('Request Access')}</Button>;
    }
    if (team?.isPending) {
      return <Button disabled>{t('Request Pending')}</Button>;
    }
    if (features.includes('open-membership')) {
      return (
        <Button priority="primary" onClick={this.joinTeam.bind(this, teamSlug)}>
          {t('Join Team')}
        </Button>
      );
    }
    return (
      <Button priority="primary" onClick={this.joinTeam.bind(this, teamSlug)}>
        {t('Request Access')}
      </Button>
    );
  }

  getTeamsForAccess() {
    const request: string[] = [];
    const pending: string[] = [];
    const teams = this.state.project?.teams ?? [];
    teams.forEach(({slug}) => {
      const team = TeamStore.getBySlug(slug);
      if (!team) {
        return;
      }
      team.isPending ? pending.push(team.slug) : request.push(team.slug);
    });

    return [request, pending];
  }

  getPendingTeamOption = (team: string) => {
    return {
      value: team,
      label: <DisabledLabel>{`#${team}`}</DisabledLabel>,
    };
  };

  render() {
    const {organization} = this.props;
    const teamSlug = this.state.team;
    const teams = this.state.project?.teams ?? [];

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
          this.getPendingTeamOption(pending)
        ),
      },
    ];

    return (
      <StyledPanel>
        {!teams.length ? (
          <EmptyMessage icon={<IconFlag size="xl" />}>
            {t(
              'No teams have access to this project yet. Ask an admin to add your team to this project.'
            )}
          </EmptyMessage>
        ) : (
          <EmptyMessage
            icon={<IconFlag size="xl" />}
            title={t("You're not a member of this project.")}
            description={t(
              `You'll need to join a team with access before you can view this data.`
            )}
            action={
              <Field>
                <StyledSelectControl
                  name="select"
                  placeholder={t('Select a Team')}
                  options={teamAccess}
                  onChange={teamObj => {
                    const team = teamObj ? teamObj.value : null;
                    this.setState({team});
                  }}
                />
                {teamSlug ? (
                  this.renderJoinTeam(teamSlug, organization.features)
                ) : (
                  <Button disabled>{t('Select a Team')}</Button>
                )}
              </Field>
            }
          />
        )}
      </StyledPanel>
    );
  }
}

const StyledPanel = styled(Panel)`
  margin: ${space(2)} 0;
`;

const Field = styled('div')`
  display: grid;
  grid-auto-flow: column;
  gap: ${space(2)};
  text-align: left;
`;

const StyledSelectControl = styled(SelectControl)`
  width: 250px;
`;

const DisabledLabel = styled('div')`
  display: flex;
  opacity: 0.5;
  overflow: hidden;
`;

export default withApi(MissingProjectMembership);
