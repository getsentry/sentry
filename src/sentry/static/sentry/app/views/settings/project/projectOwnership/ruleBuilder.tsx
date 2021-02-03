import React from 'react';
import styled from '@emotion/styled';

import {addErrorMessage} from 'app/actionCreators/indicator';
import Button from 'app/components/button';
import SelectField from 'app/components/forms/selectField';
import TextOverflow from 'app/components/textOverflow';
import {IconAdd, IconChevron} from 'app/icons';
import {t} from 'app/locale';
import MemberListStore from 'app/stores/memberListStore';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import Input from 'app/views/settings/components/forms/controls/input';
import SelectOwners, {
  Owner,
} from 'app/views/settings/project/projectOwnership/selectOwners';

const initialState = {
  text: '',
  tagName: '',
  type: 'path',
  owners: [],
  isValid: false,
};

function getMatchPlaceholder(type: string): string {
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

type Props = {
  organization: Organization;
  project: Project;
  onAddRule: (rule: string) => void;
  urls: string[];
  paths: string[];
  disabled: boolean;
};

type State = {
  text: string;
  tagName: string;
  type: string;
  owners: Owner[];
  isValid: boolean;
};

class RuleBuilder extends React.Component<Props, State> {
  state: State = initialState;

  checkIsValid = () => {
    this.setState(state => ({
      isValid: !!state.text && state.owners && !!state.owners.length,
    }));
  };

  handleTypeChange = (val: string) => {
    this.setState({type: val});
    this.checkIsValid();
  };

  handleTagNameChangeValue = (e: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({tagName: e.target.value}, this.checkIsValid);
  };

  handleChangeValue = (e: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({text: e.target.value});
    this.checkIsValid();
  };

  handleChangeOwners = (owners: Owner[]) => {
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
          : MemberListStore.getById(owner.actor.id)?.email
      )
      .join(' ');

    const quotedText = text.match(/\s/) ? `"${text}"` : text;

    const rule = `${
      type === 'tag' ? `tags.${tagName}` : type
    }:${quotedText} ${ownerText}`;
    this.props.onAddRule(rule);
    this.setState(initialState);
  };

  handleSelectCandidate = (text: string, type: string) => {
    this.setState({text, type});
    this.checkIsValid();
  };

  render() {
    const {urls, paths, disabled, project, organization} = this.props;
    const {type, text, tagName, owners, isValid} = this.state;

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
            name="select-type"
            value={type}
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
              value={tagName}
              onChange={this.handleTagNameChangeValue}
              disabled={disabled}
              placeholder="tag-name"
            />
          )}
          <BuilderInput
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
            icon={<IconAdd isCircled />}
            size="small"
          />
        </BuilderBar>
      </React.Fragment>
    );
  }
}
const Candidates = styled('div')`
  margin-bottom: 10px;
`;

const TypeHint = styled('div')`
  color: ${p => p.theme.border};
`;

const StyledTextOverflow = styled(TextOverflow)`
  flex: 1;
`;

const RuleCandidate = styled('div')`
  font-family: ${p => p.theme.text.familyMono};
  border: 1px solid ${p => p.theme.border};
  background-color: #f8fafd;
  padding-left: 5px;
  margin-bottom: 3px;
  cursor: pointer;
  overflow: hidden;
  display: flex;
  align-items: center;
`;

const StyledIconAdd = styled(IconAdd)`
  color: ${p => p.theme.border};
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
  color: ${p => p.theme.border};
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
