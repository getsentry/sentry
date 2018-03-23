import {Link} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';

import {tct} from '../../../locale';
import AllTeamsRow from './allTeamsRow';
import EmptyMessage from '../components/emptyMessage';
import SentryTypes from '../../../proptypes';
import TextBlock from '../components/text/textBlock';

class AllTeamsList extends React.Component {
  static propTypes = {
    urlPrefix: PropTypes.string,
    access: PropTypes.object,
    organization: SentryTypes.Organization,
    teamList: PropTypes.arrayOf(SentryTypes.Team),
    openMembership: PropTypes.bool,
  };

  render() {
    let {access, organization, urlPrefix, openMembership} = this.props;
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

    // TODO(jess): update this link to use url prefix when create team
    // has been moved to new settings
    return (
      <EmptyMessage>
        {tct('No teams here. You can always [link:create one].', {
          root: <TextBlock noMargin />,
          link: <Link to={`/organizations/${organization.slug}/teams/new/`} />,
        })}
      </EmptyMessage>
    );
  }
}

export default AllTeamsList;
