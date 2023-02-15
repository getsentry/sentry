import {Component, Fragment} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/button';
import SelectControl from 'sentry/components/forms/controls/selectControl';
import Input from 'sentry/components/input';
import Tag from 'sentry/components/tag';
import TextOverflow from 'sentry/components/textOverflow';
import {IconAdd, IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import MemberListStore from 'sentry/stores/memberListStore';
import {space} from 'sentry/styles/space';
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
    case 'module':
      return 'com.module.name.example';
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

class RuleBuilder extends Component<Props, State> {
  state: State = initialState;

  checkIsValid = () => {
    this.setState(state => ({
      isValid: !!state.text && state.owners && !!state.owners.length,
    }));
  };

  handleTypeChange = (option: {label: string; value: string}) => {
    this.setState({type: option.value});
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

    const hasCandidates = paths || urls;

    return (
      <Fragment>
        {hasCandidates && (
          <Candidates>
            {paths.map(v => (
              <RuleCandidate
                key={v}
                role="button"
                aria-label={t('Path rule candidate')}
                onClick={() => this.handleSelectCandidate(v, 'path')}
              >
                <IconAdd color="border" isCircled />
                <TextOverflow>{v}</TextOverflow>
                <Tag>{t('Path')}</Tag>
              </RuleCandidate>
            ))}
            {urls.map(v => (
              <RuleCandidate
                key={v}
                role="button"
                aria-label={t('URL rule candidate')}
                onClick={() => this.handleSelectCandidate(v, 'url')}
              >
                <IconAdd color="border" isCircled />
                <TextOverflow>{v}</TextOverflow>
                <Tag>{t('URL')}</Tag>
              </RuleCandidate>
            ))}
          </Candidates>
        )}
        <BuilderBar>
          <BuilderSelect
            aria-label={t('Rule type')}
            name="select-type"
            value={type}
            onChange={this.handleTypeChange}
            options={[
              {value: 'path', label: t('Path')},
              {value: 'module', label: t('Module')},
              {value: 'tag', label: t('Tag')},
              {value: 'url', label: t('URL')},
            ]}
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
          <Input
            value={text}
            onChange={this.handleChangeValue}
            disabled={disabled}
            placeholder={getMatchPlaceholder(type)}
            aria-label={t('Rule pattern')}
          />
          <IconChevron color="border" direction="right" />
          <SelectOwners
            organization={organization}
            project={project}
            value={owners}
            onChange={this.handleChangeOwners}
            disabled={disabled}
          />
          <Button
            priority="primary"
            disabled={!isValid}
            onClick={this.handleAddRule}
            icon={<IconAdd isCircled />}
            aria-label={t('Add rule')}
          />
        </BuilderBar>
      </Fragment>
    );
  }
}
const Candidates = styled('div')`
  margin-bottom: 10px;
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
  gap: ${space(0.5)};
  align-items: center;
`;

const BuilderBar = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
  margin-bottom: ${space(2)};
`;

const BuilderSelect = styled(SelectControl)`
  width: 140px;
  flex-shrink: 0;
`;

const BuilderTagNameInput = styled(Input)`
  width: 200px;
`;

export default RuleBuilder;
