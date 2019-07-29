import {Link} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {PanelItem} from 'app/components/panels';
import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {joinTeam, leaveTeam} from 'app/actionCreators/teams';
import {t, tct, tn} from 'app/locale';
import Button from 'app/components/button';
import IdBadge from 'app/components/idBadge';
import space from 'app/styles/space';
import withApi from 'app/utils/withApi';

class AllTeamsRow extends React.Component {
  static propTypes = {
    api: PropTypes.object,
    urlPrefix: PropTypes.string.isRequired,
    organization: PropTypes.object.isRequired,
    team: PropTypes.object.isRequired,
    openMembership: PropTypes.bool.isRequired,
  };

  state = {
    loading: false,
    error: false,
  };

  joinTeam = () => {
    const {organization, team} = this.props;

    this.setState({
      loading: true,
    });

    joinTeam(
      this.props.api,
      {
        orgId: organization.slug,
        teamId: team.slug,
      },
      {
        success: () => {
          this.setState({
            loading: false,
            error: false,
          });
          addSuccessMessage(
            tct('You have joined [team]', {
              team: `#${team.slug}`,
            })
          );
        },
        error: () => {
          this.setState({
            loading: false,
            error: true,
          });
          addErrorMessage(
            tct('Unable to join [team]', {
              team: `#${team.slug}`,
            })
          );
        },
      }
    );
  };

  leaveTeam = () => {
    const {organization, team} = this.props;

    this.setState({
      loading: true,
    });

    leaveTeam(
      this.props.api,
      {
        orgId: organization.slug,
        teamId: team.slug,
      },
      {
        success: () => {
          this.setState({
            loading: false,
            error: false,
          });
          addSuccessMessage(
            tct('You have left [team]', {
              team: `#${team.slug}`,
            })
          );
        },
        error: () => {
          this.setState({
            loading: false,
            error: true,
          });
          addErrorMessage(
            tct('Unable to leave [team]', {
              team: `#${team.slug}`,
            })
          );
        },
      }
    );
  };

  render() {
    const {team, urlPrefix, openMembership} = this.props;
    const display = (
      <IdBadge
        team={team}
        avatarSize={36}
        description={tn('%s Member', '%s Members', team.memberCount)}
      />
    );

    // You can only view team details if you have access to team -- this should account
    // for your role + org open memberhsip
    const canViewTeam = team.hasAccess;

    return (
      <TeamPanelItem>
        <TeamNameWrapper>
          {canViewTeam ? (
            <Link to={`${urlPrefix}teams/${team.slug}/`}>{display}</Link>
          ) : (
            display
          )}
        </TeamNameWrapper>
        <Spacer>
          {this.state.loading ? (
            <Button size="small" disabled>
              ...
            </Button>
          ) : team.isMember ? (
            <Button size="small" onClick={this.leaveTeam}>
              {t('Leave Team')}
            </Button>
          ) : team.isPending ? (
            <Button size="small" disabled>
              {t('Request Pending')}
            </Button>
          ) : openMembership ? (
            <Button size="small" onClick={this.joinTeam}>
              {t('Join Team')}
            </Button>
          ) : (
            <Button size="small" onClick={this.joinTeam}>
              {t('Request Access')}
            </Button>
          )}
        </Spacer>
      </TeamPanelItem>
    );
  }
}

export default withApi(AllTeamsRow);

const TeamPanelItem = styled(PanelItem)`
  padding: 0;
  align-items: center;
`;

const Spacer = styled('div')`
  padding: ${space(2)};
`;

const TeamNameWrapper = styled(Spacer)`
  flex: 1;
`;
