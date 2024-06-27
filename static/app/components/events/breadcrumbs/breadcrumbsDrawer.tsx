import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import {Breadcrumbs as NavigationBreadcrumbs} from 'sentry/components/breadcrumbs';
import ButtonBar from 'sentry/components/buttonBar';
import {CompactSelect} from 'sentry/components/compactSelect';
import DropdownButton from 'sentry/components/dropdownButton';
import BreadcrumbsTimeline from 'sentry/components/events/breadcrumbs/breadcrumbsTimeline';
import {
  applyBreadcrumbSearch,
  BREADCRUMB_TIME_DISPLAY_LOCALSTORAGE_KEY,
  BREADCRUMB_TIME_DISPLAY_OPTIONS,
  BreadcrumbTimeDisplay,
  getBreadcrumbFilters,
} from 'sentry/components/events/breadcrumbs/utils';
import {
  BREADCRUMB_SORT_LOCALSTORAGE_KEY,
  BREADCRUMB_SORT_OPTIONS,
  BreadcrumbSort,
} from 'sentry/components/events/interfaces/breadcrumbs';
import Input from 'sentry/components/input';
import type {TimelineItemProps} from 'sentry/components/timeline';
import {IconClock, IconFilter, IconSort} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {RawCrumb} from 'sentry/types/breadcrumbs';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';

interface BreadcrumbsDrawerContentProps {
  allBreadcrumbs: RawCrumb[];
  event: Event;
  group: Group;
  project: Project;
  meta?: Record<string, any>;
  startTimeString?: TimelineItemProps['startTimeString'];
  virtualCrumbIndex?: number;
}

export function BreadcrumbsDrawerContent({
  event,
  group,
  project,
  virtualCrumbIndex,
  allBreadcrumbs,
  meta,
  startTimeString,
}: BreadcrumbsDrawerContentProps) {
  const [search, setSearch] = useState('');
  const [filterSet, setFilterSet] = useState(new Set<string>());
  const [sort, setSort] = useLocalStorageState<BreadcrumbSort>(
    BREADCRUMB_SORT_LOCALSTORAGE_KEY,
    BreadcrumbSort.NEWEST
  );
  const [timeDisplay, setTimeDisplay] = useLocalStorageState<BreadcrumbTimeDisplay>(
    BREADCRUMB_TIME_DISPLAY_LOCALSTORAGE_KEY,
    BreadcrumbTimeDisplay.RELATIVE
  );

  const filterOptions = useMemo(
    () => getBreadcrumbFilters(allBreadcrumbs),
    [allBreadcrumbs]
  );
  const filteredCrumbs = allBreadcrumbs.filter(bc =>
    filterSet.size === 0 ? true : filterSet.has(bc.type)
  );
  const searchedCrumbs = useMemo(
    () => applyBreadcrumbSearch(search, filteredCrumbs),
    [search, filteredCrumbs]
  );

  const actions = (
    <ButtonBar gap={1}>
      <Input
        size="xs"
        placeholder={t('Search')}
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      <CompactSelect
        size="xs"
        onChange={options => {
          const newFilters = options.map(({value}) => value);
          setFilterSet(new Set(newFilters));
        }}
        multiple
        options={filterOptions}
        maxMenuHeight={400}
        trigger={(props, isOpen) => (
          <DropdownButton
            isOpen={isOpen}
            size="xs"
            icon={<IconFilter size="xs" />}
            {...props}
          >
            {filterSet.size
              ? tn('%s Active Filter', '%s Active Filters', filterSet.size)
              : t('Filter')}
          </DropdownButton>
        )}
      />
      <CompactSelect
        size="xs"
        triggerProps={{
          icon: <IconSort size="xs" />,
        }}
        onChange={selectedOption => {
          setSort(selectedOption.value);
        }}
        value={sort}
        options={BREADCRUMB_SORT_OPTIONS}
      />
      <CompactSelect
        size="xs"
        triggerProps={{
          icon: <IconClock size="xs" />,
        }}
        onChange={selectedOption => {
          setTimeDisplay(selectedOption.value);
        }}
        value={timeDisplay}
        options={BREADCRUMB_TIME_DISPLAY_OPTIONS}
      />
    </ButtonBar>
  );

  return (
    <Fragment>
      <DrawerCrumbs
        crumbs={[
          {
            label: (
              <NavCrumbContainer>
                <ProjectAvatar project={project} />
                <GroupShortId> {group.shortId}</GroupShortId>
              </NavCrumbContainer>
            ),
          },
          {
            label: <GroupShortId>{event.id.substring(0, 9)}</GroupShortId>,
          },
          {label: t('Breadcrumbs')},
        ]}
      />
      <BreadcrumbHeaderGrid>
        <BreadcrumbHeader>{t('Breadcrumbs')}</BreadcrumbHeader>
        {actions}
      </BreadcrumbHeaderGrid>
      <BreadcrumbTimelineContainer>
        <BreadcrumbsTimeline
          breadcrumbs={searchedCrumbs}
          virtualCrumbIndex={virtualCrumbIndex}
          meta={meta}
          startTimeString={startTimeString}
          fullyExpanded
        />
      </BreadcrumbTimelineContainer>
    </Fragment>
  );
}

const BreadcrumbHeaderGrid = styled('div')`
  display: grid;
  grid-template-columns: 1fr auto;
  margin: ${space(1.5)} 0;
`;

const BreadcrumbHeader = styled('h3')`
  display: block;
  margin: 0;
  font-size: ${p => p.theme.fontSizeExtraLarge};
  font-weight: ${p => p.theme.fontWeightBold};
`;

const DrawerCrumbs = styled(NavigationBreadcrumbs)`
  margin: 0;
`;

const BreadcrumbTimelineContainer = styled('div')`
  grid-column: span 2;
`;

const NavCrumbContainer = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
`;

const GroupShortId = styled('div')`
  font-family: ${p => p.theme.text.family};
  font-size: ${p => p.theme.fontSizeMedium};
  line-height: 1;
`;
