import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {t} from 'app/locale';
import Button from 'app/components/button';
import Checkbox from 'app/components/checkbox';
import IdBadge from 'app/components/idBadge';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';

class TeamSelect extends React.Component {
  static propTypes = {
    disabled: PropTypes.bool,
    selectedTeams: PropTypes.instanceOf(Set),
    teams: PropTypes.array,
    toggleTeam: PropTypes.func,
    onSelectAll: PropTypes.func,
    allSelected: PropTypes.func,
  };

  render() {
    let {
      disabled,
      teams,
      selectedTeams,
      toggleTeam,
      onSelectAll,
      allSelected,
    } = this.props;
    //no need to select a team when there's only one option
    if (teams.length < 2) return null;
    let hasSelectAll = !!onSelectAll && !!allSelected;

    return (
      <Panel className="new-invite-team">
        <PanelHeader hasButtons={hasSelectAll}>
          {t('Team')}
          {hasSelectAll && (
            <Button
              data-test-id="select-all"
              size="small"
              disabled={disabled}
              onClick={onSelectAll}
            >
              <SelectAll>{allSelected() ? t('Deselect') : t('Select All')}</SelectAll>
            </Button>
          )}
        </PanelHeader>

        <PanelBody className="grouping-controls team-choices">
          <PanelItem css={{flexWrap: 'wrap'}}>
            {teams.map(team => (
              <TeamItem key={team.slug}>
                <label disabled={disabled} className="checkbox">
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

const TeamItem = styled.div`
  width: 25%;
  padding: 6px;
`;

const SelectAll = styled.span`
  font-size: 13px;
  color: ${p => (p.lightText ? p.theme.gray2 : p.theme.gray3)};
`;

export default TeamSelect;
