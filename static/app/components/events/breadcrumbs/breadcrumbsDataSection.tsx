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
import {getVirtualCrumb} from 'sentry/components/events/interfaces/breadcrumbs/utils';
import useDrawer from 'sentry/components/globalDrawer';
import {IconClock, IconEllipsis, IconFilter, IconSearch, IconSort} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {RawCrumb} from 'sentry/types/breadcrumbs';
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
  // Use the local storage preferences, but allow the drawer to do updates
  const [timeDisplay, setTimeDisplay] = useLocalStorageState<BreadcrumbTimeDisplay>(
    BREADCRUMB_TIME_DISPLAY_LOCALSTORAGE_KEY,
    BreadcrumbTimeDisplay.RELATIVE
  );
  const {openDrawer} = useDrawer();

  const breadcrumbEntryIndex =
    event.entries?.findIndex(entry => entry.type === EntryType.BREADCRUMBS) ?? -1;
  const breadcrumbs: RawCrumb[] = useMemo(
    () => event.entries?.[breadcrumbEntryIndex]?.data?.values ?? [],
    [event, breadcrumbEntryIndex]
  );
  // Mapping of breadcrumb index -> breadcrumb meta
  const meta: Record<number, any> =
    event._meta?.entries?.[breadcrumbEntryIndex]?.data?.values;

  let allCrumbs = useMemo(() => [...breadcrumbs], [breadcrumbs]);
  // The virtual crumb is a representation of this event, displayed alongside
  // the rest of the breadcrumbs for more additional context.
  const virtualCrumb = useMemo(() => getVirtualCrumb(event), [event]);
  if (virtualCrumb) {
    allCrumbs = [...breadcrumbs, virtualCrumb];
  }

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
        {ariaLabel: 'breadcrumbs drawer'}
      );
    },
    [allCrumbs, meta, group, event, project, openDrawer]
  );

  if (!breadcrumbEntryIndex) {
    return null;
  }

  if (breadcrumbs.length <= 0) {
    return null;
  }

  const summaryCrumbs = getSummaryBreadcrumbs(allCrumbs);
  const isFullLength = summaryCrumbs.length === allCrumbs.length;

  const startTimeString =
    timeDisplay === BreadcrumbTimeDisplay.RELATIVE
      ? allCrumbs?.at(-1)?.timestamp
      : undefined;

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
        aria-label={t('Change Breadcrumb Time Format')}
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
        {allCrumbs.length ? (
          <BreadcrumbsTimeline
            breadcrumbs={summaryCrumbs}
            virtualCrumbIndex={virtualCrumb ? 0 : undefined}
            meta={meta}
            startTimeString={startTimeString}
          />
        ) : (
          <EmptyBreadcrumbsMessage>{t('No breadcrumbs found. ')}</EmptyBreadcrumbsMessage>
        )}
        {!isFullLength && (
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

const EmptyBreadcrumbsMessage = styled('div')`
  border: 1px solid ${p => p.theme.border};
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: ${p => p.theme.subText};
  border-radius: 4px;
  padding: ${space(3)} ${space(1)};
`;

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
