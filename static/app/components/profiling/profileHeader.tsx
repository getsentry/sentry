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
import {TopBar} from 'sentry/views/navigation/topBar';
import {profilesRouteWithQuery} from 'sentry/views/performance/transactionSummary/transactionProfiles/utils';

interface ProfileHeaderProps {
  /** A profile ID, or a profiler ID for a continuous profile. */
  profileId: string;
  projectId: string;
  transactionName: string;
  transactionSpan:
    | Pick<SpanResponse, 'trace' | 'span_id' | 'precise.finish_ts'>
    | undefined;
  variant: 'continuous' | 'transaction';
}

export function ProfileHeader({
  profileId,
  projectId,
  transactionName,
  transactionSpan,
  variant,
}: ProfileHeaderProps) {
  const location = useLocation();
  const organization = useOrganization();
  const {copy} = useCopyToClipboard();
  const {projects} = useProjects();

  const isContinuous = variant === 'continuous';
  const copyIdLabel = isContinuous
    ? t('Copy profiler ID to clipboard')
    : t('Copy profile ID to clipboard');

  const project = projects.find(p => p.slug === projectId);

  const projectGraphic = project ? (
    <ProjectBadge disableLink project={project} avatarSize={16} hideName />
  ) : (
    <Placeholder width="16px" height="16px" />
  );

  const pageFilters = extractSelectionParameters(location.query);
  // A continuous profile's start/end are the chunk window, not a page filter.
  const selection = isContinuous
    ? omit(pageFilters, ['start', 'end', 'utc'])
    : pageFilters;

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

  const transactionTarget = transactionSpan?.span_id
    ? generateLinkToEventInTraceView({
        timestamp: transactionSpan['precise.finish_ts'],
        targetId: transactionSpan.span_id,
        traceSlug: transactionSpan.trace,
        location,
        organization,
      })
    : null;

  const handleGoToTransaction = () => {
    trackAnalytics('profiling_views.go_to_transaction', {organization});
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
            label: getShortEventId(profileId),
            labelTooltip: profileId,
            leadingGraphic: projectGraphic,
            trailingActions: {
              type: 'menu',
              triggerLabel: t('Profile Actions'),
              triggerIcon: <IconEllipsis />,
              items: [
                {
                  key: 'copy-profile-id',
                  label: copyIdLabel,
                  leadingItems: <IconCopyId variant="muted" />,
                  onAction: () => copy(profileId),
                },
                ...(transactionTarget
                  ? [
                      {
                        key: 'open-trace',
                        label: t('Open Trace'),
                        leadingItems: <IconOpen variant="muted" />,
                        to: transactionTarget,
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
