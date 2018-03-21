import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import memberListStore from '../../../../stores/memberListStore';
import ProjectsStore from '../../../../stores/projectsStore';
import Button from '../../../../components/buttons/button';
import SelectInput from '../../../../components/selectInput';
import InlineSvg from '../../../../components/inlineSvg';
import Input from '../../../../views/settings/components/forms/controls/input';
import DropdownAutoComplete from '../../../../components/dropdownAutoComplete';
import DropdownButton from '../../../../components/dropdownButton';
import ActorAvatar from '../../../../components/actorAvatar';
import SentryTypes from '../../../../proptypes';
import {buildUserId, buildTeamId, actorEquality} from '../../../../utils';
import {addErrorMessage} from '../../../../actionCreators/indicator';

import {t} from '../../../../locale';

const BuilderBar = styled('div')`
  display: flex;
  height: 2em;
  margin-bottom: 1em;
`;

const BuilderSelect = styled(SelectInput)`
  height: 32px;
  padding: 0.5em;
  margin-right: 5px;
  width: 80px;
`;

const BuilderInput = styled(Input)`
  height: 32px;
  padding: 0.5em;
  margin-right: 5px;
  width: 50%;
`;

const Divider = styled(InlineSvg)`
  height: 32px;
`;

const Owners = styled('div')`
  flex-grow: 100;
  justify-content: flex-end;
  display: flex;
  span {
    margin-right: 2px;
  }
  .avatar {
    width: 32px;
    height: 32px;
  }
`;

const BuilderDropdownAutoComplete = styled(DropdownAutoComplete)``;

const BuilderDropdownButton = styled(DropdownButton)`
  margin-right: 5px;
  height: 32px;
  white-space: nowrap;
`;

const RuleAddButton = styled(Button)`
  height: 32px;
  width: 32px;
  display: flex;

  justify-content: center;
  .button-label {
    height: 32px;
    padding: 0.5em;
  }
  div {
    margin: 0px !important;
  }
`;
const initialState = {
  text: '',
  type: 'path',
  owners: [],
};

class RuleBuilder extends React.Component {
  static propTypes = {
    project: SentryTypes.Project,
    onAddRule: PropTypes.func,
  };

  constructor(props) {
    super(props);
    this.state = initialState;
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
    let projectData = ProjectsStore.getAll().find(p => p.slug == project.slug);

    if (!projectData) {
      return [];
    }

    return projectData.teams.map(team => ({
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

  handleTypeChange = e => {
    this.setState({type: e[0].value});
  };

  handleChangeValue = e => {
    this.setState({text: e.target.value});
  };

  onAddActor = ({actor}) => {
    this.setState(({owners}) => {
      if (!owners.find(i => actorEquality(i, actor))) {
        return {owners: [...owners, actor]};
      } else return {};
    });
  };

  handleRemoveActor(toRemove) {
    this.setState(({owners}) => ({
      owners: owners.filter(actor => !actorEquality(actor, toRemove)),
    }));
  }

  handleAddRule = () => {
    let {type, text, owners} = this.state;

    if (!text || owners.length == 0) {
      addErrorMessage('A Rule needs a type, a value, and one or more owners.');
      return;
    }
    let ownerText = owners
      .map(actor => `${actor.type == 'team' ? '#' : ''}${actor.name}`)
      .join(' ');

    let rule = `${type}:${text} ${ownerText}`;
    this.props.onAddRule(rule);
    this.setState(initialState);
  };

  render() {
    let {type, text, owners} = this.state;

    let menuHeader = <StyledTeamsLabel>{t('Owners')}</StyledTeamsLabel>;
    return (
      <BuilderBar>
        <BuilderSelect value={type} onChange={this.handleTypeChange}>
          <option value="path">Path</option>
          <option value="url">URL</option>
        </BuilderSelect>
        <BuilderInput
          controlled
          value={text}
          onChange={this.handleChangeValue}
          placeholder={type === 'path' ? 'src/example/*' : 'example.com/settings/*'}
        />
        <Divider src="icon-chevron-right" />
        <Owners>
          {owners.map(owner => (
            <span
              key={`${owner.type}-${owner.id}`}
              onClick={this.handleRemoveActor.bind(this, owner)}
            >
              <ActorAvatar actor={owner} />
            </span>
          ))}
        </Owners>
        <BuilderDropdownAutoComplete
          items={[
            {
              value: 'team',
              label: 'Teams',
              items: this.mentionableTeams(),
            },
            {
              value: 'user',
              label: 'Users',
              items: this.mentionableUsers(),
            },
          ]}
          onSelect={this.onAddActor}
          menuHeader={menuHeader}
        >
          {({isOpen, selectedItem}) => (
            <BuilderDropdownButton isOpen={isOpen} size="xsmall">
              {t('Add Owners')}
            </BuilderDropdownButton>
          )}
        </BuilderDropdownAutoComplete>
        <RuleAddButton
          priority="primary"
          onClick={this.handleAddRule}
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
