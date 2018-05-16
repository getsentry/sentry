import {Link} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';

import {openCreateTeamModal} from 'app/actionCreators/modal';
import {tct} from 'app/locale';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import SentryTypes from 'app/proptypes';
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
    let {useCreateModal, organization} = this.props;

    if (!useCreateModal) return;

    e.preventDefault();

    openCreateTeamModal({
      organization,
      onClose: () => {},
    });
  };

  render() {
    let {access, organization, urlPrefix, openMembership, useCreateModal} = this.props;
    let teamNodes = this.props.teamList.map((team, teamIdx) => {
      return (
        <AllTeamsRow
          urlPrefix={urlPrefix}
          access={access}
          team={team}
          organization={organization}
          openMembership={openMembership}
          key={team.slug}
        />
      );
    });

    if (teamNodes.length !== 0) {
      return teamNodes;
    }

    let to = useCreateModal ? '#' : `/organizations/${organization.slug}/teams/new/`;
    return (
      <EmptyMessage>
        {tct('No teams here. You can always [link:create one].', {
          root: <TextBlock noMargin />,
          link: <Link to={to} onClick={this.handleCreateTeam} />,
        })}
      </EmptyMessage>
    );
  }
}

export default AllTeamsList;
