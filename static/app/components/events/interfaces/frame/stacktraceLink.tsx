import {useEffect, useMemo} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import {
  makePromptsCheckQueryKey,
  PromptResponse,
  promptsUpdate,
  usePromptsCheck,
} from 'sentry/actionCreators/prompts';
import {Button} from 'sentry/components/button';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import Placeholder from 'sentry/components/placeholder';
import type {PlatformKey} from 'sentry/data/platformCategories';
import {IconClose, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {
  CodecovStatusCode,
  Event,
  Frame,
  Organization,
  Project,
  StacktraceLinkResult,
} from 'sentry/types';
import {StacktraceLinkEvents} from 'sentry/utils/analytics/integrations/stacktraceLinkAnalyticsEvents';
import {getAnalyicsDataForEvent} from 'sentry/utils/events';
import {
  getIntegrationIcon,
  trackIntegrationAnalytics,
} from 'sentry/utils/integrationUtil';
import {isMobilePlatform} from 'sentry/utils/platform';
import {promptIsDismissed} from 'sentry/utils/promptIsDismissed';
import {useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

import {OpenInContainer} from './openInContextLine';
import StacktraceLinkModal from './stacktraceLinkModal';
import useStacktraceLink from './useStacktraceLink';

const supportedStacktracePlatforms: PlatformKey[] = [
  'go',
  'javascript',
  'node',
  'php',
  'python',
  'ruby',
  'elixir',
];

interface StacktraceLinkSetupProps {
  event: Event;
  organization: Organization;
  project?: Project;
}

function StacktraceLinkSetup({organization, project, event}: StacktraceLinkSetupProps) {
  const api = useApi();
  const queryClient = useQueryClient();

  const dismissPrompt = () => {
    promptsUpdate(api, {
      organizationId: organization.id,
      projectId: project?.id,
      feature: 'stacktrace_link',
      status: 'dismissed',
    });

    // Update cached query data
    // Will set prompt to dismissed
    queryClient.setQueryData<PromptResponse>(
      makePromptsCheckQueryKey({
        feature: 'stacktrace_link',
        organizationId: organization.id,
        projectId: project?.id,
      }),
      () => {
        const dimissedTs = new Date().getTime() / 1000;
        return {
          data: {dismissed_ts: dimissedTs},
          features: {stacktrace_link: {dismissed_ts: dimissedTs}},
        };
      }
    );

    trackIntegrationAnalytics('integrations.stacktrace_link_cta_dismissed', {
      view: 'stacktrace_issue_details',
      organization,
      ...getAnalyicsDataForEvent(event),
    });
  };

  return (
    <CodeMappingButtonContainer columnQuantity={2}>
      <StyledLink to={`/settings/${organization.slug}/integrations/`}>
        <StyledIconWrapper>{getIntegrationIcon('github', 'sm')}</StyledIconWrapper>
        {t('Add the GitHub or GitLab integration to jump straight to your source code')}
      </StyledLink>
      <CloseButton priority="link" onClick={dismissPrompt}>
        <IconClose size="xs" aria-label={t('Close')} />
      </CloseButton>
    </CodeMappingButtonContainer>
  );
}

function shouldshowCodecovFeatures(
  organization: Organization,
  match: StacktraceLinkResult
) {
  const enabled =
    organization.features.includes('codecov-stacktrace-integration') &&
    organization.codecovAccess;

  const validStatus = [
    CodecovStatusCode.COVERAGE_EXISTS,
    CodecovStatusCode.NO_COVERAGE_DATA,
  ].includes(match.codecovStatusCode!);

  return enabled && validStatus && match.config?.provider.key === 'github';
}

interface CodecovLinkProps {
  sourceUrl: string | undefined;
  codecovStatusCode?: CodecovStatusCode;
}

function CodecovLink({sourceUrl, codecovStatusCode}: CodecovLinkProps) {
  if (codecovStatusCode === CodecovStatusCode.NO_COVERAGE_DATA) {
    return (
      <CodecovWarning>
        {t('Code Coverage not found')}
        <IconWarning size="xs" color="errorText" />
      </CodecovWarning>
    );
  }

  if (codecovStatusCode === CodecovStatusCode.COVERAGE_EXISTS) {
    if (!sourceUrl) {
      return null;
    }
    const codecovUrl = sourceUrl.replaceAll(
      new RegExp('github.com/.[^/]*', 'g'),
      'app.codecov.io/gh'
    );

    return (
      <OpenInLink href={codecovUrl} openInNewTab>
        {t('View Coverage Tests on Codecov')}
        <StyledIconWrapper>{getIntegrationIcon('codecov', 'sm')}</StyledIconWrapper>
      </OpenInLink>
    );
  }
  return null;
}

interface StacktraceLinkProps {
  event: Event;
  frame: Frame;
  /**
   * The line of code being linked
   */
  line: string;
}

export function isMobileLanguage(event: Event) {
  return (
    isMobilePlatform(event.platform) ||
    (event.platform === 'other' &&
      isMobilePlatform(event.release?.projects?.[0].platform)) ||
    (event.platform === 'java' && isMobilePlatform(event.release?.projects?.[0].platform))
  );
}

export function StacktraceLink({frame, event, line}: StacktraceLinkProps) {
  const organization = useOrganization();
  const {projects} = useProjects();
  const project = useMemo(
    () => projects.find(p => p.id === event.projectID),
    [projects, event]
  );
  const prompt = usePromptsCheck({
    feature: 'stacktrace_link',
    organizationId: organization.id,
    projectId: project?.id,
  });
  const isPromptDismissed =
    prompt.isSuccess && prompt.data.data
      ? promptIsDismissed({
          dismissedTime: prompt.data.data.dismissed_ts,
          snoozedTime: prompt.data.data.snoozed_ts,
        })
      : false;

  const isMobile = isMobileLanguage(event);

  const {
    data: match,
    isLoading,
    refetch,
  } = useStacktraceLink({
    event,
    frame,
    orgSlug: organization.slug,
    projectSlug: project?.slug,
  });

  useEffect(() => {
    if (isLoading || prompt.isLoading || !match) {
      return;
    }

    trackIntegrationAnalytics('integrations.stacktrace_link_viewed', {
      view: 'stacktrace_issue_details',
      organization,
      platform: project?.platform,
      project_id: project?.id,
      state:
        // Should follow the same logic in render
        match.sourceUrl
          ? 'match'
          : match.error || match.integrations.length > 0
          ? 'no_match'
          : !isPromptDismissed
          ? 'prompt'
          : 'empty',
      ...getAnalyicsDataForEvent(event),
    });
    // excluding isPromptDismissed because we want this only to record once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, prompt.isLoading, match, organization, project, event]);

  const onOpenLink = () => {
    const provider = match!.config?.provider;
    if (provider) {
      trackIntegrationAnalytics(
        StacktraceLinkEvents.OPEN_LINK,
        {
          view: 'stacktrace_issue_details',
          provider: provider.key,
          organization,
          ...getAnalyicsDataForEvent(event),
        },
        {startSession: true}
      );
    }
  };

  const handleSubmit = () => {
    refetch();
  };

  // Temporarily prevent mobile platforms from showing stacktrace link
  if (isMobile) {
    return null;
  }

  if (isLoading || !match) {
    return (
      <CodeMappingButtonContainer columnQuantity={2}>
        <Placeholder height="24px" width="60px" />
      </CodeMappingButtonContainer>
    );
  }

  // Match found - display link to source
  if (match.config && match.sourceUrl) {
    return (
      <CodeMappingButtonContainer columnQuantity={2}>
        <OpenInLink
          onClick={onOpenLink}
          href={`${match!.sourceUrl}#L${frame.lineNo}`}
          openInNewTab
        >
          <StyledIconWrapper>
            {getIntegrationIcon(match.config.provider.key, 'sm')}
          </StyledIconWrapper>
          {t('Open this line in %s', match.config.provider.name)}
        </OpenInLink>
        {shouldshowCodecovFeatures(organization, match) && (
          <CodecovLink
            sourceUrl={match.sourceUrl}
            codecovStatusCode={match.codecovStatusCode}
          />
        )}
      </CodeMappingButtonContainer>
    );
  }

  // Hide stacktrace link errors if the stacktrace might be minified javascript
  // Check if the line starts and ends with {snip}
  const isMinifiedJsError =
    event.platform === 'javascript' && /(\{snip\}).*\1/.test(line);
  const isUnsupportedPlatform = !supportedStacktracePlatforms.includes(
    event.platform as PlatformKey
  );
  const hideErrors = isMinifiedJsError || isUnsupportedPlatform;
  // No match found - Has integration but no code mappings
  if (!hideErrors && (match.error || match.integrations.length > 0)) {
    const filename = frame.filename;
    if (!project || !match.integrations.length || !filename) {
      return null;
    }

    const sourceCodeProviders = match.integrations.filter(integration =>
      ['github', 'gitlab'].includes(integration.provider?.key)
    );
    return (
      <CodeMappingButtonContainer columnQuantity={2}>
        <FixMappingButton
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
                platform: event.platform,
                organization,
                ...getAnalyicsDataForEvent(event),
              },
              {startSession: true}
            );
            openModal(deps => (
              <StacktraceLinkModal
                onSubmit={handleSubmit}
                filename={filename}
                project={project}
                organization={organization}
                integrations={match.integrations}
                {...deps}
              />
            ));
          }}
        >
          {t('Tell us where your source code is')}
        </FixMappingButton>
      </CodeMappingButtonContainer>
    );
  }

  // No integrations, but prompt is dismissed or hidden
  if (hideErrors || isPromptDismissed) {
    return null;
  }

  // No integrations
  return (
    <StacktraceLinkSetup event={event} project={project} organization={organization} />
  );
}

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

const CodecovWarning = styled('div')`
  display: flex;
  color: ${p => p.theme.errorText};
  gap: ${space(0.75)};
  align-items: center;
`;
