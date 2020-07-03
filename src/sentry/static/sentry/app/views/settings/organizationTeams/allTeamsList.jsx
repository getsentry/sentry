import {Link} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';

import {openCreateTeamModal} from 'app/actionCreators/modal';
import {tct} from 'app/locale';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import SentryTypes from 'app/sentryTypes';
import TextBlock from 'app/views/settings/components/text/textBlock';

import AllTeamsRow from './allTeamsRow';

class AllTeamsList extends React.Component {
  static propTypes = {
    urlPrefix: PropTypes.string,
    access: PropTypes.object,
    organization: SentryTypes.Organization,
    teamList: PropTypes.arrayOf(SentryTypes.Team),
    openMembership: PropTypes.bool,
    useCreateModal: PropTypes.bool,
  };

  handleCreateTeam = e => {
    const {useCreateModal, organization} = this.props;

    if (!useCreateModal) {
      return;
    }

    e.preventDefault();

    openCreateTeamModal({
      organization,
      onClose: () => {},
    });
  };

  render() {
    const {access, organization, urlPrefix, openMembership, useCreateModal} = this.props;
    const teamNodes = this.props.teamList.map(team => (
      <AllTeamsRow
        urlPrefix={urlPrefix}
        access={access}
        team={team}
        organization={organization}
        openMembership={openMembership}
        key={team.slug}
      />
    ));

    if (teamNodes.length !== 0) {
      return teamNodes;
    }

    const to = useCreateModal ? '#' : `/organizations/${organization.slug}/teams/new/`;
    return (
      <EmptyMessage>
        {tct('No teams here. [teamCreate]', {
          root: <TextBlock noMargin />,
          teamCreate: access.has('project:admin')
            ? tct('You can always [link:create one].', {
                link: <Link to={to} onClick={this.handleCreateTeam} />,
              })
            : null,
        })}
      </EmptyMessage>
    );
  }
}

export default AllTeamsList;
