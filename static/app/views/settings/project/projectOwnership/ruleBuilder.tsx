import * as React from 'react';
import styled from '@emotion/styled';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import Button from 'sentry/components/button';
import SelectField from 'sentry/components/deprecatedforms/selectField';
import Input from 'sentry/components/forms/controls/input';
import Tag from 'sentry/components/tag';
import TextOverflow from 'sentry/components/textOverflow';
import {IconAdd, IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import MemberListStore from 'sentry/stores/memberListStore';
import space from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import SelectOwners, {
  Owner,
} from 'sentry/views/settings/project/projectOwnership/selectOwners';

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
  disabled: boolean;
  onAddRule: (rule: string) => void;
  organization: Organization;
  paths: string[];
  project: Project;
  urls: string[];
};

type State = {
  isValid: boolean;
  owners: Owner[];
  tagName: string;
  text: string;
  type: string;
};

class RuleBuilder extends React.Component<Props, State> {
  state: State = initialState;

  checkIsValid = () => {
    this.setState(state => ({
      isValid: !!state.text && state.owners && !!state.owners.length,
    }));
  };

  handleTypeChange = (val: string | number | boolean) => {
    this.setState({type: val as string}); // TODO(ts): Add select value type as generic to select controls
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
                  <Tag>{t('Path')}</Tag>
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
                  <Tag>{t('URL')}</Tag>
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
            aria-label={t('Add rule')}
          />
        </BuilderBar>
      </React.Fragment>
    );
  }
}
const Candidates = styled('div')`
  margin-bottom: 10px;
`;

const StyledTextOverflow = styled(TextOverflow)`
  flex: 1;
`;

const RuleCandidate = styled('div')`
  font-family: ${p => p.theme.text.familyMono};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  background-color: ${p => p.theme.background};
  padding: ${space(0.25)} ${space(0.5)};
  margin-bottom: ${space(0.5)};
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
