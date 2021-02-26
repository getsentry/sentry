import React from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {openModal} from 'app/actionCreators/modal';
import {promptsCheck, promptsUpdate} from 'app/actionCreators/prompts';
import Access from 'app/components/acl/access';
import AsyncComponent from 'app/components/asyncComponent';
import Button from 'app/components/button';
import {IconClose} from 'app/icons/iconClose';
import {t, tct} from 'app/locale';
import {
  Frame,
  Integration,
  Organization,
  Project,
  RepositoryProjectPathConfigWithIntegration,
} from 'app/types';
import {Event} from 'app/types/event';
import {getIntegrationIcon, trackIntegrationEvent} from 'app/utils/integrationUtil';
import {promptIsDismissed} from 'app/utils/promptIsDismissed';
import withOrganization from 'app/utils/withOrganization';
import withProjects from 'app/utils/withProjects';

import {OpenInContainer, OpenInLink, OpenInName} from './openInContextLine';
import StacktraceLinkModal from './stacktraceLinkModal';

type Props = AsyncComponent['props'] & {
  frame: Frame;
  event: Event;
  organization: Organization;
  lineNo: number;
  projects: Project[];
};

//format of the ProjectStacktraceLinkEndpoint response
type StacktraceResultItem = {
  integrations: Integration[];
  config?: RepositoryProjectPathConfigWithIntegration;
  sourceUrl?: string;
  error?: 'file_not_found' | 'stack_root_mismatch';
};

type State = AsyncComponent['state'] & {
  match: StacktraceResultItem;
  isDismissed: boolean;
  promptLoaded: boolean;
};

class StacktraceLink extends AsyncComponent<Props, State> {
  get project() {
    // we can't use the withProject HoC on an the issue page
    // so we ge around that by using the withProjects HoC
    // and look up the project from the list
    const {projects, event} = this.props;
    return projects.find(project => project.id === event.projectID);
  }
  get match() {
    return this.state.match;
  }
  get config() {
    return this.match.config;
  }

  get integrations() {
    return this.match.integrations;
  }

  get errorText() {
    const error = this.match.error;

    switch (error) {
      case 'stack_root_mismatch':
        return t('Error matching your configuration, check your stack trace root.');
      case 'file_not_found':
        return t(
          'Could not find source file, check your repository and source code root.'
        );
      default:
        return t('There was an error encountered with the code mapping for this project');
    }
  }

  componentDidMount() {
    this.promptsCheck();
  }

  async promptsCheck() {
    const {organization} = this.props;

    const prompt = await promptsCheck(this.api, {
      organizationId: organization.id,
      projectId: this.project?.id,
      feature: 'stacktrace_link',
    });

    this.setState({
      isDismissed: promptIsDismissed(prompt),
      promptLoaded: true,
    });
  }

  dismissPrompt() {
    const {organization} = this.props;
    promptsUpdate(this.api, {
      organizationId: organization.id,
      projectId: this.project?.id,
      feature: 'stacktrace_link',
      status: 'dismissed',
    });

    trackIntegrationEvent(
      'integrations.stacktrace_link_cta_dismissed',
      {
        view: 'stacktrace_issue_details',
      },
      this.props.organization
    );

    this.setState({isDismissed: true});
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {organization, frame, event} = this.props;
    const project = this.project;
    if (!project) {
      throw new Error('Unable to find project');
    }
    const commitId = event.release?.lastCommit?.id;
    const platform = event.platform;
    return [
      [
        'match',
        `/projects/${organization.slug}/${project.slug}/stacktrace-link/`,
        {query: {file: frame.filename, platform, commitId}},
      ],
    ];
  }

