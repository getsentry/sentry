import {useEffect, useMemo, useState} from 'react';
import {css, keyframes} from '@emotion/react';
import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import {useStacktraceCoverage} from 'sentry/components/events/interfaces/frame/useStacktraceCoverage';
import {hasFileExtension} from 'sentry/components/events/interfaces/frame/utils';
import ExternalLink from 'sentry/components/links/externalLink';
import Placeholder from 'sentry/components/placeholder';
import {Tooltip} from 'sentry/components/tooltip';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event, Frame} from 'sentry/types/event';
import type {StacktraceLinkResult} from 'sentry/types/integrations';
import {CodecovStatusCode} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import type {PlatformKey} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getAnalyticsDataForEvent} from 'sentry/utils/events';
import {getIntegrationIcon, getIntegrationSourceUrl} from 'sentry/utils/integrationUtil';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

import StacktraceLinkModal from './stacktraceLinkModal';
import useStacktraceLink from './useStacktraceLink';

// Keep this list in sync with SUPPORTED_LANGUAGES in code_mapping.py
const supportedStacktracePlatforms: PlatformKey[] = [
  'csharp',
  'elixir',
  'go',
  'javascript',
  'node',
  'php',
  'python',
  'ruby',
];
const scmProviders = ['github', 'gitlab'];

function shouldShowCodecovFeatures(
  organization: Organization,
  match: StacktraceLinkResult,
  codecovStatus: CodecovStatusCode
) {
  const validStatus = codecovStatus && codecovStatus !== CodecovStatusCode.NO_INTEGRATION;

  return (
    organization.codecovAccess && validStatus && match.config?.provider.key === 'github'
  );
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

  const onOpenCodecovLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    trackAnalytics('integrations.stacktrace_codecov_link_clicked', {
      view: 'stacktrace_issue_details',
      organization,
      group_id: event.groupID ? parseInt(event.groupID, 10) : -1,
      ...getAnalyticsDataForEvent(event),
    });
  };

  return (
    <OpenInLink
      href={coverageUrl}
      openInNewTab
      onClick={onOpenCodecovLink}
      aria-label={t('Open in Codecov')}
    >
      <Tooltip title={t('Open in Codecov')} skipWrapper>
        <StyledIconWrapper>{getIntegrationIcon('codecov', 'sm')}</StyledIconWrapper>
      </Tooltip>
    </OpenInLink>
  );
}

interface StacktraceLinkProps {
  event: Event;
  frame: Frame;
  /**
   * The line of code being linked
   */
  line: string | null;
}

