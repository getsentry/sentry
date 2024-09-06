import {useMemo} from 'react';

import {usePrompt} from 'sentry/actionCreators/prompts';
import useStacktraceLink from 'sentry/components/events/interfaces/frame/useStacktraceLink';
import {hasFileExtension} from 'sentry/components/events/interfaces/frame/utils';
import type {Event, Frame} from 'sentry/types/event';
import type {StacktraceType} from 'sentry/types/stacktrace';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getAnalyticsDataForEvent} from 'sentry/utils/events';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

import {AddIntegrationBanner} from './addIntegrationBanner';

const integrationPromptKey = 'stacktrace_link';

interface StacktraceBannersProps {
  event: Event;
  stacktrace: StacktraceType;
}

export function StacktraceBanners({stacktrace, event}: StacktraceBannersProps) {
  const organization = useOrganization({allowNull: true});
  const {projects} = useProjects();
  const expectedDefaultFrame: Frame | undefined = (stacktrace.frames ?? [])
    .filter(
      frame => frame?.inApp && hasFileExtension(frame.absPath || frame.filename || '')
    )
    .at(-1);
  const project = useMemo(
    () => projects.find(p => p.id === event.projectID),
    [projects, event]
  );

  const enabled = !!organization && !!expectedDefaultFrame && !!project;

  const {data: stacktraceLink} = useStacktraceLink(
    {
      event,
      frame: expectedDefaultFrame ?? {},
      orgSlug: organization?.slug!,
      projectSlug: project?.slug!,
    },
    {
      enabled,
    }
  );

  const {isLoading, isError, isPromptDismissed, dismissPrompt} = usePrompt({
    organization: organization!,
    feature: integrationPromptKey,
    projectId: project?.id,
    options: {enabled},
  });

  if (!enabled || !stacktraceLink || isLoading || isError) {
    return null;
  }

  // No integrations installed, show banner
  if (stacktraceLink.integrations.length === 0 && !isPromptDismissed) {
    return (
      <AddIntegrationBanner
        orgSlug={organization.slug}
        onDismiss={() => {
          dismissPrompt();
          trackAnalytics('integrations.stacktrace_link_cta_dismissed', {
            view: 'stacktrace_issue_details',
            organization,
            ...getAnalyticsDataForEvent(event),
          });
        }}
      />
    );
  }

  return null;
}
