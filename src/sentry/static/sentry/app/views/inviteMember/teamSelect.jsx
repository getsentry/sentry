import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {t} from 'app/locale';
import Checkbox from 'app/components/checkbox';
import IdBadge from 'app/components/idBadge';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';

const TeamItem = styled.div`
  width: 25%;
  padding: 6px;
`;

class TeamSelect extends React.Component {
  static propTypes = {
    disabled: PropTypes.bool,
    selectedTeams: PropTypes.instanceOf(Set),
    teams: PropTypes.array,
    toggleTeam: PropTypes.func,
  };

  render() {
    let {disabled, teams, selectedTeams, toggleTeam} = this.props;
    //no need to select a team when there's only one option
    if (teams.length < 2) return null;

    return (
      <Panel className="new-invite-team">
        <PanelHeader>{t('Team')}</PanelHeader>

        <PanelBody className="grouping-controls team-choices">
          <PanelItem css={{flexWrap: 'wrap'}}>
            {teams.map(team => (
              <TeamItem key={team.slug}>
                <label className="checkbox">
                  <Checkbox
                    id={team.slug}
                    disabled={disabled}
                    checked={selectedTeams.has(team.slug)}
                    onChange={e => {
                      toggleTeam(team.slug);
                    }}
                    style={{marginTop: '1px'}}
                  />
                  <IdBadge team={team} hideAvatar />
                </label>
              </TeamItem>
            ))}
          </PanelItem>
        </PanelBody>
      </Panel>
    );
  }
}

export default TeamSelect;
