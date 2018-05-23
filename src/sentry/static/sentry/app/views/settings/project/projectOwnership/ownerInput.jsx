import {Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';
import TextareaAutosize from 'react-autosize-textarea';

import {Client} from 'app/api';
import memberListStore from 'app/stores/memberListStore';
import ProjectsStore from 'app/stores/projectsStore';
import Button from 'app/components/buttons/button';
import SentryTypes from 'app/proptypes';
import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {t} from 'app/locale';
import {inputStyles} from 'app/styles/input';
import RuleBuilder from 'app/views/settings/project/projectOwnership/ruleBuilder';

class OwnerInput extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization,
    project: SentryTypes.Project,
    initialText: PropTypes.string,
    urls: PropTypes.arrayOf(PropTypes.string),
    paths: PropTypes.arrayOf(PropTypes.string),
  };

  constructor(props) {
    super(props);
    this.state = {
      text: props.initialText,
      initialText: props.initialText,
      error: null,
    };
  }

  componentWillReceiveProps({initialText}) {
    if (initialText != this.state.initialText) {
      this.setState({initialText});
    }
  }

  parseError(error) {
    let text = error && error.raw && error.raw[0];
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
    let {organization, project} = this.props;
    let {text} = this.state;
    this.setState({error: null});

    const api = new Client();
    let request = api.requestPromise(
      `/projects/${organization.slug}/${project.slug}/ownership/`,
      {
        method: 'PUT',
        data: {raw: text || ''},
      }
    );

    request
      .then(() => {
        addSuccessMessage(t('Updated ownership rules'));
        this.setState({
          initialText: text,
        });
      })
      .catch(error => {
        this.setState({error: error.responseJSON});
        if (error.status === 403) {
          addErrorMessage(
            t("You don't have permission to modify ownership rules for this project")
          );
        } else if (
          error.status === 400 &&
          error.responseJSON.raw &&
          error.responseJSON.raw[0].startsWith('Invalid rule owners:')
        ) {
          addErrorMessage(
            t('Unable to save ownership rules changes: ' + error.responseJSON.raw[0])
          );
        } else {
          addErrorMessage(t('Unable to save ownership rules changes'));
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
    let {project} = this.props;
    return (ProjectsStore.getBySlug(project.slug) || {
      teams: [],
    }).teams.map(team => ({
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
    let {project, organization, urls, paths} = this.props;
    let {text, error, initialText} = this.state;

    return (
      <React.Fragment>
        <RuleBuilder
          urls={urls}
          paths={paths}
          organization={organization}
          project={project}
          onAddRule={this.handleAddRule.bind(this)}
        />
        <div
          style={{position: 'relative'}}
          onKeyDown={e => {
            if (e.metaKey && e.key == 'Enter') {
              this.handleUpdateOwnership();
            }
          }}
        >
          <StyledTextArea
            placeholder={
              '#example usage\npath:src/example/pipeline/* person@sentry.io #infra\nurl:http://example.com/settings/* #product'
            }
            onChange={this.handleChange}
            value={text}
            spellCheck="false"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
          />
          <Flex align="center" justify="space-between">
            <div>{this.parseError(error)}</div>
            <SaveButton>
              <Button
                size="small"
                priority="primary"
                onClick={this.handleUpdateOwnership}
                disabled={text === initialText}
              >
                {t('Save Changes')}
              </Button>
            </SaveButton>
          </Flex>
        </div>
      </React.Fragment>
    );
  }
}

const TEXTAREA_PADDING = 4;
const TEXTAREA_LINE_HEIGHT = 24;

const SyntaxOverlay = styled.div`
  ${inputStyles};
  width: 100%;
  height: ${TEXTAREA_LINE_HEIGHT}px;
  background-color: red;
  opacity: 0.1;
  pointer-events: none;
  position: absolute;
  top: ${({line}) => TEXTAREA_PADDING + line * 24}px;
`;

const SaveButton = styled.div`
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
