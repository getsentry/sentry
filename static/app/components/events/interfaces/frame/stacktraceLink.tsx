import {useEffect, useMemo, useState} from 'react';
import {css, keyframes} from '@emotion/react';
import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import {
  makePromptsCheckQueryKey,
  PromptResponse,
  promptsUpdate,
  usePromptsCheck,
} from 'sentry/actionCreators/prompts';
import {Button} from 'sentry/components/button';
import HookOrDefault from 'sentry/components/hookOrDefault';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import Placeholder from 'sentry/components/placeholder';
import {IconClose, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  CodecovStatusCode,
  Event,
  Frame,
  Organization,
  PlatformKey,
  Project,
  StacktraceLinkResult,
} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getAnalyticsDataForEvent} from 'sentry/utils/events';
import {getIntegrationIcon, getIntegrationSourceUrl} from 'sentry/utils/integrationUtil';
import {promptIsDismissed} from 'sentry/utils/promptIsDismissed';
import {setApiQueryData, useQueryClient} from 'sentry/utils/queryClient';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import withOrganization from 'sentry/utils/withOrganization';

import StacktraceLinkModal from './stacktraceLinkModal';
import useStacktraceLink from './useStacktraceLink';

const HookCodecovStacktraceLink = HookOrDefault({
  hookName: 'component:codecov-integration-stacktrace-link',
});

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
    setApiQueryData<PromptResponse>(
      queryClient,
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

    trackAnalytics('integrations.stacktrace_link_cta_dismissed', {
      view: 'stacktrace_issue_details',
      organization,
      ...getAnalyticsDataForEvent(event),
    });
  };

  return (
    <StacktraceLinkWrapper>
      <StyledLink to={`/settings/${organization.slug}/integrations/`}>
        <StyledIconWrapper>{getIntegrationIcon('github', 'sm')}</StyledIconWrapper>
        {t('Add the GitHub or GitLab integration to jump straight to your source code')}
      </StyledLink>
      <CloseButton priority="link" onClick={dismissPrompt}>
        <IconClose size="xs" aria-label={t('Close')} />
      </CloseButton>
    </StacktraceLinkWrapper>
  );
}

function shouldShowCodecovFeatures(
  organization: Organization,
  match: StacktraceLinkResult
) {
  const codecovStatus = match.codecov?.status;
  const validStatus = codecovStatus && codecovStatus !== CodecovStatusCode.NO_INTEGRATION;

  return (
    organization.codecovAccess && validStatus && match.config?.provider.key === 'github'
  );
}

function shouldShowCodecovPrompt(
  organization: Organization,
  match: StacktraceLinkResult
) {
  const enabled =
    organization.features.includes('codecov-integration') && !organization.codecovAccess;

  return enabled && match.config?.provider.key === 'github';
}

interface CodecovLinkProps {
  event: Event;
  organization: Organization;
  coverageUrl?: string;
  status?: CodecovStatusCode;
}

function CodecovLink({
  coverageUrl,
  status = CodecovStatusCode.COVERAGE_EXISTS,
  organization,
  event,
}: CodecovLinkProps) {
  if (status === CodecovStatusCode.NO_COVERAGE_DATA) {
    return (
      <CodecovWarning>
        {t('Code Coverage not found')}
        <IconWarning size="xs" color="errorText" />
      </CodecovWarning>
    );
  }

  if (status !== CodecovStatusCode.COVERAGE_EXISTS || !coverageUrl) {
    return null;
  }

  const onOpenCodecovLink = e => {
    e.stopPropagation();
    trackAnalytics('integrations.stacktrace_codecov_link_clicked', {
      view: 'stacktrace_issue_details',
      organization,
      group_id: event.groupID ? parseInt(event.groupID, 10) : -1,
      ...getAnalyticsDataForEvent(event),
    });
  };
  const hasStacktraceLinkFeatureFlag =
    organization?.features?.includes('issue-details-stacktrace-link-in-frame') ?? false;

  return (
    <OpenInLink href={coverageUrl} openInNewTab onClick={onOpenCodecovLink}>
      <StyledIconWrapper>{getIntegrationIcon('codecov', 'sm')}</StyledIconWrapper>
      {hasStacktraceLinkFeatureFlag ? t('Codecov') : t('Open in Codecov')}
    </OpenInLink>
  );
}

