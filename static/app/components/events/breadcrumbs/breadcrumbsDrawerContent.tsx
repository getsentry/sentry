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
  type EnhancedCrumb,
  getBreadcrumbFilterOptions,
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
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import useOrganization from 'sentry/utils/useOrganization';

export const enum BreadcrumbControlOptions {
  SEARCH = 'search',
  FILTER = 'filter',
  SORT = 'sort',
}

interface BreadcrumbsDrawerContentProps {
  breadcrumbs: EnhancedCrumb[];
  event: Event;
  group: Group;
  project: Project;
  focusControl?: BreadcrumbControlOptions;
}

export function BreadcrumbsDrawerContent({
  event,
  group,
  project,
  breadcrumbs,
  focusControl,
}: BreadcrumbsDrawerContentProps) {
  const organization = useOrganization();
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
    () => getBreadcrumbFilterOptions(breadcrumbs),
    [breadcrumbs]
  );

  const displayCrumbs = useMemo(() => {
    const sortedCrumbs =
      sort === BreadcrumbSort.OLDEST ? breadcrumbs : [...breadcrumbs].reverse();
    const filteredCrumbs = sortedCrumbs.filter(ec =>
      filterSet.size === 0 ? true : filterSet.has(ec.filter)
    );
    const searchedCrumbs = applyBreadcrumbSearch(search, filteredCrumbs);
    return searchedCrumbs;
  }, [breadcrumbs, sort, filterSet, search]);

  const startTimeString = useMemo(
    () =>
      timeDisplay === BreadcrumbTimeDisplay.RELATIVE
        ? displayCrumbs?.at(0)?.breadcrumb?.timestamp
        : undefined,
    [displayCrumbs, timeDisplay]
  );

  const actions = (
    <ButtonBar gap={1}>
      <InputGroup>
        <SearchInput
          size="xs"
          value={search}
          onChange={e => {
            setSearch(e.target.value);
            trackAnalytics('breadcrumbs.drawer.action', {
              control: BreadcrumbControlOptions.SEARCH,
              organization,
            });
          }}
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
          trackAnalytics('breadcrumbs.drawer.action', {
            control: BreadcrumbControlOptions.FILTER,
            organization,
          });
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
        onChange={selectedOption => {
          setSort(selectedOption.value);
          trackAnalytics('breadcrumbs.drawer.action', {
            control: BreadcrumbControlOptions.SORT,
            value: selectedOption.value,
            organization,
          });
        }}
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
        onChange={selectedOption => {
          setTimeDisplay(selectedOption.value);
          trackAnalytics('breadcrumbs.drawer.action', {
            control: 'time_display',
            value: selectedOption.value,
            organization,
          });
        }}
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
                trackAnalytics('breadcrumbs.drawer.action', {
                  control: 'clear_filters',
                  organization,
                });
              }}
            >
              {t('Clear Filters?')}
            </Button>
          </EmptyMessage>
        ) : (
          <BreadcrumbsTimeline
            breadcrumbs={displayCrumbs}
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
