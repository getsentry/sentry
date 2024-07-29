import {useCallback, useMemo, useRef} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {
  BreadcrumbControlOptions,
  BreadcrumbsDrawer,
} from 'sentry/components/events/breadcrumbs/breadcrumbsDrawer';
import BreadcrumbsTimeline from 'sentry/components/events/breadcrumbs/breadcrumbsTimeline';
import {
  BREADCRUMB_TIME_DISPLAY_LOCALSTORAGE_KEY,
  BREADCRUMB_TIME_DISPLAY_OPTIONS,
  BreadcrumbTimeDisplay,
  getEnhancedBreadcrumbs,
  getSummaryBreadcrumbs,
} from 'sentry/components/events/breadcrumbs/utils';
import {
  BREADCRUMB_SORT_LOCALSTORAGE_KEY,
  BreadcrumbSort,
} from 'sentry/components/events/interfaces/breadcrumbs';
import useFeedbackWidget from 'sentry/components/feedback/widget/useFeedbackWidget';
import useDrawer from 'sentry/components/globalDrawer';
import {
  IconClock,
  IconEllipsis,
  IconMegaphone,
  IconSearch,
  IconTimer,
} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import useOrganization from 'sentry/utils/useOrganization';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';
import {FoldSectionKey} from 'sentry/views/issueDetails/streamline/foldSection';

interface BreadcrumbsDataSectionProps {
  event: Event;
  group: Group;
  project: Project;
}

export default function BreadcrumbsDataSection({
  event,
  group,
  project,
}: BreadcrumbsDataSectionProps) {
  const {openDrawer} = useDrawer();
  const organization = useOrganization();
  const [timeDisplay, setTimeDisplay] = useLocalStorageState<BreadcrumbTimeDisplay>(
    BREADCRUMB_TIME_DISPLAY_LOCALSTORAGE_KEY,
    BreadcrumbTimeDisplay.ABSOLUTE
  );
  // Use the local storage preferences, but allow the drawer to do updates
  const [sort, _setSort] = useLocalStorageState<BreadcrumbSort>(
    BREADCRUMB_SORT_LOCALSTORAGE_KEY,
    BreadcrumbSort.NEWEST
  );

  const enhancedCrumbs = useMemo(() => getEnhancedBreadcrumbs(event), [event]);
  const summaryCrumbs = useMemo(
    () => getSummaryBreadcrumbs(enhancedCrumbs, sort),
    [enhancedCrumbs, sort]
  );
  const startTimeString = useMemo(
    () =>
      timeDisplay === BreadcrumbTimeDisplay.RELATIVE
        ? summaryCrumbs?.at(0)?.breadcrumb?.timestamp
        : undefined,
    [summaryCrumbs, timeDisplay]
  );

  const onViewAllBreadcrumbs = useCallback(
    (focusControl?: BreadcrumbControlOptions) => {
      trackAnalytics('breadcrumbs.issue_details.drawer_opened', {
        control: focusControl ?? 'view all',
        organization,
      });
      openDrawer(
        () => (
          <BreadcrumbsDrawer
            breadcrumbs={enhancedCrumbs}
            focusControl={focusControl}
            project={project}
            event={event}
            group={group}
          />
        ),
        {ariaLabel: 'breadcrumb drawer'}
      );
    },
    [group, event, project, openDrawer, enhancedCrumbs, organization]
  );

  if (enhancedCrumbs.length === 0) {
    return null;
  }

  const nextTimeDisplay =
    timeDisplay === BreadcrumbTimeDisplay.ABSOLUTE
      ? BreadcrumbTimeDisplay.RELATIVE
      : BreadcrumbTimeDisplay.ABSOLUTE;

  const actions = (
    <ButtonBar gap={1}>
      <BreadcrumbsFeedback />
      <Button
        aria-label={t('Open Breadcrumb Search')}
        icon={<IconSearch size="xs" />}
        size="xs"
        title={t('Open Search')}
        onClick={() => onViewAllBreadcrumbs(BreadcrumbControlOptions.SEARCH)}
      />
      <Button
        aria-label={t('Change Time Format for Breadcrumbs')}
        title={tct('Use [format] Timestamps', {
          format: BREADCRUMB_TIME_DISPLAY_OPTIONS[nextTimeDisplay].label,
        })}
        icon={
          timeDisplay === BreadcrumbTimeDisplay.ABSOLUTE ? (
            <IconClock size="xs" />
          ) : (
            <IconTimer size="xs" />
          )
        }
        onClick={() => {
          setTimeDisplay(nextTimeDisplay);
          trackAnalytics('breadcrumbs.issue_details.change_time_display', {
            value: nextTimeDisplay,
            organization,
          });
        }}
        size="xs"
      />
    </ButtonBar>
  );

  const hasViewAll = summaryCrumbs.length !== enhancedCrumbs.length;

  return (
    <InterimSection
      key="breadcrumbs"
      type="breadcrmbs"
      title={t('Breadcrumbs')}
      data-test-id="breadcrumbs-data-section"
      actions={actions}
      sectionKey={FoldSectionKey.BREADCRUMBS}
    >
      <ErrorBoundary mini message={t('There was an error loading the event breadcrumbs')}>
        <BreadcrumbsTimeline
          breadcrumbs={summaryCrumbs}
          startTimeString={startTimeString}
          // We want the timeline to appear connected to the 'View All' button
          showLastLine={hasViewAll}
        />
        {hasViewAll && (
          <ViewAllContainer>
            <VerticalEllipsis />
            <div>
              <ViewAllButton
                size="sm"
                onClick={() => onViewAllBreadcrumbs()}
                aria-label={t('View All Breadcrumbs')}
              >
                {t('View All')}
              </ViewAllButton>
            </div>
          </ViewAllContainer>
        )}
      </ErrorBoundary>
    </InterimSection>
  );
}

function BreadcrumbsFeedback() {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const feedback = useFeedbackWidget({
    buttonRef,
    messagePlaceholder: t('How can we make breadcrumbs more useful to you?'),
  });

  if (!feedback) {
    return null;
  }

  return (
    <Button
      ref={buttonRef}
      aria-label={t('Give Feedback')}
      icon={<IconMegaphone />}
      size={'xs'}
    >
      {t('Give Feedback')}
    </Button>
  );
}

const ViewAllContainer = styled('div')`
  position: relative;
  display: grid;
  grid-template-columns: auto 1fr;
  margin-top: ${space(1)};
  &::after {
    content: '';
    position: absolute;
    left: 10.5px;
    width: 1px;
    top: -${space(1)};
    height: ${space(1)};
    background: ${p => p.theme.border};
  }
`;

const VerticalEllipsis = styled(IconEllipsis)`
  height: 22px;
  color: ${p => p.theme.subText};
  margin: ${space(0.5)};
  transform: rotate(90deg);
`;

const ViewAllButton = styled(Button)`
  padding: ${space(0.75)} ${space(1)};
`;
