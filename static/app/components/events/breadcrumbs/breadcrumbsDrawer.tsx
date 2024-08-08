import {Fragment, useCallback, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import {Breadcrumbs as NavigationBreadcrumbs} from 'sentry/components/breadcrumbs';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {CompactSelect} from 'sentry/components/compactSelect';
import BreadcrumbsTimeline from 'sentry/components/events/breadcrumbs/breadcrumbsTimeline';
import {
  BREADCRUMB_TIME_DISPLAY_LOCALSTORAGE_KEY,
  BREADCRUMB_TIME_DISPLAY_OPTIONS,
  BreadcrumbTimeDisplay,
  type EnhancedCrumb,
  useBreadcrumbFilters,
} from 'sentry/components/events/breadcrumbs/utils';
import {
  applyBreadcrumbSearch,
  BREADCRUMB_SORT_LOCALSTORAGE_KEY,
  BREADCRUMB_SORT_OPTIONS,
  BreadcrumbSort,
} from 'sentry/components/events/interfaces/breadcrumbs';
import {DrawerBody, DrawerHeader} from 'sentry/components/globalDrawer/components';
import {InputGroup} from 'sentry/components/inputGroup';
import {IconClock, IconFilter, IconSearch, IconSort, IconTimer} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getShortEventId} from 'sentry/utils/events';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import useOrganization from 'sentry/utils/useOrganization';

export const enum BreadcrumbControlOptions {
  SEARCH = 'search',
  FILTER = 'filter',
  SORT = 'sort',
}

function useFocusControl(initialFocusControl?: BreadcrumbControlOptions) {
  const [focusControl, setFocusControl] = useState(initialFocusControl);
  // If the focused control element is blurred, unset the state to remove styles
  // This will allow us to simulate :focus-visible on the button elements.
  const getFocusProps = useCallback(
    (option: BreadcrumbControlOptions) => {
      return option === focusControl
        ? {autoFocus: true, onBlur: () => setFocusControl(undefined)}
        : {};
    },
    [focusControl]
  );
  return {getFocusProps};
}

interface BreadcrumbsDrawerProps {
  breadcrumbs: EnhancedCrumb[];
  event: Event;
  group: Group;
  project: Project;
  focusControl?: BreadcrumbControlOptions;
}

export function BreadcrumbsDrawer({
  breadcrumbs,
  event,
  project,
  group,
  focusControl: initialFocusControl,
}: BreadcrumbsDrawerProps) {
  const organization = useOrganization();
  const theme = useTheme();

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<string[]>([]);
  const [sort, setSort] = useLocalStorageState<BreadcrumbSort>(
    BREADCRUMB_SORT_LOCALSTORAGE_KEY,
    BreadcrumbSort.NEWEST
  );
  const {getFocusProps} = useFocusControl(initialFocusControl);

  const [timeDisplay, setTimeDisplay] = useLocalStorageState<BreadcrumbTimeDisplay>(
    BREADCRUMB_TIME_DISPLAY_LOCALSTORAGE_KEY,
    BreadcrumbTimeDisplay.ABSOLUTE
  );
  const {filterOptions, applyFilters} = useBreadcrumbFilters(breadcrumbs);

  const displayCrumbs = useMemo(() => {
    const sortedCrumbs =
      sort === BreadcrumbSort.OLDEST ? breadcrumbs : [...breadcrumbs].reverse();
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
          aria-label={t('Search All Breadcrumbs')}
          {...getFocusProps(BreadcrumbControlOptions.SEARCH)}
        />
        <InputGroup.TrailingItems disablePointerEvents>
          <IconSearch size="xs" />
        </InputGroup.TrailingItems>
      </InputGroup>
      <CompactSelect
        size="xs"
        onChange={options => {
          const newFilters = options.map(({value}) => value);
          setFilters(newFilters);
          trackAnalytics('breadcrumbs.drawer.action', {
            control: BreadcrumbControlOptions.FILTER,
            organization,
          });
        }}
        multiple
        options={filterOptions}
        maxMenuHeight={400}
        trigger={props => (
          <VisibleFocusButton
            size="xs"
            borderless
            style={{background: filters.length > 0 ? theme.purple100 : 'transparent'}}
            icon={<IconFilter />}
            aria-label={t('Filter All Breadcrumbs')}
            {...props}
            {...getFocusProps(BreadcrumbControlOptions.FILTER)}
          >
            {filters.length > 0 ? filters.length : null}
          </VisibleFocusButton>
        )}
      />
      <CompactSelect
        size="xs"
        trigger={props => (
          <VisibleFocusButton
            size="xs"
            borderless
            icon={<IconSort />}
            aria-label={t('Sort All Breadcrumbs')}
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
        size="xs"
        trigger={props => (
          <Button
            size="xs"
            borderless
            icon={
              timeDisplay === BreadcrumbTimeDisplay.ABSOLUTE ? (
                <IconClock size="xs" />
              ) : (
                <IconTimer size="xs" />
              )
            }
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
        options={Object.values(BREADCRUMB_TIME_DISPLAY_OPTIONS)}
      />
    </ButtonBar>
  );

  return (
    <Fragment>
      <DrawerHeader>
        <NavigationCrumbs
          crumbs={[
            {
              label: (
                <CrumbContainer>
                  <ProjectAvatar project={project} />
                  <ShortId>{group.shortId}</ShortId>
                </CrumbContainer>
              ),
            },
            {label: getShortEventId(event.id)},
            {label: t('Breadcrumbs')},
          ]}
        />
      </DrawerHeader>
      <DrawerBody>
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
              fullyExpanded
            />
          )}
        </TimelineContainer>
      </DrawerBody>
    </Fragment>
  );
}

const VisibleFocusButton = styled(Button)`
  box-shadow: ${p => (p.autoFocus ? p.theme.button.default.focusBorder : 'transparent')} 0
    0 0 1px;
`;

const HeaderGrid = styled('div')`
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  column-gap: ${p => p.theme.space(1)};
  margin: ${p => p.theme.space(1)} 0 ${p => p.theme.space(2)};
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

const TimelineContainer = styled('div')`
  grid-column: span 2;
`;

const EmptyMessage = styled('div')`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: ${p => p.theme.subText};
  padding: ${p => p.theme.space(3)} ${p => p.theme.space(1)};
`;

const NavigationCrumbs = styled(NavigationBreadcrumbs)`
  margin: 0;
  padding: 0;
`;

const CrumbContainer = styled('div')`
  display: flex;
  gap: ${p => p.theme.space(1)};
  align-items: center;
`;

const ShortId = styled('div')`
  font-family: ${p => p.theme.text.family};
  font-size: ${p => p.theme.fontSizeMedium};
  line-height: 1;
`;
