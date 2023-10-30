import {Component, Fragment} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import TextArea from 'sentry/components/forms/controls/textarea';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import TimeSince from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import MemberListStore from 'sentry/stores/memberListStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import {Organization, Project, Team} from 'sentry/types';
import {defined} from 'sentry/utils';
import {trackIntegrationAnalytics} from 'sentry/utils/integrationUtil';

import RuleBuilder from './ruleBuilder';

const defaultProps = {
  urls: [] as string[],
  paths: [] as string[],
  disabled: false,
};

type Props = {
  dateUpdated: string | null;
  initialText: string;
  onCancel: () => void;
  organization: Organization;
  /**
   * Used for analytics
   */
  page: 'issue_details' | 'project_settings';
  project: Project;
  onSave?: (text: string | null) => void;
} & typeof defaultProps;

type State = {
  error: null | {
    raw: string[];
  };
  hasChanges: boolean;
  text: string | null;
};

class OwnerInput extends Component<Props, State> {
  static defaultProps = defaultProps;

  state: State = {
    hasChanges: false,
    text: null,
    error: null,
  };

  parseError(error: State['error']) {
    const text = error?.raw?.[0];
    if (!text) {
      return null;
    }

    if (text.startsWith('Invalid rule owners:')) {
      return <InvalidOwners>{text}</InvalidOwners>;
    }
    return (
      <SyntaxOverlay line={parseInt(text.match(/line (\d*),/)?.[1] ?? '', 10) - 1} />
    );
  }

  handleUpdateOwnership = () => {
    const {organization, project, onSave, page, initialText} = this.props;
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
        this.setState(
          {
            hasChanges: false,
            text,
          },
          () => onSave && onSave(text)
        );
        trackIntegrationAnalytics('project_ownership.saved', {
          page,
          organization,
          net_change:
            (text?.split('\n').filter(x => x).length ?? 0) -
            initialText.split('\n').filter(x => x).length,
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
            t(
              'Unable to save issue ownership rule changes: %s',
              error.responseJSON.raw[0]
            )
          );
        } else {
          addErrorMessage(t('Unable to save issue ownership rule changes'));
        }
      });

    return request;
  };

  mentionableUsers() {
    return MemberListStore.getAll().map(member => ({
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
    const {initialText} = this.props;
    this.setState(
      ({text}) => ({
        text: (text || initialText) + '\n' + rule,
      }),
      this.handleUpdateOwnership
    );
  };

  render() {
    const {project, organization, disabled, urls, paths, initialText, dateUpdated} =
      this.props;
    const {hasChanges, text, error} = this.state;

    const hasStreamlineTargetingFeature = organization.features.includes(
      'streamline-targeting-context'
    );

    return (
      <Fragment>
        {!hasStreamlineTargetingFeature && (
          <RuleBuilder
            urls={urls}
            paths={paths}
            organization={organization}
            project={project}
            onAddRule={this.handleAddRule.bind(this)}
            disabled={disabled}
          />
        )}
        <div
          style={{position: 'relative'}}
          onKeyDown={e => {
            if (e.metaKey && e.key === 'Enter') {
              this.handleUpdateOwnership();
            }
          }}
        >
          <Panel>
            <PanelHeader>
              {t('Ownership Rules')}

              {dateUpdated && (
                <SyncDate>
                  {t('Last Edited')} <TimeSince date={dateUpdated} />
                </SyncDate>
              )}
            </PanelHeader>
            <PanelBody>
              <StyledTextArea
                aria-label={t('Ownership Rules')}
                placeholder={
                  '#example usage\n' +
                  'path:src/example/pipeline/* person@sentry.io #infra\n' +
                  'module:com.module.name.example #sdks\n' +
                  'url:http://example.com/settings/* #product\n' +
                  'tags.sku_class:enterprise #enterprise'
                }
                monospace
                onChange={this.handleChange}
                disabled={disabled}
                value={defined(text) ? text : initialText}
                spellCheck="false"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
              />
            </PanelBody>
          </Panel>
          <ActionBar>
            <div>{this.parseError(error)}</div>
            <ButtonBar gap={1}>
              <Button type="button" size="sm" onClick={this.props.onCancel}>
                {t('Cancel')}
              </Button>
              <Button
                size="sm"
                priority="primary"
                onClick={this.handleUpdateOwnership}
                disabled={disabled || !hasChanges}
              >
                {t('Save')}
              </Button>
            </ButtonBar>
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
  padding-top: 10px;
`;

const SyntaxOverlay = styled('div')<{line: number}>`
  position: absolute;
  top: ${({line}) => TEXTAREA_PADDING + line * TEXTAREA_LINE_HEIGHT + 1}px;
  width: 100%;
  height: ${TEXTAREA_LINE_HEIGHT}px;
  background-color: ${p => p.theme.error};
  opacity: 0.1;
  pointer-events: none;
`;

const StyledTextArea = styled(TextArea)`
  min-height: 140px;
  overflow: auto;
  outline: 0;
  width: 100%;
  resize: none;
  margin: 1px 0 0 0;
  word-break: break-all;
  white-space: pre-wrap;
  padding-top: ${TEXTAREA_PADDING}px;
  line-height: ${TEXTAREA_LINE_HEIGHT}px;
  height: 450px;
  border-width: 0;
  border-top-left-radius: 0;
  border-top-right-radius: 0;
`;

const InvalidOwners = styled('div')`
  color: ${p => p.theme.error};
  font-weight: bold;
  margin-top: 12px;
`;

const SyncDate = styled('div')`
  font-weight: normal;
  text-transform: none;
`;

export default OwnerInput;
