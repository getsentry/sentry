import PropTypes from 'prop-types';
import React from 'react';
import {Link} from 'react-router';

import SentryTypes from '../../../proptypes';

import AllTeamsRow from './allTeamsRow';
import {tct} from '../../../locale';

const AllTeamsList = React.createClass({
  propTypes: {
    urlPrefix: PropTypes.string,
    access: PropTypes.object,
    organization: SentryTypes.Organization,
    teamList: PropTypes.arrayOf(SentryTypes.Team),
    openMembership: PropTypes.bool,
  },

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
      return (
        <div className="panel panel-default">
          <table className="table">
            <tbody>{teamNodes}</tbody>
          </table>
        </div>
      );
    }

    return tct(
      "You don't have any teams for this organization yet. Get started by [link:creating your first team].",
      {
        root: <p />,
        link: <Link to={`${urlPrefix}teams/new/`} />,
      }
    );
  },
});

export default AllTeamsList;
