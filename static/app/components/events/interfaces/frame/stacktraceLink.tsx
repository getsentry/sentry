import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import {promptsCheck, promptsUpdate} from 'sentry/actionCreators/prompts';
import type {ResponseMeta} from 'sentry/api';
import AsyncComponent from 'sentry/components/asyncComponent';
import Button from 'sentry/components/button';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import Placeholder from 'sentry/components/placeholder';
import {IconClose} from 'sentry/icons/iconClose';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import type {
  Event,
  Frame,
  Organization,
  Project,
  StacktraceLinkResult,
} from 'sentry/types';
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

import {OpenInContainer} from './openInContextLine';
import StacktraceLinkModal from './stacktraceLinkModal';

type Props = AsyncComponent['props'] & {
  event: Event;
  frame: Frame;
  lineNo: number;
  organization: Organization;
  projects: Project[];
};

type State = AsyncComponent['state'] & {
  isDismissed: boolean;
  match: StacktraceLinkResult;
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

  dismissPrompt = () => {
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
  };

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

  onRequestSuccess(resp: {data: StacktraceLinkResult; stateKey: 'match'}) {
    const {error, integrations, sourceUrl} = resp.data;
    trackIntegrationAnalytics('integrations.stacktrace_link_viewed', {
      view: 'stacktrace_issue_details',
      organization: this.props.organization,
      platform: this.project?.platform,
      project_id: this.project?.id,
      state:
        // Should follow the same logic in render
        sourceUrl
          ? 'match'
          : error || integrations.length > 0
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

  onOpenLink = () => {
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
  };

  handleSubmit = () => {
    this.reloadData();
  };

  // don't show the error boundary if the component fails.
  // capture the endpoint error on onRequestError
  renderError(): React.ReactNode {
    return null;
  }

  renderLoading() {
    return (
      <CodeMappingButtonContainer columnQuantity={2}>
        <Placeholder height="24px" width="60px" />
      </CodeMappingButtonContainer>
    );
  }

  renderNoMatch() {
    const filename = this.props.frame.filename;
    const {integrations} = this.state.match;
    if (!this.project || !integrations.length || !filename) {
      return null;
    }

    const {organization} = this.props;
    const platform = this.props.event.platform;
    const sourceCodeProviders = integrations.filter(integration =>
      ['github', 'gitlab'].includes(integration.provider?.key)
    );
    return (
      <CodeMappingButtonContainer columnQuantity={2}>
        <FixMappingButton
          type="button"
          priority="link"
          icon={
            sourceCodeProviders.length === 1
              ? getIntegrationIcon(sourceCodeProviders[0].provider.key, 'sm')
              : undefined
          }
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
        >
          {t('Fix code mapping to see suspect commits and more')}
        </FixMappingButton>
      </CodeMappingButtonContainer>
    );
  }

  renderNoIntegrations() {
    const {organization} = this.props;
    return (
      <CodeMappingButtonContainer columnQuantity={2}>
        <StyledLink to={`/settings/${organization.slug}/integrations/`}>
          <StyledIconWrapper>{getIntegrationIcon('github', 'sm')}</StyledIconWrapper>
          {t('Add an integration to see suspect commits and more')}
        </StyledLink>
        <CloseButton type="button" priority="link" onClick={this.dismissPrompt}>
          <IconClose size="xs" aria-label={t('Close')} />
        </CloseButton>
      </CodeMappingButtonContainer>
    );
  }

  renderLink() {
    const {config, sourceUrl} = this.state.match;
    const url = `${sourceUrl}#L${this.props.frame.lineNo}`;
    return (
      <CodeMappingButtonContainer columnQuantity={2}>
        <OpenInLink onClick={this.onOpenLink} href={url} openInNewTab>
          <StyledIconWrapper>
            {getIntegrationIcon(config!.provider.key, 'sm')}
          </StyledIconWrapper>
          {t('Open this line in %s', config!.provider.name)}
        </OpenInLink>
      </CodeMappingButtonContainer>
    );
  }

  renderBody() {
    const {config, error, sourceUrl, integrations} = this.state.match || {};
    const {isDismissed, promptLoaded} = this.state;

    // Success state
    if (config && sourceUrl) {
      return this.renderLink();
    }

    // Code mapping does not match
    // Has integration but no code mappings
    if (error || integrations.length > 0) {
      return this.renderNoMatch();
    }

    if (!promptLoaded || (promptLoaded && isDismissed)) {
      return null;
    }

    return this.renderNoIntegrations();
  }
}

export default withProjects(withOrganization(StacktraceLink));
export {StacktraceLink};

export const CodeMappingButtonContainer = styled(OpenInContainer)`
  justify-content: space-between;
  min-height: 28px;
`;

const FixMappingButton = styled(Button)`
  color: ${p => p.theme.subText};
`;

const CloseButton = styled(Button)`
  color: ${p => p.theme.subText};
`;

const StyledIconWrapper = styled('span')`
  color: inherit;
  line-height: 0;
`;

const LinkStyles = css`
  display: flex;
  align-items: center;
  gap: ${space(0.75)};
`;

const OpenInLink = styled(ExternalLink)`
  ${LinkStyles}
  color: ${p => p.theme.gray300};
`;

const StyledLink = styled(Link)`
  ${LinkStyles}
  color: ${p => p.theme.gray300};
`;
