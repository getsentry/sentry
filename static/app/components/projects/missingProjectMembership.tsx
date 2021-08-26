import {Component} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {joinTeam} from 'app/actionCreators/teams';
import {Client} from 'app/api';
import Button from 'app/components/button';
import SelectControl from 'app/components/forms/selectControl';
import {Panel} from 'app/components/panels';
import {IconFlag} from 'app/icons';
import {t} from 'app/locale';
import TeamStore from 'app/stores/teamStore';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import withApi from 'app/utils/withApi';
import EmptyMessage from 'app/views/settings/components/emptyMessage';

type SelectOption = Record<'value' | 'label', string>;

type Props = {
  api: Client;
  organization: Organization;
  projectSlug?: string;
};

type State = {
  loading: boolean;
  error: boolean;
  project?: Project;
  team: string | null;
};

class MissingProjectMembership extends Component<Props, State> {
  constructor(props: Props) {
    super(props);

    const {organization, projectSlug} = this.props;
    const project = organization.projects?.find(p => p.slug === projectSlug);

    this.state = {
      loading: false,
      error: false,
      project,
      team: '',
    };
  }

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

  renderJoinTeam(teamSlug: string, features: Set<string>) {
    const team = TeamStore.getBySlug(teamSlug);

    if (!team) {
      return null;
    }
    if (this.state.loading) {
      if (features.has('open-membership')) {
        return <Button busy>{t('Join Team')}</Button>;
      }
      return <Button busy>{t('Request Access')}</Button>;
    } else if (team?.isPending) {
      return <Button disabled>{t('Request Pending')}</Button>;
    } else if (features.has('open-membership')) {
      return (
        <Button
          priority="primary"
          type="button"
          onClick={this.joinTeam.bind(this, teamSlug)}
        >
          {t('Join Team')}
        </Button>
      );
    }
    return (
      <Button
        priority="primary"
        type="button"
        onClick={this.joinTeam.bind(this, teamSlug)}
      >
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

  handleChangeTeam = (teamObj: SelectOption | null) => {
    const team = teamObj ? teamObj.value : null;
    this.setState({team});
  };

  getPendingTeamOption = (team: string) => {
    return {
      value: team,
      label: <DisabledLabel>{t(`#${team}`)}</DisabledLabel>,
    };
  };

  render() {
    const {organization} = this.props;
    const teamSlug = this.state.team;
    const teams = this.state.project?.teams ?? [];
    const features = new Set(organization.features);

    const teamAccess = [
      {
        label: t('Request Access'),
        options: this.getTeamsForAccess()[0].map(request => ({
          value: request,
          label: t(`#${request}`),
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
                  onChange={this.handleChangeTeam}
                />
                {teamSlug ? (
                  this.renderJoinTeam(teamSlug, features)
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

export {MissingProjectMembership};

export default withApi(MissingProjectMembership);
