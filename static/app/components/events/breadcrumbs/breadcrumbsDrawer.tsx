import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {IconClock} from '@sentry/icons/clock';
import {IconFilter} from '@sentry/icons/filter';
import {IconSearch} from '@sentry/icons/search';
import {IconSort} from '@sentry/icons/sort';
import {IconTimer} from '@sentry/icons/timer';

import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {DrawerHeader} from '@sentry/scraps/drawer';
import {InputGroup} from '@sentry/scraps/input';
import {Container} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {
  DrawerBreadcrumbs,
  EventDrawerBody,
  EventDrawerContainer,
  EventNavigator,
  SearchInput,
} from 'sentry/components/events/eventDrawer';
import {
  applyBreadcrumbSearch,
  BREADCRUMB_SORT_LOCALSTORAGE_KEY,
  BREADCRUMB_SORT_OPTIONS,
  BreadcrumbSort,
} from 'sentry/components/events/interfaces/breadcrumbs';
import {useFocusControl} from 'sentry/components/events/useFocusControl';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getShortEventId} from 'sentry/utils/events';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useOrganization} from 'sentry/utils/useOrganization';

import {BreadcrumbsTimeline} from './breadcrumbsTimeline';
import {CopyBreadcrumbsDropdown} from './copyBreadcrumbs';
import {
  BREADCRUMB_TIME_DISPLAY_LOCALSTORAGE_KEY,
  BREADCRUMB_TIME_DISPLAY_OPTIONS,
  BreadcrumbTimeDisplay,
  useBreadcrumbFilters,
  type EnhancedCrumb,
} from './utils';

export const enum BreadcrumbControlOptions {
  SEARCH = 'search',
  FILTER = 'filter',
  SORT = 'sort',
}

interface BreadcrumbsDrawerProps {
  breadcrumbs: EnhancedCrumb[];
  event: Event;
  focusControl?: BreadcrumbControlOptions;
}

export function BreadcrumbsDrawer({
  breadcrumbs,
  event,
  focusControl: initialFocusControl,
}: BreadcrumbsDrawerProps) {
  const organization = useOrganization();
  const [container, setContainer] = useState<HTMLElement | null>(null);

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<string[]>([]);
  const [sort, setSort] = useLocalStorageState(
    BREADCRUMB_SORT_LOCALSTORAGE_KEY,
    BreadcrumbSort.NEWEST
  );
  const {getFocusProps} = useFocusControl(initialFocusControl);

  const [timeDisplay, setTimeDisplay] = useLocalStorageState(
    BREADCRUMB_TIME_DISPLAY_LOCALSTORAGE_KEY,
    BreadcrumbTimeDisplay.ABSOLUTE
  );
  const {filterOptions, applyFilters} = useBreadcrumbFilters(breadcrumbs);

  const displayCrumbs = useMemo(() => {
    const sortedCrumbs =
      sort === BreadcrumbSort.OLDEST ? breadcrumbs : breadcrumbs.toReversed();
    const filteredCrumbs = applyFilters(sortedCrumbs, filters);
    const searchedCrumbs = applyBreadcrumbSearch(filteredCrumbs, search);
    return searchedCrumbs;
  }, [breadcrumbs, sort, filters, search, applyFilters]);

  const startTimeString = useMemo(
    () =>
      timeDisplay === BreadcrumbTimeDisplay.RELATIVE
        ? displayCrumbs?.at(0)?.breadcrumb?.timestamp
        : undefined,
    [displayCrumbs, timeDisplay]
  );

  const searchInput = (
    <InputGroup>
      <SearchInput
        size="sm"
        value={search}
        onChange={e => {
          setSearch(e.target.value);
          trackAnalytics('breadcrumbs.drawer.action', {
            control: BreadcrumbControlOptions.SEARCH,
            organization,
          });
        }}
        aria-label={t('Search All Breadcrumbs')}
        placeholder={t('Filter breadcrumbs')}
        {...getFocusProps(BreadcrumbControlOptions.SEARCH)}
      />
      <InputGroup.TrailingItems disablePointerEvents>
        <IconSearch size="xs" />
      </InputGroup.TrailingItems>
    </InputGroup>
  );

  const actions = (
    <Fragment>
      <CompactSelect
        size="sm"
        multiple
        clearable
        menuTitle={t('Filter by')}
        value={filters}
        onChange={options => {
          const newFilters = options.map(({value}) => value);
          setFilters(newFilters);
          trackAnalytics('breadcrumbs.drawer.action', {
            control: BreadcrumbControlOptions.FILTER,
            organization,
          });
        }}
        options={filterOptions}
        maxMenuHeight={400}
        trigger={props => (
          <OverlayTrigger.Button
            variant="transparent"
            showChevron={false}
            icon={<IconFilter />}
            aria-label={t('Filter All Breadcrumbs')}
            title={t('Filter')}
            {...props}
            {...getFocusProps(BreadcrumbControlOptions.FILTER)}
          >
            {filters.length > 0 ? filters.length : ''}
          </OverlayTrigger.Button>
        )}
      />
      <CompactSelect
        size="sm"
        trigger={props => (
          <OverlayTrigger.IconButton
            variant="transparent"
            icon={<IconSort />}
            aria-label={t('Sort All Breadcrumbs')}
            title={t('Sort')}
            {...props}
            {...getFocusProps(BreadcrumbControlOptions.SORT)}
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
        size="sm"
        trigger={props => (
          <OverlayTrigger.IconButton
            variant="transparent"
            icon={
              timeDisplay === BreadcrumbTimeDisplay.ABSOLUTE ? (
                <IconClock size="sm" />
              ) : (
                <IconTimer size="sm" />
              )
            }
            aria-label={t('Change Time Format for All Breadcrumbs')}
            title={t('Time Format')}
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
        options={Object.values(BREADCRUMB_TIME_DISPLAY_OPTIONS)}
      />
      <CopyBreadcrumbsDropdown breadcrumbs={displayCrumbs} size="sm" />
    </Fragment>
  );

  return (
    <EventDrawerContainer>
      <DrawerHeader>
        <DrawerBreadcrumbs
          current={{
            label: t('Breadcrumbs'),
            labelTooltip: t('Event ID: %s', getShortEventId(event.id)),
          }}
        />
      </DrawerHeader>
      <EventNavigator leadingItems={searchInput} trailingItems={actions} />
      <EventDrawerBody ref={setContainer}>
        <Container column="span 2">
          {displayCrumbs.length === 0 ? (
            <EmptyMessage>
              {t('No breadcrumbs found.')}
              <Button
                variant="link"
                onClick={() => {
                  setFilters([]);
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
              containerElement={container}
            />
          )}
        </Container>
      </EventDrawerBody>
    </EventDrawerContainer>
  );
}

const EmptyMessage = styled('div')`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: ${p => p.theme.tokens.content.secondary};
  padding: ${p => p.theme.space['2xl']} ${p => p.theme.space.md};
`;
