import {Fragment, useEffect, useMemo, useState} from 'react';
import {keyframes} from '@emotion/react';
import styled from '@emotion/styled';

import {Button, LinkButton, type LinkButtonProps} from '@sentry/scraps/button';
import {Container, Flex} from '@sentry/scraps/layout';
import {useModal} from '@sentry/scraps/modal';
import {Tooltip} from '@sentry/scraps/tooltip';

import {CopyFrameLink} from 'sentry/components/events/interfaces/frame/copyFrameLink';
import {hasFileExtension} from 'sentry/components/events/interfaces/frame/utils';
import {IconCode} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Event, Frame} from 'sentry/types/event';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getAnalyticsDataForEvent} from 'sentry/utils/events';
import {getIntegrationIcon, getIntegrationSourceUrl} from 'sentry/utils/integrationUtil';
import {useRouteAnalyticsParams} from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';

import {StacktraceLinkModal} from './stacktraceLinkModal';
import {useStacktraceLink} from './useStacktraceLink';

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
  const {openModal} = useModal();

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

  const copyFrameLinkAnalyticsParams = {
    group_id: event.groupID ? parseInt(event.groupID, 10) : -1,
    ...getAnalyticsDataForEvent(event),
  };

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
        <CopyFrameLink frame={frame} analyticsParams={copyFrameLinkAnalyticsParams} />
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
        <CopyFrameLink frame={frame} analyticsParams={copyFrameLinkAnalyticsParams} />
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
      </StacktraceLinkWrapper>
    );
  }

  // Hide stacktrace link errors if the stacktrace might be minified javascript
  // Check if the line starts and ends with {snip}
  const isMinifiedJsError =
    event.platform === 'javascript' && /(\{snip\}).*\1/.test(line ?? '');

  const hideErrors = isMinifiedJsError || disableSetup;
  // for .NET projects, if there is no match found but there is a GitHub source link, use that
  if (
    frame.sourceLink &&
    hasGithubSourceLink &&
    (match.error || match.integrations.length > 0)
  ) {
    return (
      <StacktraceLinkWrapper>
        <CopyFrameLink frame={frame} analyticsParams={copyFrameLinkAnalyticsParams} />
        <Tooltip title={t('GitHub')} skipWrapper>
          <ProviderLink
            onClick={onOpenLink}
            href={frame.sourceLink}
            icon={getIntegrationIcon('github', DEFAULT_ICON_SIZE)}
          />
        </Tooltip>
      </StacktraceLinkWrapper>
    );
  }

  // No match found - Has integration but no code mappings
  if (!hideErrors && (match.error || match.integrations.length > 0)) {
    const filename = frame.filename;
    if (!project || !match.integrations.length || !filename) {
      return null;
    }

    const sourceCodeProvider = match.integrations.find(integration =>
      scmProviders.includes(integration.provider?.key)
    );
    const handleSetupClick = (e: React.MouseEvent) => {
      // Prevent from opening/closing the stack frame
      e.stopPropagation();
      trackAnalytics(
        'integrations.stacktrace_start_setup',
        {
          view: 'stacktrace_issue_details',
          platform: event.platform,
          provider: sourceCodeProvider?.provider.key!,
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
    };

    return (
      <StacktraceLinkWrapper data-has-setup="true">
        <CopyFrameLink frame={frame} analyticsParams={copyFrameLinkAnalyticsParams} />
        <SetupCodeMappingButton onClick={handleSetupClick} />
      </StacktraceLinkWrapper>
    );
  }

  return null;
}

// This should never have been set, as the icons inside buttons already auto adjust
// depending on the button size, however the reason it cannot be removed is that the icon
// function initializes a default argument for the icon size to md, meaning we cannot simply remove it.
const DEFAULT_ICON_SIZE = 'xs';
const DEFAULT_BUTTON_SIZE = 'xs';

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

function SetupCodeMappingButton({
  onClick,
}: {
  onClick: React.MouseEventHandler<HTMLButtonElement>;
}) {
  const label = t('Set up Code Mapping');

  return (
    <Fragment>
      <Container display={{'2xs': 'none', md: 'contents'}}>
        <Button
          size={DEFAULT_BUTTON_SIZE}
          variant="transparent"
          icon={<IconCode />}
          onClick={onClick}
        >
          {label}
        </Button>
      </Container>
      <Container display={{'2xs': 'contents', md: 'none'}}>
        <Button
          size={DEFAULT_BUTTON_SIZE}
          variant="transparent"
          icon={<IconCode />}
          aria-label={label}
          tooltipProps={{title: label}}
          onClick={onClick}
        />
      </Container>
    </Fragment>
  );
}

function StacktraceLinkWrapper({
  children,
  ...props
}: {children: React.ReactNode} & React.ComponentPropsWithoutRef<typeof Flex>) {
  return (
    <FadeInStacktraceLinkWrapper align="center" {...props}>
      {children}
    </FadeInStacktraceLinkWrapper>
  );
}

function ProviderLink(props: LinkButtonProps) {
  return (
    <LinkButton size={DEFAULT_BUTTON_SIZE} variant="transparent" external {...props} />
  );
}
