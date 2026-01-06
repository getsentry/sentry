import {useEffect, useMemo, useState} from 'react';
import {keyframes} from '@emotion/react';
import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {LinkButton, type LinkButtonProps} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import {Tooltip} from 'sentry/components/core/tooltip';
import {useStacktraceCoverage} from 'sentry/components/events/interfaces/frame/useStacktraceCoverage';
import {hasFileExtension} from 'sentry/components/events/interfaces/frame/utils';
import Placeholder from 'sentry/components/placeholder';
import {IconCopy, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Event, Frame} from 'sentry/types/event';
import type {StacktraceLinkResult} from 'sentry/types/integrations';
import {CodecovStatusCode} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import type {PlatformKey} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getAnalyticsDataForEvent} from 'sentry/utils/events';
import {getIntegrationIcon, getIntegrationSourceUrl} from 'sentry/utils/integrationUtil';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

import StacktraceLinkModal from './stacktraceLinkModal';
import useStacktraceLink from './useStacktraceLink';

// Keep this list in sync with PLATFORMS_CONFIG in auto_source_code_config/constants.py
const supportedStacktracePlatforms: PlatformKey[] = [
  'clojure',
  'csharp',
  'elixir', // Elixir is not listed on the main list
  'go',
  'groovy',
  'java',
  'javascript',
  'node',
  'php',
  'python',
  'ruby',
  'scala',
];

const scmProviders = ['github', 'gitlab', 'bitbucket'];

interface StacktraceLinkProps {
  /**
   * If true, the setup button will not be shown
   */
  disableSetup: boolean;
  event: Event;
  frame: Frame;
  /**
   * The line of code being linked
   */
  line: string | null;
}

export function StacktraceLink({frame, event, line, disableSetup}: StacktraceLinkProps) {
  const organization = useOrganization();
  const {projects} = useProjects();
  const project = useMemo(
    () => projects.find(p => p.id === event.projectID),
    [projects, event]
  );

  const validFilePath = hasFileExtension(frame.absPath || frame.filename || '');
  const [shouldStartQuery, setShouldStartQuery] = useState(false);

  // The stacktrace link is rendered on hover
  // Delay the query until the mouse hovers the frame for more than 50ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setShouldStartQuery(true);
    }, 50);
    return () => timer && clearTimeout(timer);
  }, []);

  // TODO: Currently we only support GitHub links. Implement support for other source code providers.
  // Related comment: https://github.com/getsentry/sentry/pull/62596#discussion_r1443025242
  const hasGithubSourceLink = (frame.sourceLink || '').startsWith(
    'https://www.github.com/'
  );
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

  if (!validFilePath) {
    return null;
  }

  // Render the provided `sourceLink` for all the non-in-app frames for `csharp` platform Issues
  // We skip fetching from the API for these frames.
  if (!match && hasGithubSourceLink && !frame.inApp && frame.sourceLink) {
    return (
      <StacktraceLinkWrapper>
        <CopyFrameLink event={event} frame={frame} />
        <Tooltip title={t('Open this line in GitHub')} skipWrapper>
          <ProviderLink
            onClick={e => onOpenLink(e, frame.sourceLink)}
            href={frame.sourceLink}
            aria-label={t('GitHub')}
            icon={getIntegrationIcon('github', DEFAULT_ICON_SIZE)}
          />
        </Tooltip>
      </StacktraceLinkWrapper>
    );
  }

  if ((isPending && isQueryEnabled) || !match) {
    return null;
  }

  // Match found - display link to source
  if (match.config && match.sourceUrl) {
    const label = t('Open this line in %s', match.config.provider.name);
    return (
      <StacktraceLinkWrapper>
        <CopyFrameLink event={event} frame={frame} />
        <Tooltip title={label} skipWrapper>
          <ProviderLink
            onClick={onOpenLink}
            href={getIntegrationSourceUrl(
              match.config.provider.key,
              match.sourceUrl,
              frame.lineNo
            )}
            aria-label={label}
            icon={getIntegrationIcon(match.config.provider.key, DEFAULT_ICON_SIZE)}
          />
        </Tooltip>
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

  const hideErrors = isMinifiedJsError || isUnsupportedPlatform || disableSetup;
  // for .NET projects, if there is no match found but there is a GitHub source link, use that
  if (
    frame.sourceLink &&
    hasGithubSourceLink &&
    (match.error || match.integrations.length > 0)
  ) {
    return (
      <StacktraceLinkWrapper>
        <CopyFrameLink event={event} frame={frame} />
        <Tooltip title={t('GitHub')} skipWrapper>
          <ProviderLink
            onClick={onOpenLink}
            href={frame.sourceLink}
            icon={getIntegrationIcon('github', DEFAULT_ICON_SIZE)}
          />
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
        <CopyFrameLink event={event} frame={frame} />
        <Button
          size={DEFAULT_BUTTON_SIZE}
          priority="transparent"
          icon={
            sourceCodeProviders.length === 1
              ? getIntegrationIcon(
                  sourceCodeProviders[0]!.provider.key,
                  DEFAULT_ICON_SIZE
                )
              : undefined
          }
          onClick={e => {
            // Prevent from opening/closing the stack frame
            e.stopPropagation();
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
                onSubmit={refetch}
                filename={filename}
                module={frame.module ?? undefined}
                absPath={frame.absPath ?? undefined}
                platform={event.platform}
                project={project}
                organization={organization}
                integrations={match.integrations}
                {...deps}
              />
            ));
          }}
        >
          {t('Set up Code Mapping')}
        </Button>
      </StacktraceLinkWrapper>
    );
  }

  return null;
}

