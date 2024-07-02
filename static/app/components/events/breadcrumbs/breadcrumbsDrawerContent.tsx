import {Fragment, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import {Breadcrumbs as NavigationBreadcrumbs} from 'sentry/components/breadcrumbs';
import {Button} from 'sentry/components/button';
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
  const theme = useTheme();
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
          aria-label={t('Search All Breadcrumbs')}
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
          <DropdownButton
            size="xs"
            borderless
            style={{background: filterSet.size > 0 ? theme.purple100 : 'transparent'}}
            icon={<IconFilter />}
            showChevron={false}
            isOpen={isOpen}
            autoFocus={focusControl === BreadcrumbControlOptions.FILTER}
            {...props}
            aria-label={t('Filter All Breadcrumbs')}
          >
            {filterSet.size > 0 ? filterSet.size : null}
          </DropdownButton>
        )}
      />
      <CompactSelect
        size="xs"
        trigger={(props, isOpen) => (
          <DropdownButton
            size="xs"
            borderless
            icon={<IconSort />}
            showChevron={false}
            isOpen={isOpen}
            autoFocus={focusControl === BreadcrumbControlOptions.SORT}
            aria-label={t('Sort All Breadcrumbs')}
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
          <DropdownButton
            size="xs"
            borderless
            icon={<IconClock />}
            showChevron={false}
            isOpen={isOpen}
            aria-label={t('Change Time Format for All Breadcrumbs')}
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
        {displayCrumbs.length === 0 ? (
          <EmptyMessage>
            {t('No breadcrumbs found.')}
            <Button
              priority="link"
              onClick={() => {
                setFilterSet(new Set());
                setSearch('');
              }}
            >
              {t('Clear Filters?')}
            </Button>
          </EmptyMessage>
        ) : (
          <BreadcrumbsTimeline
            breadcrumbs={displayCrumbs}
            meta={meta}
            startTimeString={startTimeString}
            fullyExpanded
          />
        )}
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

const NavigationCrumbs = styled(NavigationBreadcrumbs)`
  margin: 0;
`;

const TimelineContainer = styled('div')`
  grid-column: span 2;
`;

const EmptyMessage = styled('div')`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: ${p => p.theme.subText};
  padding: ${space(3)} ${space(1)};
`;
