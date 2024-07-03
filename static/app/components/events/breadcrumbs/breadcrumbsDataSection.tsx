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
  getSummaryBreadcrumbs,
} from 'sentry/components/events/breadcrumbs/utils';
import {EventDataSection} from 'sentry/components/events/eventDataSection';
import {
  convertCrumbType,
  getVirtualCrumb,
} from 'sentry/components/events/interfaces/breadcrumbs/utils';
import useDrawer from 'sentry/components/globalDrawer';
import {IconClock, IconEllipsis, IconFilter, IconSearch, IconSort} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {EntryType, type Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';

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
  // Use the local storage preferences, but allow the drawer to do updates
  const [timeDisplay, setTimeDisplay] = useLocalStorageState<BreadcrumbTimeDisplay>(
    BREADCRUMB_TIME_DISPLAY_LOCALSTORAGE_KEY,
    BreadcrumbTimeDisplay.RELATIVE
  );

  const {allCrumbs, isEmpty, meta, summaryCrumbs, startTimeString, virtualCrumb} =
    useMemo(() => {
      const breadcrumbEntryIndex =
        event.entries?.findIndex(entry => entry.type === EntryType.BREADCRUMBS) ?? -1;
      const breadcrumbs = event.entries?.[breadcrumbEntryIndex]?.data?.values ?? [];
      // Mapping of breadcrumb index -> breadcrumb meta
      const _meta: Record<number, any> =
        event._meta?.entries?.[breadcrumbEntryIndex]?.data?.values;
      // Converts breadcrumbs into other types if sufficient data is present.
      const convertedCrumbs = breadcrumbs.map(convertCrumbType);

      // The virtual crumb is a representation of this event, displayed alongside
      // the rest of the breadcrumbs for more additional context.
      const _virtualCrumb = getVirtualCrumb(event);
      const _allCrumbs = _virtualCrumb
        ? [...convertedCrumbs, _virtualCrumb]
        : convertedCrumbs;
      return {
        allCrumbs: _allCrumbs,
        isEmpty: breadcrumbEntryIndex === -1 || breadcrumbs.length === 0,
        meta: _meta,
        summaryCrumbs: getSummaryBreadcrumbs(_allCrumbs),
        startTimeString:
          timeDisplay === BreadcrumbTimeDisplay.RELATIVE
            ? _allCrumbs?.at(-1)?.timestamp
            : undefined,
        virtualCrumb: _virtualCrumb,
      };
    }, [event, timeDisplay]);

  const onViewAllBreadcrumbs = useCallback(
    (focusControl?: BreadcrumbControlOptions) => {
      openDrawer(
        ({Body}) => (
          <Body>
            <BreadcrumbsDrawerContent
              allBreadcrumbs={allCrumbs}
              meta={meta}
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
    [allCrumbs, meta, group, event, project, openDrawer]
  );

  if (isEmpty) {
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
        onClick={() =>
          setTimeDisplay(
            timeDisplay === BreadcrumbTimeDisplay.ABSOLUTE
              ? BreadcrumbTimeDisplay.RELATIVE
              : BreadcrumbTimeDisplay.ABSOLUTE
          )
        }
        size="xs"
      />
    </ButtonBar>
  );

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
          virtualCrumbIndex={virtualCrumb ? 0 : undefined}
          meta={meta}
          startTimeString={startTimeString}
        />
        {summaryCrumbs.length !== allCrumbs.length && (
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
