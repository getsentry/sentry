import PropTypes from 'prop-types';
import {Component, Fragment} from 'react';
import styled from '@emotion/styled';
import TextareaAutosize from 'react-autosize-textarea';

import {Client} from 'app/api';
import memberListStore from 'app/stores/memberListStore';
import ProjectsStore from 'app/stores/projectsStore';
import Button from 'app/components/button';
import SentryTypes from 'app/sentryTypes';
import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {t} from 'app/locale';
import {inputStyles} from 'app/styles/input';
import RuleBuilder from 'app/views/settings/project/projectOwnership/ruleBuilder';

class OwnerInput extends Component {
  static propTypes = {
    organization: SentryTypes.Organization,
    project: SentryTypes.Project,
    initialText: PropTypes.string,
    urls: PropTypes.arrayOf(PropTypes.string),
    paths: PropTypes.arrayOf(PropTypes.string),
    disabled: PropTypes.bool,
  };

  constructor(props) {
    super(props);
    this.state = {
      text: props.initialText,
      initialText: props.initialText,
      error: null,
    };
  }

  UNSAFE_componentWillReceiveProps({initialText}) {
    if (initialText !== this.state.initialText) {
      this.setState({initialText});
    }
  }

  parseError(error) {
    const text = error && error.raw && error.raw[0];
    if (!text) {
      return null;
    }

    if (text.startsWith('Invalid rule owners:')) {
      return <InvalidOwners>{text}</InvalidOwners>;
    } else {
      return <SyntaxOverlay line={text.match(/line (\d*),/)[1] - 1} />;
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
          initialText: text,
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
    return (
      ProjectsStore.getBySlug(project.slug) || {
        teams: [],
      }
    ).teams.map(team => ({
      id: team.id,
      display: `#${team.slug}`,
      email: team.id,
    }));
  }

  handleChange = e => {
    this.setState({text: e.target.value});
  };

  handleAddRule = rule => {
    this.setState(
      ({text}) => ({
        text: text + '\n' + rule,
      }),
      this.handleUpdateOwnership
    );
  };

  render() {
    const {project, organization, disabled, urls, paths} = this.props;
    const {text, error, initialText} = this.state;

    return (
      <Fragment>
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
            value={text}
            spellCheck="false"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
          />
          <ActionBar>
            <div>{this.parseError(error)}</div>
            <SaveButton>
              <Button
                size="small"
                priority="primary"
                onClick={this.handleUpdateOwnership}
                disabled={disabled || text === initialText}
              >
                {t('Save Changes')}
              </Button>
            </SaveButton>
          </ActionBar>
        </div>
      </Fragment>
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

const SyntaxOverlay = styled('div')`
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
