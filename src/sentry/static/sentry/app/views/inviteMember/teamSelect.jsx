import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {t} from '../../locale';
import Checkbox from '../../components/checkbox';
import Panel from '../settings/components/panel';
import PanelBody from '../settings/components/panelBody';
import PanelHeader from '../settings/components/panelHeader';
import PanelItem from '../settings/components/panelItem';

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
            {teams.map(({slug, name}, i) => (
              <TeamItem key={slug}>
                <label className="checkbox">
                  <Checkbox
                    id={slug}
                    disabled={disabled}
                    checked={selectedTeams.has(slug)}
                    onChange={e => {
                      toggleTeam(slug);
                    }}
                  />
                  <span>{name}</span>
                  <span className="team-slug">{slug}</span>
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
