import * as React from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {openModal} from 'app/actionCreators/modal';
import {promptsCheck, promptsUpdate} from 'app/actionCreators/prompts';
import Access from 'app/components/acl/access';
import AsyncComponent from 'app/components/asyncComponent';
import {Body, Header, Hovercard} from 'app/components/hovercard';
import {IconInfo} from 'app/icons';
import {IconClose} from 'app/icons/iconClose';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {
  Frame,
  Integration,
  Organization,
  Project,
  RepositoryProjectPathConfigWithIntegration,
} from 'app/types';
import {Event} from 'app/types/event';
import {getIntegrationIcon, trackIntegrationAnalytics} from 'app/utils/integrationUtil';
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

export type StacktraceErrorMessage =
  | 'file_not_found'
  | 'stack_root_mismatch'
  | 'integration_link_forbidden';

// format of the ProjectStacktraceLinkEndpoint response
type StacktraceResultItem = {
  integrations: Integration[];
  config?: RepositoryProjectPathConfigWithIntegration;
  sourceUrl?: string;
  error?: StacktraceErrorMessage;
  attemptedUrl?: string;
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
        return t('Error matching your configuration.');
      case 'file_not_found':
        return t('Source file not found.');
      case 'integration_link_forbidden':
        return t('The repository integration was disconnected.');
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

    trackIntegrationAnalytics('integrations.stacktrace_link_cta_dismissed', {
      view: 'stacktrace_issue_details',
      organization,
    });

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
      trackIntegrationAnalytics(
        'integrations.stacktrace_link_clicked',
        {
          view: 'stacktrace_issue_details',
          provider: provider.key,
          organization: this.props.organization,
        },
        {startSession: true}
      );
    }
  }

  onReconfigureMapping() {
    const provider = this.config?.provider;
    const error = this.match.error;
    if (provider) {
      trackIntegrationAnalytics(
        'integrations.reconfigure_stacktrace_setup',
        {
          view: 'stacktrace_issue_details',
          provider: provider.key,
          error_reason: error,
          organization: this.props.organization,
        },
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
    // TODO: Add loading
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
                        trackIntegrationAnalytics(
                          'integrations.stacktrace_start_setup',
                          {
                            view: 'stacktrace_issue_details',
                            platform,
                            organization,
                          },
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

  renderHovercard() {
    const error = this.match.error;
    const url = this.match.attemptedUrl;
    const {frame} = this.props;
    const {config} = this.match;
    return (
      <React.Fragment>
        <StyledHovercard
          header={
            error === 'stack_root_mismatch' ? (
              <span>{t('Mismatch between filename and stack root')}</span>
            ) : (
              <span>{t('Unable to find source code url')}</span>
            )
          }
          body={
            error === 'stack_root_mismatch' ? (
              <HeaderContainer>
                <HovercardLine>
                  filename: <code>{`${frame.filename}`}</code>
                </HovercardLine>
                <HovercardLine>
                  stack root: <code>{`${config?.stackRoot}`}</code>
                </HovercardLine>
              </HeaderContainer>
            ) : (
              <HeaderContainer>
                <HovercardLine>{url}</HovercardLine>
              </HeaderContainer>
            )
          }
        >
          <StyledIconInfo size="xs" />
        </StyledHovercard>
      </React.Fragment>
    );
  }

  renderMatchNoUrl() {
    const {config, error} = this.match;
    const {organization} = this.props;
    const url = `/settings/${organization.slug}/integrations/${config?.provider.key}/${config?.integrationId}/?tab=codeMappings`;
    return (
      <CodeMappingButtonContainer columnQuantity={2}>
        <ErrorInformation>
          {error && this.renderHovercard()}
          <ErrorText>{this.errorText}</ErrorText>
          {tct('[link:Configure Stack Trace Linking] to fix this problem.', {
            link: (
              <a
                onClick={() => {
                  this.onReconfigureMapping();
                }}
                href={url}
              />
            ),
          })}
        </ErrorInformation>
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

const StyledIconInfo = styled(IconInfo)`
  margin-right: ${space(0.5)};
  margin-bottom: -2px;
  cursor: pointer;
  line-height: 0;
`;

const StyledHovercard = styled(Hovercard)`
  font-weight: normal;
  width: inherit;
  line-height: 0;
  ${Header} {
    font-weight: strong;
    font-size: ${p => p.theme.fontSizeSmall};
    color: ${p => p.theme.subText};
  }
  ${Body} {
    font-weight: normal;
    font-size: ${p => p.theme.fontSizeSmall};
  }
`;
const HeaderContainer = styled('div')`
  width: 100%;
  display: flex;
  justify-content: space-between;
`;
const HovercardLine = styled('div')`
  padding-bottom: 3px;
`;

const ErrorInformation = styled('div')`
  padding-right: 5px;
  margin-right: ${space(1)};
`;
const ErrorText = styled('span')`
  margin-right: ${space(0.5)};
`;