export function StacktraceLink({frame, event, line}: StacktraceLinkProps) {
  const organization = useOrganization();
  const {projects} = useProjects();
  const validFilePath = hasFileExtension(frame.absPath || frame.filename || '');
  // TODO: Currently we only support GitHub links. Implement support for other source code providers.
  // Related comment: https://github.com/getsentry/sentry/pull/62596#discussion_r1443025242
  const hasGithubSourceLink = (frame.sourceLink || '').startsWith(
    'https://www.github.com/'
  );
  const [shouldStartQuery, setShouldStartQuery] = useState(false);
  const project = useMemo(
    () => projects.find(p => p.id === event.projectID),
    [projects, event]
  );

  useEffect(() => {
    // The stacktrace link is rendered on hover
    // Delay the query until the mouse hovers the frame for more than 50ms
    const timer = setTimeout(() => {
      setShouldStartQuery(true);
    }, 50); // Delay of 50ms
    return () => timer && clearTimeout(timer);
  }, []);

  const isQueryEnabled = hasGithubSourceLink
    ? false
    : shouldStartQuery && validFilePath && frame.inApp;

  const {
    data: match,
    isPending,
    refetch,
  } = useStacktraceLink(
    {
      event,
      frame,
      orgSlug: organization.slug,
      projectSlug: project?.slug,
    },
    {
      enabled: isQueryEnabled, // The query will not run until `isQueryEnabled` is true
    }
  );
  const coverageEnabled =
    isQueryEnabled &&
    organization.codecovAccess &&
    organization.features.includes('codecov-integration');
  const {data: coverage, isPending: isLoadingCoverage} = useStacktraceCoverage(
    {
      event,
      frame,
      orgSlug: organization.slug,
      projectSlug: project?.slug,
    },
    {
      enabled: coverageEnabled,
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
              : 'empty',
        }
      : {}
  );

  const onOpenLink = (e: React.MouseEvent, sourceLink: Frame['sourceLink'] = null) => {
    e.stopPropagation();
    const provider = match?.config?.provider;
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
    if (sourceLink) {
      const url = new URL(sourceLink);
      const hostname = url.hostname;
      const parts = hostname.split('.');
      const domain = parts.length > 1 ? parts[1]! : '';
      trackAnalytics(
        'integrations.non_inapp_stacktrace_link_clicked',
        {
          view: 'stacktrace_issue_details',
          provider: domain,
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

  if (!validFilePath) {
    return null;
  }

  // Render the provided `sourceLink` for all the non-in-app frames for `csharp` platform Issues
  // We skip fetching from the API for these frames.
  if (!match && hasGithubSourceLink && !frame.inApp && frame.sourceLink) {
    return (
      <StacktraceLinkWrapper>
        <Tooltip title={t('Open this line in GitHub')} skipWrapper>
          <OpenInLink
            onClick={e => onOpenLink(e, frame.sourceLink)}
            href={frame.sourceLink}
            openInNewTab
            aria-label={t('GitHub')}
          >
            <StyledIconWrapper>{getIntegrationIcon('github', 'sm')}</StyledIconWrapper>
          </OpenInLink>
        </Tooltip>
      </StacktraceLinkWrapper>
    );
  }

  if ((isPending && isQueryEnabled) || !match) {
    const placeholderWidth = coverageEnabled ? '40px' : '14px';
    return (
      <StacktraceLinkWrapper>
        <Placeholder height="14px" width={placeholderWidth} />
      </StacktraceLinkWrapper>
    );
  }

  // Match found - display link to source
  if (match.config && match.sourceUrl) {
    const label = t('Open this line in %s', match.config.provider.name);
    return (
      <StacktraceLinkWrapper>
        <OpenInLink
          onClick={onOpenLink}
          href={getIntegrationSourceUrl(
            match.config.provider.key,
            match.sourceUrl,
            frame.lineNo
          )}
          openInNewTab
          aria-label={label}
        >
          <Tooltip title={label} skipWrapper>
            <StyledIconWrapper>
              {getIntegrationIcon(match.config.provider.key, 'sm')}
            </StyledIconWrapper>
          </Tooltip>
        </OpenInLink>
        {coverageEnabled && isLoadingCoverage ? (
          <Placeholder height="14px" width="14px" />
        ) : coverage &&
          shouldShowCodecovFeatures(organization, match, coverage.status) ? (
          <CodecovLink
            coverageUrl={`${coverage.coverageUrl}#L${frame.lineNo}`}
            status={coverage.status}
            organization={organization}
            event={event}
          />
        ) : null}
      </StacktraceLinkWrapper>
    );
  }

  // Hide stacktrace link errors if the stacktrace might be minified javascript
  // Check if the line starts and ends with {snip}
  const isMinifiedJsError =
    event.platform === 'javascript' && /(\{snip\}).*\1/.test(line ?? '');
  const isUnsupportedPlatform = !supportedStacktracePlatforms.includes(
    event.platform as PlatformKey
  );

  const hideErrors = isMinifiedJsError || isUnsupportedPlatform;
  // for .NET projects, if there is no match found but there is a GitHub source link, use that
  if (
    frame.sourceLink &&
    hasGithubSourceLink &&
    (match.error || match.integrations.length > 0)
  ) {
    return (
      <StacktraceLinkWrapper>
        <Tooltip title={t('GitHub')} skipWrapper>
          <OpenInLink onClick={onOpenLink} href={frame.sourceLink} openInNewTab>
            <StyledIconWrapper>{getIntegrationIcon('github', 'sm')}</StyledIconWrapper>
          </OpenInLink>
        </Tooltip>
        {coverageEnabled && isLoadingCoverage ? (
          <Placeholder height="14px" width="14px" />
        ) : coverage &&
          shouldShowCodecovFeatures(organization, match, coverage.status) ? (
          <CodecovLink
            coverageUrl={`${frame.sourceLink}`}
            status={coverage.status}
            organization={organization}
            event={event}
          />
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
      scmProviders.includes(integration.provider?.key)
    );
    return (
      <StacktraceLinkWrapper>
        <FixMappingButton
          priority="link"
          icon={
            sourceCodeProviders.length === 1
              ? getIntegrationIcon(sourceCodeProviders[0]!.provider.key, 'sm')
              : undefined
          }
          onClick={() => {
            trackAnalytics(
              'integrations.stacktrace_start_setup',
              {
                view: 'stacktrace_issue_details',
                platform: event.platform,
                provider: sourceCodeProviders[0]?.provider.key!,
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
          {t('Set up Code Mapping')}
        </FixMappingButton>
      </StacktraceLinkWrapper>
    );
  }

  return null;
}

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const StacktraceLinkWrapper = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
  color: ${p => p.theme.subText};
  font-family: ${p => p.theme.text.family};
  padding: 0 ${space(1)};
`;

const FixMappingButton = styled(Button)`
  color: ${p => p.theme.subText};
  &:hover {
    color: ${p => p.theme.subText};
  }
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
  color: ${p => p.theme.subText};
  animation: ${fadeIn} 0.2s ease-in-out forwards;
  &:hover {
    color: ${p => p.theme.textColor};
  }
`;

const CodecovWarning = styled('div')`
  display: flex;
  color: ${p => p.theme.errorText};
  gap: ${space(0.75)};
  align-items: center;
`;