interface StacktraceLinkProps {
  event: Event;
  frame: Frame;
  /**
   * The line of code being linked
   */
  line: string;
}

export function StacktraceLink({frame, event, line}: StacktraceLinkProps) {
  const organization = useOrganization();
  const {projects} = useProjects();
  const hasStacktraceLinkFeatureFlag =
    organization?.features?.includes('issue-details-stacktrace-link-in-frame') ?? false;
  const [isQueryEnabled, setIsQueryEnabled] = useState(!hasStacktraceLinkFeatureFlag);
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

  useEffect(() => {
    let timer;
    if (hasStacktraceLinkFeatureFlag) {
      // Introduce a delay before enabling the query
      timer = setTimeout(() => {
        setIsQueryEnabled(true);
      }, 100); // Delay of 100ms
    }
    return () => timer && clearTimeout(timer);
  }, [hasStacktraceLinkFeatureFlag]); // Empty dependency array to run only on mount

  const {
    data: match,
    isLoading,
    refetch,
  } = useStacktraceLink(
    {
      event,
      frame,
      orgSlug: organization.slug,
      projectSlug: project?.slug,
    },
    {
      staleTime: Infinity,
      enabled: isQueryEnabled, // The query will not run until `isQueryEnabled` is true
    }
  );

  useRouteAnalyticsParams(
    match
      ? {
          stacktrace_link_viewed: true,
          stacktrace_link_status: match.sourceUrl
            ? 'match'
            : match.error || match.integrations.length
            ? 'no_match'
            : !isPromptDismissed
            ? 'prompt'
            : 'empty',
        }
      : {}
  );

  const onOpenLink = e => {
    e.stopPropagation();
    const provider = match!.config?.provider;
    if (provider) {
      trackAnalytics(
        'integrations.stacktrace_link_clicked',
        {
          view: 'stacktrace_issue_details',
          provider: provider.key,
          organization,
          group_id: event.groupID ? parseInt(event.groupID, 10) : -1,
          ...getAnalyticsDataForEvent(event),
        },
        {startSession: true}
      );
    }
  };

  const handleSubmit = () => {
    refetch();
  };

  if (isLoading || !match) {
    return (
      <StacktraceLinkWrapper>
        <Placeholder
          height={hasStacktraceLinkFeatureFlag ? '14px' : '24px'}
          width={hasStacktraceLinkFeatureFlag ? '171px' : '120px'}
        />
      </StacktraceLinkWrapper>
    );
  }

  // Match found - display link to source
  if (match.config && match.sourceUrl) {
    return (
      <StacktraceLinkWrapper>
        <OpenInLink
          onClick={onOpenLink}
          href={getIntegrationSourceUrl(
            match.config.provider.key,
            match!.sourceUrl,
            frame.lineNo
          )}
          openInNewTab
        >
          <StyledIconWrapper>
            {getIntegrationIcon(match.config.provider.key, 'sm')}
          </StyledIconWrapper>
          {hasStacktraceLinkFeatureFlag
            ? match.config.provider.name
            : t('Open this line in %s', match.config.provider.name)}
        </OpenInLink>
        {shouldShowCodecovFeatures(organization, match) ? (
          <CodecovLink
            coverageUrl={`${match.codecov?.coverageUrl}#L${frame.lineNo}`}
            status={match.codecov?.status}
            organization={organization}
            event={event}
          />
        ) : shouldShowCodecovPrompt(organization, match) ? (
          <HookCodecovStacktraceLink organization={organization} />
        ) : null}
      </StacktraceLinkWrapper>
    );
  }

  // Hide stacktrace link errors if the stacktrace might be minified javascript
  // Check if the line starts and ends with {snip}
  const isMinifiedJsError =
    event.platform === 'javascript' && /(\{snip\}).*\1/.test(line);
  const isUnsupportedPlatform = !supportedStacktracePlatforms.includes(
    event.platform as PlatformKey
  );
  const hasGithubSourceLink =
    event.platform === 'csharp' &&
    frame.sourceLink?.startsWith('https://www.github.com/');
  const hideErrors = isMinifiedJsError || isUnsupportedPlatform;
  // for .NET projects, if there is no match found but there is a GitHub source link, use that
  if (
    frame.sourceLink &&
    hasGithubSourceLink &&
    (match.error || match.integrations.length > 0)
  ) {
    return (
      <StacktraceLinkWrapper>
        <OpenInLink onClick={onOpenLink} href={frame.sourceLink} openInNewTab>
          <StyledIconWrapper>{getIntegrationIcon('github', 'sm')}</StyledIconWrapper>
          {hasStacktraceLinkFeatureFlag ? t('GitHub') : t('Open this line in GitHub')}
        </OpenInLink>
        {shouldShowCodecovFeatures(organization, match) ? (
          <CodecovLink
            coverageUrl={`${frame.sourceLink}`}
            status={match.codecov?.status}
            organization={organization}
            event={event}
          />
        ) : shouldShowCodecovPrompt(organization, match) ? (
          <HookCodecovStacktraceLink organization={organization} />
        ) : null}
      </StacktraceLinkWrapper>
    );
  }

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
      <StacktraceLinkWrapper>
        <FixMappingButton
          priority="link"
          icon={
            sourceCodeProviders.length === 1
              ? getIntegrationIcon(sourceCodeProviders[0].provider.key, 'sm')
              : undefined
          }
          onClick={() => {
            trackAnalytics(
              'integrations.stacktrace_start_setup',
              {
                view: 'stacktrace_issue_details',
                platform: event.platform,
                provider: sourceCodeProviders[0]?.provider.key,
                setup_type: 'automatic',
                organization,
                ...getAnalyticsDataForEvent(event),
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
      </StacktraceLinkWrapper>
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

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const StacktraceLinkWrapper = withOrganization(styled('div')<{
  organization: Organization;
}>`
  display: flex;
  gap: ${space(2)};
  align-items: center;
  color: ${p => p.theme.subText};
  font-family: ${p => p.theme.text.family};

  ${p =>
    p.organization?.features?.includes('issue-details-stacktrace-link-in-frame')
      ? `
      padding: ${space(0)} ${space(1)};
      flex-wrap: wrap;
      gap: ${space(1)}
    `
      : `
      background-color: ${p.theme.background};
      border-bottom: 1px solid ${p.theme.border};
      padding: ${space(0.25)} ${space(3)};
      box-shadow: ${p.theme.dropShadowLight};
      min-height: 28px;

      `}
`);

const FixMappingButton = withOrganization(styled(Button)<{organization: Organization}>`
  color: ${p => p.theme.subText};

  ${p =>
    p.organization?.features?.includes('issue-details-stacktrace-link-in-frame')
      ? `
      &:hover {
        color: ${p.theme.subText};
        text-decoration: underline;
        text-decoration-color: ${p.theme.subText};
        text-underline-offset: ${space(0.5)};
      }
    `
      : ``}
`);

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

const OpenInLink = withOrganization(styled(ExternalLink)<{organization: Organization}>`
  ${LinkStyles}
  ${p =>
    p.organization?.features?.includes('issue-details-stacktrace-link-in-frame')
      ? css`
          color: ${p.theme.linkColor};
          animation: ${fadeIn} 0.2s ease-in-out forwards;
          &:hover {
            text-decoration: underline;
            text-decoration-color: ${p.theme.linkUnderline};
            text-underline-offset: ${space(0.5)};
          }
        `
      : css`
          color: ${p.theme.gray300};
        `}
`);

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
