import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {
  BreadcrumbControlOptions,
  BreadcrumbsDrawerContent,
} from 'sentry/components/events/breadcrumbs/breadcrumbsDrawerContent';
import BreadcrumbsTimeline from 'sentry/components/events/breadcrumbs/breadcrumbsTimeline';
import {
  BREADCRUMB_TIME_DISPLAY_LOCALSTORAGE_KEY,
  BreadcrumbTimeDisplay,
  getEnhancedBreadcrumbs,
  getSummaryBreadcrumbs,
} from 'sentry/components/events/breadcrumbs/utils';
import {EventDataSection} from 'sentry/components/events/eventDataSection';
import useDrawer from 'sentry/components/globalDrawer';
import {IconClock, IconEllipsis, IconFilter, IconSearch, IconSort} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import useOrganization from 'sentry/utils/useOrganization';

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
  // Use the local storage preferences, but allow the drawer to do updates
  const [timeDisplay, setTimeDisplay] = useLocalStorageState<BreadcrumbTimeDisplay>(
    BREADCRUMB_TIME_DISPLAY_LOCALSTORAGE_KEY,
    BreadcrumbTimeDisplay.RELATIVE
  );

  const enhancedCrumbs = useMemo(() => getEnhancedBreadcrumbs(event), [event]);
  const summaryCrumbs = useMemo(
    () => getSummaryBreadcrumbs(enhancedCrumbs),
    [enhancedCrumbs]
  );
  const startTimeString = useMemo(
    () =>
      timeDisplay === BreadcrumbTimeDisplay.RELATIVE
        ? enhancedCrumbs?.at(-1)?.breadcrumb?.timestamp
        : undefined,
    [enhancedCrumbs, timeDisplay]
  );

  const onViewAllBreadcrumbs = useCallback(
    (focusControl?: BreadcrumbControlOptions) => {
      trackAnalytics('breadcrumbs.issue_details.drawer_opened', {
        control: focusControl ?? 'view all',
        organization,
      });
      openDrawer(
        ({Body}) => (
          <Body>
            <BreadcrumbsDrawerContent
              breadcrumbs={enhancedCrumbs}
              group={group}
              event={event}
              project={project}
              focusControl={focusControl}
            />
          </Body>
        ),
        {ariaLabel: 'breadcrumb drawer'}
      );
    },
    [group, event, project, openDrawer, enhancedCrumbs, organization]
  );

  if (enhancedCrumbs.length === 0) {
    return null;
  }

  const actions = (
    <ButtonBar gap={1}>
      <Button
        aria-label={t('Search Breadcrumbs')}
        icon={<IconSearch size="xs" />}
        size="xs"
        onClick={() => onViewAllBreadcrumbs(BreadcrumbControlOptions.SEARCH)}
      />
      <Button
        aria-label={t('Filter Breadcrumbs')}
        icon={<IconFilter size="xs" />}
        size="xs"
        onClick={() => onViewAllBreadcrumbs(BreadcrumbControlOptions.FILTER)}
      />
      <Button
        aria-label={t('Sort Breadcrumbs')}
        icon={<IconSort size="xs" />}
        size="xs"
        onClick={() => onViewAllBreadcrumbs(BreadcrumbControlOptions.SORT)}
      />
      <Button
        aria-label={t('Change Time Format for Breadcrumbs')}
        icon={<IconClock size="xs" />}
        onClick={() => {
          const nextTimeDisplay =
            timeDisplay === BreadcrumbTimeDisplay.ABSOLUTE
              ? BreadcrumbTimeDisplay.RELATIVE
              : BreadcrumbTimeDisplay.ABSOLUTE;
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
    <EventDataSection
      key="breadcrumbs"
      type="breadcrmbs"
      title={t('Breadcrumbs')}
      data-test-id="breadcrumbs-data-section"
      actions={actions}
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
    </EventDataSection>
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
