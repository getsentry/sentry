import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';
import memberListStore from '../../../../stores/memberListStore';
import ProjectsStore from '../../../../stores/projectsStore';
import Button from '../../../../components/buttons/button';
import SelectInput from '../../../../components/selectInput';
import TextOverflow from '../../../../components/textOverflow';
import InlineSvg from '../../../../components/inlineSvg';
import {Flex} from '../../../../components/grid';
import Input from '../../../../views/settings/components/forms/controls/input';
import SentryTypes from '../../../../proptypes';
import {buildUserId, buildTeamId} from '../../../../utils';
import {addErrorMessage} from '../../../../actionCreators/indicator';
import SelectOwners from './selectOwners';

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
    return memberListStore.getAll().map(({id, name, email}) => ({
      value: buildUserId(id),
      label: name || email,
      searchKey: `${email}  ${name}`,
      actor: {
        type: 'user',
        id,
        name,
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

  handleChangeOwners = owners => {
    this.setState({owners});
  };

  handleAddRule = () => {
    let {type, text, owners} = this.state;

    if (!text || owners.length == 0) {
      addErrorMessage('A Rule needs a type, a value, and one or more owners.');
      return;
    }

    let ownerText = owners
      .map(
        owner =>
          owner.actor.type === 'team'
            ? `#${owner.actor.name}`
            : memberListStore.getById(owner.actor.id).email
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
        {(paths || urls) && (
          <Candidates>
            {paths &&
              paths.map(v => (
                <RuleCandidate
                  key={v}
                  onClick={() => this.setState({text: v, type: 'path'})}
                >
                  <AddIcon src="icon-circle-add" />
                  <StyledTextOverflow>{v}</StyledTextOverflow>
                  <TypeHint>[PATH]</TypeHint>
                </RuleCandidate>
              ))}
            {urls &&
              urls.map(v => (
                <RuleCandidate
                  key={v}
                  onClick={() => this.setState({text: v, type: 'url'})}
                >
                  <AddIcon src="icon-circle-add" />
                  <StyledTextOverflow>{v}</StyledTextOverflow>
                  <TypeHint>[URL]</TypeHint>
                </RuleCandidate>
              ))}
          </Candidates>
        )}
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
          <Flex flex="1" align="center" mr={1}>
            <SelectOwners
              options={[...this.mentionableTeams(), ...this.mentionableUsers()]}
              value={owners}
              onChange={this.handleChangeOwners}
            />
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
const Candidates = styled.div`
  margin-bottom: 10px;
`;

const TypeHint = styled.div`
  color: ${p => p.theme.borderDark};
`;

const StyledTextOverflow = styled(TextOverflow)`
  flex: 1;
`;

const RuleCandidate = styled.div`
  font-family: ${p => p.theme.text.familyMono};
  border: 1px solid ${p => p.theme.borderDark};
  background-color: #f8fafd;
  padding-left: 5px;
  margin-bottom: 3px;
  cursor: pointer;
  overflow: hidden;
  display: flex;
  align-items: center;
`;

const AddIcon = styled(InlineSvg)`
  color: ${p => p.theme.borderDark};
  margin-right: 5px;
  flex-shrink: 0;
`;

const BuilderBar = styled.div`
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

const RuleAddButton = styled(Button)`
  width: 37px;
  height: 37px;
  flex-shrink: 0;
  padding: 10px 12px !important;
`;

export default RuleBuilder;
