import React from 'react';
import styled from '@emotion/styled';
import TextareaAutosize from 'react-autosize-textarea';

import {Client} from 'app/api';
import memberListStore from 'app/stores/memberListStore';
import ProjectsStore from 'app/stores/projectsStore';
import Button from 'app/components/button';
import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {t} from 'app/locale';
import {inputStyles} from 'app/styles/input';
import {Project, Organization, Team} from 'app/types';
import theme from 'app/utils/theme';

import RuleBuilder from './ruleBuilder';

const defaultProps = {
  urls: [] as string[],
  paths: [] as string[],
  disabled: false,
};

type Props = {
  organization: Organization;
  project: Project;
  initialText: string;
} & typeof defaultProps;

type State = {
  hasChanges: boolean;
  text: string;
  error: null | {
    raw: string[];
  };
};

class OwnerInput extends React.Component<Props, State> {
  static defaultProps = defaultProps;

  state: State = {
    hasChanges: false,
    text: '',
    error: null,
  };

  parseError(error: State['error']) {
    const text = error?.raw?.[0];
    if (!text) {
      return null;
    }

    if (text.startsWith('Invalid rule owners:')) {
      return <InvalidOwners>{text}</InvalidOwners>;
    } else {
      return (
        <SyntaxOverlay line={parseInt(text.match(/line (\d*),/)?.[1] ?? '', 10) - 1} />
      );
    }
  }

  handleUpdateOwnership = () => {
    const {organization, project} = this.props;
    const {text} = this.state;
    this.setState({error: null});

    const api = new Client();
    const request = api.requestPromise(
      `/projects/${organization.slug}/${project.slug}/ownership/`,
      {
        method: 'PUT',
        data: {raw: text || ''},
      }
    );

    request
      .then(() => {
        addSuccessMessage(t('Updated issue ownership rules'));
        this.setState({
          hasChanges: false,
          text,
        });
      })
      .catch(error => {
        this.setState({error: error.responseJSON});
        if (error.status === 403) {
          addErrorMessage(
            t(
              "You don't have permission to modify issue ownership rules for this project"
            )
          );
        } else if (
          error.status === 400 &&
          error.responseJSON.raw &&
          error.responseJSON.raw[0].startsWith('Invalid rule owners:')
        ) {
          addErrorMessage(
            t('Unable to save issue ownership rule changes: ' + error.responseJSON.raw[0])
          );
        } else {
          addErrorMessage(t('Unable to save issue ownership rule changes'));
        }
      });

    return request;
  };

  mentionableUsers() {
    return memberListStore.getAll().map(member => ({
      id: member.id,
      display: member.email,
      email: member.email,
    }));
  }

  mentionableTeams() {
    const {project} = this.props;
    const projectWithTeams = ProjectsStore.getBySlug(project.slug);
    if (!projectWithTeams) {
      return [];
    }
    return projectWithTeams.teams.map((team: Team) => ({
      id: team.id,
      display: `#${team.slug}`,
      email: team.id,
    }));
  }

  handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    this.setState({
      hasChanges: true,
      text: e.target.value,
    });
  };

  handleAddRule = (rule: string) => {
    this.setState(
      ({text}) => ({
        text: text + '\n' + rule,
      }),
      this.handleUpdateOwnership
    );
  };

  render() {
    const {project, organization, disabled, urls, paths, initialText} = this.props;
    const {hasChanges, text, error} = this.state;

    return (
      <React.Fragment>
        <RuleBuilder
          urls={urls}
          paths={paths}
          organization={organization}
          project={project}
          onAddRule={this.handleAddRule.bind(this)}
          disabled={disabled}
        />
        <div
          style={{position: 'relative'}}
          onKeyDown={e => {
            if (e.metaKey && e.key === 'Enter') {
              this.handleUpdateOwnership();
            }
          }}
        >
          <StyledTextArea
            placeholder={
              '#example usage\n' +
              'path:src/example/pipeline/* person@sentry.io #infra\n' +
              'url:http://example.com/settings/* #product\n' +
              'tags.sku_class:enterprise #enterprise'
            }
            onChange={this.handleChange}
            disabled={disabled}
            value={text || initialText}
            spellCheck="false"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            theme={theme}
          />
          <ActionBar>
            <div>{this.parseError(error)}</div>
            <SaveButton>
              <Button
                size="small"
                priority="primary"
                onClick={this.handleUpdateOwnership}
                disabled={disabled || !hasChanges}
              >
                {t('Save Changes')}
              </Button>
            </SaveButton>
          </ActionBar>
        </div>
      </React.Fragment>
    );
  }
}

const TEXTAREA_PADDING = 4;
const TEXTAREA_LINE_HEIGHT = 24;

const ActionBar = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const SyntaxOverlay = styled('div')<{line: number}>`
  ${inputStyles};
  width: 100%;
  height: ${TEXTAREA_LINE_HEIGHT}px;
  background-color: red;
  opacity: 0.1;
  pointer-events: none;
  position: absolute;
  top: ${({line}) => TEXTAREA_PADDING + line * 24}px;
`;

const SaveButton = styled('div')`
  text-align: end;
  padding-top: 10px;
`;

const StyledTextArea = styled(TextareaAutosize)`
  ${inputStyles};
  min-height: 140px;
  overflow: auto;
  outline: 0;
  width: 100%;
  resize: none;
  margin: 0;
  font-family: ${p => p.theme.text.familyMono};
  word-break: break-all;
  white-space: pre-wrap;
  padding-top: ${TEXTAREA_PADDING}px;
  line-height: ${TEXTAREA_LINE_HEIGHT}px;
`;

const InvalidOwners = styled('div')`
  color: ${p => p.theme.error};
  font-weight: bold;
  margin-top: 12px;
`;

export default OwnerInput;
