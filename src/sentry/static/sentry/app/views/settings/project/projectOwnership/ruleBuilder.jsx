import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';
import {Flex} from 'grid-emotion';

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

const IssueOwnerCandidate = styled('div')`
  font-family: Monaco, Consolas, 'Courier New', monospace;
  border: 1px solid ${p => p.theme.borderDark};
  background-color: #f8fafd;
  padding-left: 10px;
  margin-bottom: 3px;
  cursor: pointer;
`;

const AddIcon = styled(InlineSvg)`
  color: ${p => p.theme.borderDark};
  margin-right: 5px;
`;

const BuilderBar = styled('div')`
  display: flex;
  height: 40px;
  align-items: center;
  margin-bottom: 1em;
`;

const BuilderSelect = styled(SelectInput)`
  padding: 0.5em;
  margin-right: 5px;
  width: 80px;
  flex-shrink: 0;
`;

const BuilderInput = styled(Input)`
  padding: 0.5em;
  line-height: 19px;
  margin-right: 5px;
`;

const Divider = styled(InlineSvg)`
  color: ${p => p.theme.borderDark};
  flex-shrink: 0;
  margin-right: 5px;
`;

const Owners = styled('div')`
  justify-content: flex-end;
  display: flex;
  padding: 3px;
  span {
    margin-right: 2px;
  }

  .avatar {
    width: 28px;
    height: 28px;
  }
`;

const BuilderDropdownButton = styled(DropdownButton)`
  margin-right: 5px;
  padding-right: 8px !important;
  padding-left: 3px !important;

  flex: 1;
  white-space: nowrap;
  height: 37px;
  color: ${p => p.theme.gray3} !important;
`;

const RuleAddButton = styled(Button)`
  width: 37px;
  height: 37px;
  flex-shrink: 0;
  padding: 10px 12px !important;
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
    urls: PropTypes.arrayOf(PropTypes.string),
    paths: PropTypes.arrayOf(PropTypes.string),
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
      searchKey: `#${team.slug}`,
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

  handleRemoveActor(toRemove, e) {
    this.setState(({owners}) => ({
      owners: owners.filter(actor => !actorEquality(actor, toRemove)),
    }));
    e.stopPropagation();
  }

  handleAddRule = () => {
    let {type, text, owners} = this.state;

    if (!text || owners.length == 0) {
      addErrorMessage('A Rule needs a type, a value, and one or more owners.');
      return;
    }

    let ownerText = owners
      .map(
        actor =>
          actor.type == 'team'
            ? `#${actor.name}`
            : memberListStore.getById(actor.id).email
      )
      .join(' ');

    let rule = `${type}:${text} ${ownerText}`;
    this.props.onAddRule(rule);
    this.setState(initialState);
  };

  render() {
    let {urls, paths} = this.props;
    let {type, text, owners} = this.state;

    return (
      <React.Fragment>
        {((type === 'path' ? paths : urls) || []).map(v => (
          <IssueOwnerCandidate key={v} onClick={() => this.setState({text: v})}>
            <AddIcon src="icon-circle-add" />
            {v}
          </IssueOwnerCandidate>
        ))}
        <BuilderBar>
          <BuilderSelect value={type} showSearch={false} onChange={this.handleTypeChange}>
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
          <Flex flex="1" align="center">
            <DropdownAutoComplete
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
            >
              {({isOpen, selectedItem}) => (
                <BuilderDropdownButton isOpen={isOpen} size="zero">
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
                  <div>{t('Add Owners')}</div>
                </BuilderDropdownButton>
              )}
            </DropdownAutoComplete>
          </Flex>

          <RuleAddButton
            priority="primary"
            onClick={this.handleAddRule}
            icon="icon-circle-add"
            size="zero"
          />
        </BuilderBar>
      </React.Fragment>
    );
  }
}

export default RuleBuilder;
