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
import {InputGroup} from 'sentry/components/inputGroup';
import {IconClock, IconFilter, IconSearch, IconSort} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {RawCrumb} from 'sentry/types/breadcrumbs';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';

export const enum BreadcrumbControlOptions {
  SEARCH = 'search',
  FILTER = 'filter',
  SORT = 'sort',
}

interface BreadcrumbsDrawerContentProps {
  /**
   * Assumes crumbs are sorted from oldest to newest.
   */
  allBreadcrumbs: RawCrumb[];
  event: Event;
  group: Group;
  project: Project;
  focusControl?: BreadcrumbControlOptions;
  meta?: Record<string, any>;
}

export function BreadcrumbsDrawerContent({
  event,
  group,
  project,
  allBreadcrumbs,
  meta,
  focusControl,
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

  const displayCrumbs = useMemo(() => {
    const sortedCrumbs =
      sort === BreadcrumbSort.OLDEST ? allBreadcrumbs : [...allBreadcrumbs].reverse();
    const filteredCrumbs = sortedCrumbs.filter(bc =>
      filterSet.size === 0 ? true : filterSet.has(bc.type)
    );
    const searchedCrumbs = applyBreadcrumbSearch(search, filteredCrumbs);
    return searchedCrumbs;
  }, [allBreadcrumbs, sort, filterSet, search]);

  const startTimeString = useMemo(
    () =>
      timeDisplay === BreadcrumbTimeDisplay.RELATIVE
        ? displayCrumbs?.at(0)?.timestamp
        : undefined,
    [displayCrumbs, timeDisplay]
  );

  const actions = (
    <ButtonBar gap={1}>
      <InputGroup>
        <SearchInput
          size="xs"
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus={focusControl === BreadcrumbControlOptions.SEARCH}
        />
        <InputGroup.TrailingItems disablePointerEvents>
          <IconSearch size="xs" />
        </InputGroup.TrailingItems>
      </InputGroup>
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
          <BreadcrumbControl
            size="xs"
            isActive={filterSet.size > 0}
            icon={<IconFilter />}
            showChevron={false}
            isOpen={isOpen}
            autoFocus={focusControl === BreadcrumbControlOptions.FILTER}
            {...props}
          >
            {filterSet.size > 0 ? filterSet.size : null}
          </BreadcrumbControl>
        )}
      />
      <CompactSelect
        size="xs"
        trigger={(props, isOpen) => (
          <BreadcrumbControl
            size="xs"
            icon={<IconSort />}
            showChevron={false}
            isOpen={isOpen}
            autoFocus={focusControl === BreadcrumbControlOptions.SORT}
            {...props}
          />
        )}
        onChange={selectedOption => setSort(selectedOption.value)}
        value={sort}
        options={BREADCRUMB_SORT_OPTIONS}
      />
      <CompactSelect
        size="xs"
        trigger={(props, isOpen) => (
          <BreadcrumbControl
            size="xs"
            icon={<IconClock />}
            showChevron={false}
            isOpen={isOpen}
            {...props}
          />
        )}
        onChange={selectedOption => setTimeDisplay(selectedOption.value)}
        value={timeDisplay}
        options={BREADCRUMB_TIME_DISPLAY_OPTIONS}
      >
        {null}
      </CompactSelect>
    </ButtonBar>
  );

  return (
    <Fragment>
      <NavigationCrumbs
        crumbs={[
          {
            label: (
              <CrumbContainer>
                <ProjectAvatar project={project} />
                <GroupShortId>{group.shortId}</GroupShortId>
              </CrumbContainer>
            ),
          },
          {
            label: <GroupShortId>{event.id.substring(0, 8)}</GroupShortId>,
          },
          {label: t('Breadcrumbs')},
        ]}
      />
      <HeaderGrid>
        <Header>{t('Breadcrumbs')}</Header>
        {actions}
      </HeaderGrid>
      <TimelineContainer>
        <BreadcrumbsTimeline
          breadcrumbs={displayCrumbs}
          meta={meta}
          startTimeString={startTimeString}
          fullyExpanded
        />
      </TimelineContainer>
    </Fragment>
  );
}

const CrumbContainer = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
`;

const GroupShortId = styled('div')`
  font-family: ${p => p.theme.text.family};
  font-size: ${p => p.theme.fontSizeMedium};
  line-height: 1;
`;

const HeaderGrid = styled('div')`
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  column-gap: ${space(1)};
  margin: ${space(1)} 0 ${space(2)};
`;

const Header = styled('h3')`
  display: block;
  font-size: ${p => p.theme.fontSizeExtraLarge};
  font-weight: ${p => p.theme.fontWeightBold};
  margin: 0;
`;

const SearchInput = styled(InputGroup.Input)`
  border: 0;
  box-shadow: unset;
  color: inherit;
`;

const BreadcrumbControl = styled(DropdownButton)<{isActive?: boolean}>`
  border: 0;
  background: ${p => (p.isActive ? p.theme.purple100 : 'transparent')};
`;

const NavigationCrumbs = styled(NavigationBreadcrumbs)`
  margin: 0;
`;

const TimelineContainer = styled('div')`
  grid-column: span 2;
`;
