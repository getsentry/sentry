import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';
import {Flex} from 'grid-emotion';

import {t} from 'app/locale';
import memberListStore from 'app/stores/memberListStore';
import Button from 'app/components/buttons/button';
import SelectField from 'app/components/forms/selectField';
import TextOverflow from 'app/components/textOverflow';
import InlineSvg from 'app/components/inlineSvg';
import Input from 'app/views/settings/components/forms/controls/input';
import SentryTypes from 'app/proptypes';
import {addErrorMessage} from 'app/actionCreators/indicator';
import SelectOwners from 'app/views/settings/project/projectOwnership/selectOwners';

const initialState = {
  text: '',
  type: 'path',
  owners: [],
  isValid: false,
};

class RuleBuilder extends React.Component {
  static propTypes = {
    project: SentryTypes.Project,
    organization: SentryTypes.Organization,
    onAddRule: PropTypes.func,
    urls: PropTypes.arrayOf(PropTypes.string),
    paths: PropTypes.arrayOf(PropTypes.string),
  };

  constructor(props) {
    super(props);
    this.state = initialState;
  }

  checkIsValid = () => {
    this.setState(state => ({
      isValid: !!state.text && state.owners && !!state.owners.length,
    }));
  };

  handleTypeChange = val => {
    this.setState({type: val});
    this.checkIsValid();
  };

  handleChangeValue = e => {
    this.setState({text: e.target.value});
    this.checkIsValid();
  };

  handleChangeOwners = owners => {
    this.setState({owners});
    this.checkIsValid();
  };

  handleAddRule = () => {
    let {type, text, owners, isValid} = this.state;

    if (!isValid) {
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

  handleSelectCandidate = (text, type) => {
    this.setState({text, type});
    this.checkIsValid();
  };

  render() {
    let {urls, paths, project, organization} = this.props;
    let {type, text, owners, isValid} = this.state;

    return (
      <React.Fragment>
        {(paths || urls) && (
          <Candidates>
            {paths &&
              paths.map(v => (
                <RuleCandidate
                  key={v}
                  onClick={() => this.handleSelectCandidate(v, 'path')}
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
                  onClick={() => this.handleSelectCandidate(v, 'url')}
                >
                  <AddIcon src="icon-circle-add" />
                  <StyledTextOverflow>{v}</StyledTextOverflow>
                  <TypeHint>[URL]</TypeHint>
                </RuleCandidate>
              ))}
          </Candidates>
        )}
        <BuilderBar>
          <BuilderSelect
            name="select-type"
            value={type}
            showSearch={false}
            onChange={this.handleTypeChange}
            options={[{value: 'path', label: t('Path')}, {value: 'url', label: t('URL')}]}
            style={{width: 140}}
            clearable={false}
          />
          <BuilderInput
            controlled
            value={text}
            onChange={this.handleChangeValue}
            placeholder={
              type === 'path' ? 'src/example/*' : 'https://example.com/settings/*'
            }
          />
          <Divider src="icon-chevron-right" />
          <Flex flex="1" align="center" mr={1}>
            <SelectOwners
              organization={organization}
              project={project}
              value={owners}
              onChange={this.handleChangeOwners}
            />
          </Flex>

          <RuleAddButton
            priority="primary"
            disabled={!isValid}
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

const BuilderSelect = styled(SelectField)`
  margin-right: 10px;
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
