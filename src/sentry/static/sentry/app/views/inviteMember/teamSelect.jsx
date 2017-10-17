import React from 'react';
import PropTypes from 'prop-types';

import Checkbox from '../../components/checkbox';

import {t} from '../../locale';

const TeamSelect = React.createClass({
  propTypes: {
    selectedTeams: PropTypes.instanceOf(Set),
    teams: PropTypes.array,
    toggleTeam: PropTypes.func
  },

  render() {
    let {teams, selectedTeams, toggleTeam} = this.props;
    //no need to select a team when there's only one option
    if (teams.length < 2) return null;
    return (
      <div className="new-invite-team box">
        <div className="box-header">
          <h4>{t('Team') + ':'}</h4>
        </div>
        <div className="grouping-controls team-choices row box-content with-padding">
          {teams.map(({slug, name, id}, i) => (
            <div
              key={id}
              onClick={e => {
                e.preventDefault();
                toggleTeam(id);
              }}
              className="col-md-3">
              <label className="checkbox">
                <Checkbox id={id} value={name} checked={selectedTeams.has(id)} />
                {name}
                <span className="team-slug">{slug}</span>
              </label>
            </div>
          ))}
        </div>
      </div>
    );
  }
});

export default TeamSelect;
