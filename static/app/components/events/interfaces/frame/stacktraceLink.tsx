import {Fragment} from 'react';
import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import {promptsCheck, promptsUpdate} from 'sentry/actionCreators/prompts';
import {ResponseMeta} from 'sentry/api';
import AsyncComponent from 'sentry/components/asyncComponent';
import {Hovercard} from 'sentry/components/hovercard';
import Link from 'sentry/components/links/link';
import {IconInfo} from 'sentry/icons';
import {IconClose} from 'sentry/icons/iconClose';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {
  Frame,
  Integration,
  Organization,
  Project,
  RepositoryProjectPathConfigWithIntegration,
} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {StacktraceLinkEvents} from 'sentry/utils/analytics/integrations/stacktraceLinkAnalyticsEvents';
import {getAnalyicsDataForEvent} from 'sentry/utils/events';
import handleXhrErrorResponse from 'sentry/utils/handleXhrErrorResponse';
import {
  getIntegrationIcon,
  trackIntegrationAnalytics,
} from 'sentry/utils/integrationUtil';
import {promptIsDismissed} from 'sentry/utils/promptIsDismissed';
import withOrganization from 'sentry/utils/withOrganization';
import withProjects from 'sentry/utils/withProjects';

import {OpenInContainer, OpenInLink, OpenInName} from './openInContextLine';
import StacktraceLinkModal from './stacktraceLinkModal';

type Props = AsyncComponent['props'] & {
  event: Event;
  frame: Frame;
  lineNo: number;
  organization: Organization;
  projects: Project[];
};

export type StacktraceErrorMessage =
  | 'file_not_found'
  | 'stack_root_mismatch'
  | 'integration_link_forbidden';

// format of the ProjectStacktraceLinkEndpoint response
type StacktraceResultItem = {
  integrations: Integration[];
  attemptedUrl?: string;
  config?: RepositoryProjectPathConfigWithIntegration;
  error?: StacktraceErrorMessage;
  sourceUrl?: string;
};

type State = AsyncComponent['state'] & {
  isDismissed: boolean;
  match: StacktraceResultItem;
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

  get errorText() {
    const error = this.state.match.error;

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
      ...getAnalyicsDataForEvent(this.props.event),
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
    const sdkName = event.sdk?.name;
    return [
      [
        'match',
        `/projects/${organization.slug}/${project.slug}/stacktrace-link/`,
        {
          query: {
            file: frame.filename,
            platform,
            commitId,
            ...(sdkName && {sdkName}),
            ...(frame.absPath && {absPath: frame.absPath}),
            ...(frame.module && {module: frame.module}),
            ...(frame.package && {package: frame.package}),
          },
        },
      ],
    ];
  }

  onRequestSuccess(resp: {data: StacktraceResultItem; stateKey: 'match'}) {
    const {config, sourceUrl} = resp.data;
    trackIntegrationAnalytics('integrations.stacktrace_link_viewed', {
      view: 'stacktrace_issue_details',
      organization: this.props.organization,
      platform: this.project?.platform,
      project_id: this.project?.id,
      state:
        // Should follow the same logic in render
        config && sourceUrl
          ? 'match'
          : config
          ? 'no_match'
          : !this.state.isDismissed
          ? 'prompt'
          : 'empty',
      ...getAnalyicsDataForEvent(this.props.event),
    });
  }

  onRequestError(resp: ResponseMeta) {
    handleXhrErrorResponse('Unable to fetch stack trace link')(resp);
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
    const provider = this.state.match.config?.provider;
    if (provider) {
      trackIntegrationAnalytics(
        StacktraceLinkEvents.OPEN_LINK,
        {
          view: 'stacktrace_issue_details',
          provider: provider.key,
          organization: this.props.organization,
          ...getAnalyicsDataForEvent(this.props.event),
        },
        {startSession: true}
      );
    }
  }

  onReconfigureMapping() {
    const provider = this.state.match.config?.provider;
    const error = this.state.match.error;
    if (provider) {
      trackIntegrationAnalytics(
        'integrations.reconfigure_stacktrace_setup',
        {
          view: 'stacktrace_issue_details',
          provider: provider.key,
          error_reason: error,
          organization: this.props.organization,
          ...getAnalyicsDataForEvent(this.props.event),
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
    const {integrations} = this.state.match;
    if (this.project && integrations.length > 0 && filename) {
      return (
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
                      ...getAnalyicsDataForEvent(this.props.event),
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
                          integrations={integrations}
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
      );
    }
    return null;
  }

  renderHovercard() {
    const {frame} = this.props;
    const {config, error, attemptedUrl} = this.state.match;
    return (
      <StyledHovercard
        skipWrapper
        header={
          <HovercardHeader>
            {error === 'stack_root_mismatch'
              ? t('Mismatch between filename and stack root')
              : t('Unable to find source code url')}
          </HovercardHeader>
        }
        body={
          <HovercardBody>
            {error === 'stack_root_mismatch' ? (
              <Fragment>
                <div>
                  filename: <code>{`${frame.filename}`}</code>
                </div>
                <div>
                  stack root: <code>{`${config?.stackRoot}`}</code>
                </div>
              </Fragment>
            ) : (
              attemptedUrl
            )}
          </HovercardBody>
        }
      >
        <StyledIconInfo size="xs" aria-label={t('More Info')} />
      </StyledHovercard>
    );
  }

  renderMatchNoUrl() {
    const {config, error} = this.state.match;
    const {organization} = this.props;
    return (
      <CodeMappingButtonContainer columnQuantity={2}>
        <ErrorInformation>
          {error && this.renderHovercard()}
          <ErrorText>{this.errorText}</ErrorText>
          {tct('[link:Configure Stack Trace Linking] to fix this problem.', {
            link: (
              <Link
                onClick={() => {
                  this.onReconfigureMapping();
                }}
                to={{
                  pathname: `/settings/${organization.slug}/integrations/${config?.provider.key}/${config?.integrationId}/`,
                  query: {tab: 'codeMappings'},
                }}
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
          <StyledIconWrapper>{getIntegrationIcon(config.provider.key)}</StyledIconWrapper>
          <OpenInName>{config.provider.name}</OpenInName>
        </OpenInLink>
      </OpenInContainer>
    );
  }

  renderBody() {
    const {config, sourceUrl} = this.state.match || {};
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

const StyledIconWrapper = styled('span')`
  color: inherit;
  line-height: 0;
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
`;

const HovercardHeader = styled('span')`
  font-weight: strong;
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
`;

const HovercardBody = styled('span')`
  font-weight: normal;
  font-size: ${p => p.theme.fontSizeSmall};
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
  line-height: 1.2;
`;

const ErrorInformation = styled('div')`
  padding-right: 5px;
  margin-right: ${space(1)};
`;
const ErrorText = styled('span')`
  margin-right: ${space(0.5)};
`;
