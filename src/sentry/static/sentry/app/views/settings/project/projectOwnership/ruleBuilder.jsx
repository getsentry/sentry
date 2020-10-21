import PropTypes from 'prop-types';
import {Component, Fragment} from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import memberListStore from 'app/stores/memberListStore';
import Button from 'app/components/button';
import SelectField from 'app/components/forms/selectField';
import TextOverflow from 'app/components/textOverflow';
import {IconAdd, IconChevron} from 'app/icons';
import Input from 'app/views/settings/components/forms/controls/input';
import SentryTypes from 'app/sentryTypes';
import {addErrorMessage} from 'app/actionCreators/indicator';
import SelectOwners from 'app/views/settings/project/projectOwnership/selectOwners';
import space from 'app/styles/space';

const initialState = {
  text: '',
  tagName: '',
  type: 'path',
  owners: [],
  isValid: false,
};

function getMatchPlaceholder(type) {
  switch (type) {
    case 'path':
      return 'src/example/*';
    case 'url':
      return 'https://example.com/settings/*';
    case 'tag':
      return 'tag-value';
    default:
      return '';
  }
}

class RuleBuilder extends Component {
  static propTypes = {
    project: SentryTypes.Project,
    organization: SentryTypes.Organization,
    onAddRule: PropTypes.func,
    urls: PropTypes.arrayOf(PropTypes.string),
    paths: PropTypes.arrayOf(PropTypes.string),
    disabled: PropTypes.bool,
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

  handleTagNameChangeValue = e => {
    this.setState({tagName: e.target.value}, this.checkIsValid);
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
    const {type, text, tagName, owners, isValid} = this.state;

    if (!isValid) {
      addErrorMessage('A rule needs a type, a value, and one or more issue owners.');
      return;
    }

    const ownerText = owners
      .map(owner =>
        owner.actor.type === 'team'
          ? `#${owner.actor.name}`
          : memberListStore.getById(owner.actor.id).email
      )
      .join(' ');

    const quotedText = text.match(/\s/) ? `"${text}"` : text;

    const rule = `${
      type === 'tag' ? `tags.${tagName}` : type
    }:${quotedText} ${ownerText}`;
    this.props.onAddRule(rule);
    this.setState(initialState);
  };

  handleSelectCandidate = (text, type) => {
    this.setState({text, type});
    this.checkIsValid();
  };

  render() {
    const {urls, paths, disabled, project, organization} = this.props;
    const {type, text, tagName, owners, isValid} = this.state;

    return (
      <Fragment>
        {(paths || urls) && (
          <Candidates>
            {paths &&
              paths.map(v => (
                <RuleCandidate
                  key={v}
                  onClick={() => this.handleSelectCandidate(v, 'path')}
                >
                  <StyledIconAdd isCircled />
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
                  <StyledIconAdd isCircled />
                  <StyledTextOverflow>{v}</StyledTextOverflow>
                  <TypeHint>[URL]</TypeHint>
                </RuleCandidate>
              ))}
          </Candidates>
        )}
        <BuilderBar>
          <BuilderSelect
            deprecatedSelectControl
            name="select-type"
            value={type}
            showSearch={false}
            onChange={this.handleTypeChange}
            options={[
              {value: 'path', label: t('Path')},
              {value: 'tag', label: t('Tag')},
              {value: 'url', label: t('URL')},
            ]}
            style={{width: 140}}
            clearable={false}
            disabled={disabled}
          />
          {type === 'tag' && (
            <BuilderTagNameInput
              controlled
              value={tagName}
              onChange={this.handleTagNameChangeValue}
              disabled={disabled}
              placeholder="tag-name"
            />
          )}
          <BuilderInput
            controlled
            value={text}
            onChange={this.handleChangeValue}
            disabled={disabled}
            placeholder={getMatchPlaceholder(type)}
          />
          <Divider direction="right" />
          <SelectOwnersWrapper>
            <SelectOwners
              organization={organization}
              project={project}
              value={owners}
              onChange={this.handleChangeOwners}
              disabled={disabled}
            />
          </SelectOwnersWrapper>

          <AddButton
            priority="primary"
            disabled={!isValid}
            onClick={this.handleAddRule}
            icon={<IconAdd size="xs" isCircled />}
            size="small"
          />
        </BuilderBar>
      </Fragment>
    );
  }
}
const Candidates = styled('div')`
  margin-bottom: 10px;
`;

const TypeHint = styled('div')`
  color: ${p => p.theme.borderDark};
`;

const StyledTextOverflow = styled(TextOverflow)`
  flex: 1;
`;

const RuleCandidate = styled('div')`
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

const StyledIconAdd = styled(IconAdd)`
  color: ${p => p.theme.borderDark};
  margin-right: 5px;
  flex-shrink: 0;
`;

const BuilderBar = styled('div')`
  display: flex;
  height: 40px;
  align-items: center;
  margin-bottom: ${space(2)};
`;

const BuilderSelect = styled(SelectField)`
  margin-right: ${space(1.5)};
  width: 50px;
  flex-shrink: 0;
`;

const BuilderInput = styled(Input)`
  padding: ${space(1)};
  line-height: 19px;
  margin-right: ${space(0.5)};
`;

const BuilderTagNameInput = styled(Input)`
  padding: ${space(1)};
  line-height: 19px;
  margin-right: ${space(0.5)};
  width: 200px;
`;

const Divider = styled(IconChevron)`
  color: ${p => p.theme.borderDark};
  flex-shrink: 0;
  margin-right: 5px;
`;

const SelectOwnersWrapper = styled('div')`
  display: flex;
  align-items: center;
  margin-right: ${space(1)};
`;

const AddButton = styled(Button)`
  padding: ${space(0.5)}; /* this sizes the button up to align with the inputs */
`;

export default RuleBuilder;
