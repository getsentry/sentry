import {Fragment} from 'react';
import omit from 'lodash/omit';

import {BreadcrumbList} from '@sentry/scraps/breadcrumbList';

import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {extractSelectionParameters} from 'sentry/components/pageFilters/parse';
import {Placeholder} from 'sentry/components/placeholder';
import {IconCopyId, IconEllipsis, IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {generateLinkToEventInTraceView} from 'sentry/utils/discover/urls';
import {getShortEventId} from 'sentry/utils/events';
import {generateProfilingRouteWithQuery} from 'sentry/utils/profiling/routes';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import type {SpanResponse} from 'sentry/views/insights/types';
import {SpanFields} from 'sentry/views/insights/types';
import {TopBar} from 'sentry/views/navigation/topBar';
import {profilesRouteWithQuery} from 'sentry/views/performance/transactionSummary/transactionProfiles/utils';

const COPY_ID_LABEL = t('Copy profiler ID to clipboard');

interface ContinuousProfileHeaderProps {
  profilerId: string;
  projectId: string;
  transactionSpan:
    | Pick<SpanResponse, 'trace' | 'span_id' | 'precise.finish_ts' | 'span.description'>
    | undefined;
}

export function ContinuousProfileHeader({
  profilerId,
  projectId,
  transactionSpan,
}: ContinuousProfileHeaderProps) {
  const location = useLocation();
  const organization = useOrganization();
  const {copy} = useCopyToClipboard();
  const {projects} = useProjects();

  // A transaction span's description is the transaction name.
  const transactionName = transactionSpan?.[SpanFields.SPAN_DESCRIPTION] ?? '';
  const project = projects.find(p => p.slug === projectId);

  // Decorative only — the 16x16 leading slot is aria-hidden, so `hideName` keeps
  // the slug out of it and `disableLink` keeps a tabbable anchor out of it. The
  // placeholder holds the space so the title doesn't shift as projects load.
  const projectGraphic = project ? (
    <ProjectBadge disableLink project={project} avatarSize={16} hideName />
  ) : (
    <Placeholder width="16px" height="16px" />
  );

  // Replaces the legacy `preservePageFilters` flag that was on every crumb:
  // BreadcrumbList link items build their own query, so the page filter params
  // have to be forwarded explicitly or navigating clears the selection.
  //
  // `start`/`end` are excluded because this page does not use them as a page
  // filter: `generateContinuousProfileFlamechartRouteWithQuery` injects the
  // chunk's own time window into them, which is a few seconds wide. Forwarding
  // that would open both destinations on a window with nothing in it. Dropping
  // them lets the destination fall back to the viewer's pinned range, or the
  // default period. A `statsPeriod` carried in from an earlier page is inert
  // here (an absolute range nulls the period) but still meaningful there, so it
  // travels — clearing start/end is what keeps the two from competing.
  const selection = omit(extractSelectionParameters(location.query), [
    'start',
    'end',
    'utc',
  ]);

  // `profilesRouteWithQuery` reads environment/statsPeriod/start/end/query off
  // the query it is given. Passing `selection` — which can only hold page filter
  // keys — means this page's own `query` search param cannot leak into the
  // transaction summary as a filter. The outer merge reproduces the legacy
  // BreadcrumbLink ordering: selection first, the crumb's own query on top.
  const transactionSummaryTarget =
    transactionName && project
      ? profilesRouteWithQuery({
          organization,
          transaction: transactionName,
          projectID: project.id,
          query: selection,
        })
      : null;

  const items = [
    {
      type: 'link' as const,
      label: t('Profiles'),
      to: generateProfilingRouteWithQuery({organization, query: selection}),
    },
    ...(transactionSummaryTarget
      ? [
          {
            type: 'link' as const,
            label: transactionName,
            leadingGraphic: projectGraphic,
            to: {
              ...transactionSummaryTarget,
              query: {...selection, ...transactionSummaryTarget.query},
            },
          },
        ]
      : []),
  ];

  const transactionTarget = transactionSpan
    ? generateLinkToEventInTraceView({
        timestamp: transactionSpan[SpanFields.PRECISE_FINISH_TS],
        targetId: transactionSpan[SpanFields.SPAN_ID],
        traceSlug: transactionSpan[SpanFields.TRACE],
        location,
        organization,
      })
    : null;

  const handleGoToTransaction = () => {
    trackAnalytics('profiling_views.go_to_transaction', {
      organization,
    });
  };

  return (
    <Fragment>
      <TopBar.Slot name="breadcrumbs">
        <BreadcrumbList items={items} />
      </TopBar.Slot>
      <TopBar.Slot name="title">
        <BreadcrumbList.Title
          item={{
            type: 'page-title',
            label: getShortEventId(profilerId),
            labelTooltip: profilerId,
            leadingGraphic: projectGraphic,
            trailingActions: {
              type: 'menu',
              triggerLabel: t('Profile Actions'),
              triggerIcon: <IconEllipsis />,
              items: [
                {
                  key: 'copy-profiler-id',
                  label: COPY_ID_LABEL,
                  leadingItems: <IconCopyId variant="muted" />,
                  onAction: () => copy(profilerId),
                },
                ...(transactionTarget
                  ? [
                      {
                        key: 'open-trace',
                        label: t('Open Trace'),
                        leadingItems: <IconOpen variant="muted" />,
                        to: transactionTarget,
                        // Fires from the item, not the menu, so it cannot
                        // attribute a sibling selection as a trace open.
                        onAction: handleGoToTransaction,
                      },
                    ]
                  : []),
              ],
            },
          }}
        />
      </TopBar.Slot>
      <TopBar.Slot name="feedback">
        <FeedbackButton
          aria-label={t('Give Feedback')}
          tooltipProps={{title: t('Give Feedback')}}
        >
          {null}
        </FeedbackButton>
      </TopBar.Slot>
    </Fragment>
  );
}
