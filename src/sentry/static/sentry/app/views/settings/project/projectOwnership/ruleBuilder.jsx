import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import memberListStore from '../../../../stores/memberListStore';
import ProjectsStore from '../../../../stores/projectsStore';
import Button from '../../../../components/buttons/button';
import SelectInput from '../../../../components/selectInput';
import Input from '../../../../views/settings/components/forms/controls/input';
import DropdownAutoComplete from '../../../../components/dropdownAutoComplete';
import DropdownButton from '../../../../components/dropdownButton';
import ActorAvatar from '../../../../components/actorAvatar';
import SentryTypes from '../../../../proptypes';
import {buildUserId, buildTeamId} from '../../../../utils';
import {t} from '../../../../locale';

const BuilderBar = styled('div')`
  display: flex;
`;

class RuleBuilder extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization,
    project: SentryTypes.Project,
    handleAddRule: PropTypes.func,
  };

  constructor(props) {
    super(props);
    this.state = {
      text: '',
      type: 'path',
      owners: [],
    };
  }

  mentionableUsers() {
    return memberListStore.getAll().map(member => ({
      value: buildUserId(member.id),
      label: member.email,
      searchKey: `${member.email}  ${name}`,
      actor: {
        type: 'user',
        id: member.id,
        name: member.name,
      },
    }));
  }

  mentionableTeams() {
    let {project} = this.props;
    return (ProjectsStore.getAll().find(p => p.slug == project.slug) || {
      teams: [],
    }).teams.map(team => ({
      value: buildTeamId(team.id),
      label: `#${team.slug}`,
      searchKey: team.slug,
      actor: {
        type: 'team',
        id: team.id,
        name: team.slug,
      },
    }));
  }

  onChange(e) {
    this.setState({text: e.target.value});
  }

  handleAddActor(actor) {
    let {owners} = this.state;
    this.setState({
      owners: [...owners, actor.actor],
    });
  }

  handleRemoveActor(toRemove) {
    let {owners} = this.state;
    this.setState({
      owners: owners.filter(
        actor => !(actor.type == toRemove.type && actor.id == toRemove.id)
      ),
    });
  }
  handleAddRule() {
    let {type, text, owners} = this.state;
    let ownerText = owners
      .map(actor => `${actor.type == 'team' ? '#' : ''}${actor.name}`)
      .join(' ');

    let rule = `${type}:${text} ${ownerText}`;
    this.props.handleAddRule(rule);
  }

  render() {
    let {type, text, owners} = this.state;

    let menuHeader = <StyledTeamsLabel>{t('Owners')}</StyledTeamsLabel>;
    return (
      <BuilderBar>
        <SelectInput value={type} style={{width: '200px'}}>
          <option value="path">path</option>
          <option value="url">URL</option>
        </SelectInput>
        <Input controlled value={text} onChange={this.onChange.bind(this)} />
        >
        {owners.map(owner => (
          <span
            style={{width: '50px', height: '50px'}}
            key={`${owner.type}-${owner.id}`}
            onClick={this.handleRemoveActor.bind(this, owner)}
          >
            <ActorAvatar actor={owner} />
          </span>
        ))}
        <DropdownAutoComplete
          items={[
            {
              value: 'team',
              label: 'teams',
              items: this.mentionableTeams(),
            },
            {
              value: 'user',
              label: 'users',
              items: this.mentionableUsers(),
            },
          ]}
          onSelect={this.handleAddActor.bind(this)}
          menuHeader={menuHeader}
        >
          {({isOpen, selectedItem}) => (
            <DropdownButton isOpen={isOpen} size="xsmall">
              {t('Owners')}
            </DropdownButton>
          )}
        </DropdownAutoComplete>
        <Button
          priority="primary"
          onClick={this.handleAddRule.bind(this)}
          icon="icon-circle-add"
        />
      </BuilderBar>
    );
  }
}

const StyledTeamsLabel = styled('div')`
  width: 250px;
  font-size: 0.875em;
  padding: 0.75em 0;
  text-transform: uppercase;
`;

export default RuleBuilder;