  onRequestError(error, args) {
    Sentry.withScope(scope => {
      scope.setExtra('errorInfo', args);
      Sentry.captureException(new Error(error));
    });
  }

  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      showModal: false,
      sourceCodeInput: '',
      match: {integrations: []},
      isDismissed: false,
      promptLoaded: false,
    };
  }

  onOpenLink() {
    const provider = this.config?.provider;
    if (provider) {
      trackIntegrationEvent(
        'integrations.stacktrace_link_clicked',
        {
          view: 'stacktrace_issue_details',
          provider: provider.key,
        },
        this.props.organization,
        {startSession: true}
      );
    }
  }

  onReconfigureMapping() {
    const provider = this.config?.provider;
    const error = this.match.error;
    if (provider) {
      trackIntegrationEvent(
        'integrations.reconfigure_stacktrace_setup',
        {
          view: 'stacktrace_issue_details',
          provider: provider.key,
          error_reason: error,
        },
        this.props.organization,
        {startSession: true}
      );
    }
  }

  handleSubmit = () => {
    this.reloadData();
  };

  // don't show the error boundary if the component fails.
  // capture the endpoint error on onRequestError
  renderError(): React.ReactNode {
    return null;
  }

  renderLoading() {
    //TODO: Add loading
    return null;
  }

  renderNoMatch() {
    const {organization} = this.props;
    const filename = this.props.frame.filename;
    const platform = this.props.event.platform;
    if (this.project && this.integrations.length > 0 && filename) {
      return (
        <Access organization={organization} access={['org:integrations']}>
          {({hasAccess}) =>
            hasAccess && (
              <CodeMappingButtonContainer columnQuantity={2}>
                {tct('[link:Link your stack trace to your source code.]', {
                  link: (
                    <a
                      onClick={() => {
                        trackIntegrationEvent(
                          'integrations.stacktrace_start_setup',
                          {
                            view: 'stacktrace_issue_details',
                            platform,
                          },
                          this.props.organization,
                          {startSession: true}
                        );
                        openModal(
                          deps =>
                            this.project && (
                              <StacktraceLinkModal
                                onSubmit={this.handleSubmit}
                                filename={filename}
                                project={this.project}
                                organization={organization}
                                integrations={this.integrations}
                                {...deps}
                              />
                            )
                        );
                      }}
                    />
                  ),
                })}
                <StyledIconClose size="xs" onClick={() => this.dismissPrompt()} />
              </CodeMappingButtonContainer>
            )
          }
        </Access>
      );
    }
    return null;
  }

  renderMatchNoUrl() {
    const {config} = this.match;
    const {organization} = this.props;
    const text = this.errorText;
    const url = `/settings/${organization.slug}/integrations/${config?.provider.key}/${config?.integrationId}/?tab=codeMappings`;
    return (
      <CodeMappingButtonContainer columnQuantity={2}>
        {text}
        <Button onClick={() => this.onReconfigureMapping()} to={url} size="xsmall">
          {t('Configure Stack Trace Linking')}
        </Button>
      </CodeMappingButtonContainer>
    );
  }
  renderMatchWithUrl(config: RepositoryProjectPathConfigWithIntegration, url: string) {
    url = `${url}#L${this.props.frame.lineNo}`;
    return (
      <OpenInContainer columnQuantity={2}>
        <div>{t('Open this line in')}</div>
        <OpenInLink onClick={() => this.onOpenLink()} href={url} openInNewTab>
          {getIntegrationIcon(config.provider.key)}
          <OpenInName>{config.provider.name}</OpenInName>
        </OpenInLink>
      </OpenInContainer>
    );
  }

  renderBody() {
    const {config, sourceUrl} = this.match || {};
    const {isDismissed, promptLoaded} = this.state;

    if (config && sourceUrl) {
      return this.renderMatchWithUrl(config, sourceUrl);
    }
    if (config) {
      return this.renderMatchNoUrl();
    }

    if (!promptLoaded || (promptLoaded && isDismissed)) {
      return null;
    }

    return this.renderNoMatch();
  }
}

export default withProjects(withOrganization(StacktraceLink));
export {StacktraceLink};

export const CodeMappingButtonContainer = styled(OpenInContainer)`
  justify-content: space-between;
`;

const StyledIconClose = styled(IconClose)`
  margin: auto;
  cursor: pointer;
`;
