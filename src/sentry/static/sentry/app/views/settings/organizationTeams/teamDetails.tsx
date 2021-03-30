import React from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {fetchTeamDetails, joinTeam} from 'app/actionCreators/teams';
import {Client} from 'app/api';
import Alert from 'app/components/alert';
import Button from 'app/components/button';
import IdBadge from 'app/components/idBadge';
import ListLink from 'app/components/links/listLink';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import NavTabs from 'app/components/navTabs';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import {t, tct} from 'app/locale';
import TeamStore from 'app/stores/teamStore';
import {Team} from 'app/types';
import recreateRoute from 'app/utils/recreateRoute';
import withApi from 'app/utils/withApi';
import withTeams from 'app/utils/withTeams';

type Props = {
  api: Client;
  teams: Team[];
  children: React.ReactNode;
} & RouteComponentProps<{orgId: string; teamId: string}, {}>;

type State = {
  loading: boolean;
  error: boolean;
  requesting: boolean;
  team: Team | null;
};

class TeamDetails extends React.Component<Props, State> {
  state = this.getInitialState();

  getInitialState() {
    const team = TeamStore.getBySlug(this.props.params.teamId);

    return {
      loading: !TeamStore.initialized,
      error: false,
      requesting: false,
      team,
    };
  }

  componentDidUpdate(prevProps: Props) {
    const {params} = this.props;

    if (
      prevProps.params.teamId !== params.teamId ||
      prevProps.params.orgId !== params.orgId
    ) {
      this.fetchData();
    }
    if (!isEqual(this.props.teams, prevProps.teams)) {
      this.setActiveTeam();
    }
  }

  setActiveTeam() {
    const team = TeamStore.getBySlug(this.props.params.teamId);
    const loading = !TeamStore.initialized;
    const error = !loading && !team;

    this.setState({team, loading, error});
  }

  handleRequestAccess = () => {
    const {api, params} = this.props;
    const {team} = this.state;
    if (!team) {
      return;
    }

    this.setState({
      requesting: true,
    });

    joinTeam(
      api,
      {
        orgId: params.orgId,
        teamId: team.slug,
      },
      {
        success: () => {
          addSuccessMessage(
            tct('You have requested access to [team]', {
              team: `#${team.slug}`,
            })
          );
          this.setState({
            requesting: false,
          });
        },
        error: () => {
          addErrorMessage(
            tct('Unable to request access to [team]', {
              team: `#${team.slug}`,
            })
          );
          this.setState({
            requesting: false,
          });
        },
      }
    );
  };

  fetchData = () => {
    this.setState({
      loading: true,
      error: false,
    });
    fetchTeamDetails(this.props.api, this.props.params);
  };

  onTeamChange = (data: Team) => {
    const team = this.state.team;
    if (data.slug !== team?.slug) {
      const orgId = this.props.params.orgId;
      browserHistory.replace(`/organizations/${orgId}/teams/${data.slug}/settings/`);
    } else {
      this.setState({
        team: {
          ...team,
          ...data,
        },
      });
    }
  };

  render() {
    const {params, routes, children} = this.props;
    const {team, loading, requesting, error} = this.state;

    if (loading) {
      return <LoadingIndicator />;
    }
    if (!team || !team.hasAccess) {
      return (
        <Alert type="warning">
          {team ? (
            <RequestAccessWrapper>
              {tct('You do not have access to the [teamSlug] team.', {
                teamSlug: <strong>{`#${team.slug}`}</strong>,
              })}
              <Button
                disabled={requesting || team.isPending}
                size="small"
                onClick={this.handleRequestAccess}
              >
                {team.isPending ? t('Request Pending') : t('Request Access')}
              </Button>
            </RequestAccessWrapper>
          ) : (
            <div>{t('You do not have access to this team.')}</div>
          )}
        </Alert>
      );
    }
    if (error) {
      return <LoadingError onRetry={this.fetchData} />;
    }

    const routePrefix = recreateRoute('', {routes, params, stepBack: -1}); //`/organizations/${orgId}/teams/${teamId}`;
    return (
      <div>
        <SentryDocumentTitle title={t('Team Details')} orgSlug={params.orgId} />
        <h3>
          <IdBadge hideAvatar team={team} avatarSize={36} />
        </h3>

        <NavTabs underlined>
          <ListLink to={`${routePrefix}members/`}>{t('Members')}</ListLink>
          <ListLink to={`${routePrefix}projects/`}>{t('Projects')}</ListLink>
          <ListLink to={`${routePrefix}settings/`}>{t('Settings')}</ListLink>
        </NavTabs>

        {React.isValidElement(children) &&
          React.cloneElement(children, {
            team,
            onTeamChange: this.onTeamChange,
          })}
      </div>
    );
  }
}

export default withApi(withTeams(TeamDetails));

const RequestAccessWrapper = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;