function shouldShowCodecovFeatures(
  organization: Organization,
  match: StacktraceLinkResult,
  codecovStatus: CodecovStatusCode
) {
  return (
    codecovStatus &&
    codecovStatus !== CodecovStatusCode.NO_INTEGRATION &&
    organization.codecovAccess &&
    match.config?.provider.key === 'github'
  );
}

// This should never have been set, as the icons inside buttons already auto adjust
// depending on the button size, however the reason it cannot be removed is that the icon
// function initializes a default argument for the icon size to md, meaning we cannot simply remove it.
const DEFAULT_ICON_SIZE = 'xs';
const DEFAULT_BUTTON_SIZE = 'xs';

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
      <Flex align="center" gap="sm">
        <Text variant="danger">{t('Code Coverage not found')}</Text>
        <IconWarning size={DEFAULT_ICON_SIZE} variant="danger" />
      </Flex>
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
    <Tooltip title={t('Open in Codecov')} skipWrapper>
      <ProviderLink
        href={coverageUrl}
        onClick={onOpenCodecovLink}
        aria-label={t('Open in Codecov')}
        icon={getIntegrationIcon('codecov', DEFAULT_ICON_SIZE)}
      />
    </Tooltip>
  );
}
interface CopyFrameLinkProps {
  event: Event;
  frame: Frame;
}

function CopyFrameLink({event, frame}: CopyFrameLinkProps) {
  const filePath =
    frame.filename && frame.lineNo !== null
      ? `${frame.filename}:${frame.lineNo}`
      : frame.filename || '';

  const {copy} = useCopyToClipboard();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    // Strip away relative path segments to make it easier for editors to actually find the file (like VSCode cmd+p)
    const cleanedFilepath = filePath.replace(/^(\.\/)?(\.\.\/)*/g, '');

    copy(cleanedFilepath, {
      successMessage: t('File path copied to clipboard'),
      errorMessage: t('Failed to copy file path'),
    });
  };

  // Don't render if there's no valid file path to copy
  if (!filePath) {
    return null;
  }

  return (
    <Tooltip title={t('Copy file path')} skipWrapper>
      <Button
        size={DEFAULT_BUTTON_SIZE}
        priority="transparent"
        aria-label={t('Copy file path')}
        icon={<IconCopy />}
        onClick={handleClick}
        analyticsEventKey="stacktrace_link_copy_file_path"
        analyticsEventName="Stacktrace Link Copy File Path"
        analyticsParams={{
          group_id: event.groupID ? parseInt(event.groupID, 10) : -1,
          ...getAnalyticsDataForEvent(event),
        }}
      />
    </Tooltip>
  );
}

const fadeIn = keyframes`
from { opacity: 0; }
to { opacity: 1; }
`;

const FadeInStacktraceLinkWrapper = styled(Flex)`
  a,
  button {
    animation: ${fadeIn} 0.2s ease-in-out forwards;
  }
`;

function StacktraceLinkWrapper({children}: {children: React.ReactNode}) {
  return (
    <FadeInStacktraceLinkWrapper align="center">{children}</FadeInStacktraceLinkWrapper>
  );
}

function ProviderLink(props: LinkButtonProps) {
  return (
    <LinkButton size={DEFAULT_BUTTON_SIZE} priority="transparent" external {...props} />
  );
}
