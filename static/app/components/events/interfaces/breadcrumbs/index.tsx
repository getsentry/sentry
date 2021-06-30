import {useEffect, useRef, useState} from 'react';
import {
  AutoSizer,
  CellMeasurer,
  CellMeasurerCache,
  List,
  ListRowProps,
  ScrollbarPresenceParams,
} from 'react-virtualized';
import styled from '@emotion/styled';
import omit from 'lodash/omit';
import pick from 'lodash/pick';

import GuideAnchor from 'app/components/assistant/guideAnchor';
import Button from 'app/components/button';
import EventDataSection from 'app/components/events/eventDataSection';
import {PanelTable} from 'app/components/panels';
import Tooltip from 'app/components/tooltip';
import {IconSwitch} from 'app/icons';
import {t} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import {
  Breadcrumb,
  BreadcrumbLevelType,
  BreadcrumbsWithDetails,
  BreadcrumbType,
} from 'app/types/breadcrumbs';
import {EntryType, Event} from 'app/types/event';
import {defined} from 'app/utils';

import SearchBarAction from '../searchBarAction';
import SearchBarActionFilter from '../searchBarAction/searchBarActionFilter';

import Level from './crumb/level';
import Type from './crumb/type';
import Crumb from './crumb';
import layout from './layout';
import {moduleToCategory, transformCrumbs} from './utils';

type FilterOptions = React.ComponentProps<typeof SearchBarActionFilter>['options'];
type FilterTypes = {
  id: BreadcrumbType;
  symbol: React.ReactElement;
  isChecked: boolean;
  description: string;
  levels: BreadcrumbLevelType[];
};

type Props = {
  event: Event;
  organization: Organization;
  type: string;
  data: {
    values: Array<Breadcrumb>;
  };
};

const LIST_MAX_HEIGHT = 400;

const cache = new CellMeasurerCache({
  fixedWidth: true,
  minHeight: 42,
});

function Breadcrumbs({type, event, data, organization}: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbsWithDetails>([]);
  const [filteredByFilter, setFilteredByFilter] = useState<BreadcrumbsWithDetails>([]);
  const [filteredBySearch, setFilteredBySearch] = useState<BreadcrumbsWithDetails>([]);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({});
  const [displayRelativeTime, setDisplayRelativeTime] = useState(false);
  const [scrollbarWidth, setScrollbarWidth] = useState(0);
  const [relativeTime, setRelativeTime] = useState<string | undefined>(undefined);
  const [panelTableHeight, setPanelTableHeight] = useState<number | undefined>(undefined);
  const [scrollToIndex, setScrollToIndex] = useState<number | undefined>(
    !!breadcrumbs.length ? breadcrumbs.length - 1 : undefined
  );

  const panelTableRef = useRef<HTMLDivElement>(null);
  let listRef: List | null = null;

  useEffect(() => {
    loadBreadcrumbs();
  }, []);

  useEffect(() => {
    getPanelBodyHeight();
  }, [breadcrumbs]);

  function getPanelBodyHeight() {
    if (!breadcrumbs.length) {
      return;
    }

    const panelTableRefOffsetHeight = panelTableRef?.current?.offsetHeight;

    if (!panelTableRefOffsetHeight) {
      return;
    }

    setPanelTableHeight(panelTableRefOffsetHeight);
  }

  function getVirtualCrumb() {
    const exception = event.entries.find(entry => entry.type === EntryType.EXCEPTION);

    if (!exception && !event.message) {
      return undefined;
    }

    const timestamp = event.dateCreated;

    if (exception) {
      const {type: exceptionType, value, module: mdl} = exception.data.values[0];
      return {
        type: BreadcrumbType.ERROR,
        level: BreadcrumbLevelType.ERROR,
        category: moduleToCategory(mdl) || 'exception',
        data: {
          type: exceptionType,
          value,
        },
        timestamp,
      };
    }

    const levelTag = (event.tags || []).find(tag => tag.key === 'level');

    return {
      type: BreadcrumbType.INFO,
      level: (levelTag?.value as BreadcrumbLevelType) || BreadcrumbLevelType.UNDEFINED,
      category: 'message',
      message: event.message,
      timestamp,
    };
  }

  function getFilterTypes(crumbs: ReturnType<typeof transformCrumbs>) {
    const filterTypes: FilterTypes[] = [];

    for (const index in crumbs) {
      const crumb = crumbs[index];
      const foundFilterType = filterTypes.findIndex(f => f.id === crumb.type);

      if (foundFilterType === -1) {
        filterTypes.push({
          id: crumb.type,
          symbol: <Type {...omit(crumb, 'description')} size="xs" />,
          isChecked: false,
          description: crumb.description,
          levels: crumb?.level ? [crumb.level] : [],
        });
        continue;
      }

      if (crumb?.level && !filterTypes[foundFilterType].levels.includes(crumb.level)) {
        filterTypes[foundFilterType].levels.push(crumb.level);
      }
    }

    return filterTypes;
  }

  function getFilterLevels(types: FilterTypes[]) {
    const filterLevels: FilterOptions[0] = [];

    for (const indexType in types) {
      for (const indexLevel in types[indexType].levels) {
        const level = types[indexType].levels[indexLevel];

        if (filterLevels.some(f => f.id === level)) {
          continue;
        }

        filterLevels.push({
          id: level,
          symbol: <Level level={level} x="blah" />,
          isChecked: false,
        });
      }
    }

    return filterLevels;
  }

  function getFilterOptions(crumbs: ReturnType<typeof transformCrumbs>) {
    const filterTypes = getFilterTypes(crumbs);
    const filterLevels = getFilterLevels(filterTypes);

    const options = {};

    if (!!filterTypes.length) {
      options[t('Types')] = filterTypes.map(filterType => omit(filterType, 'levels'));
    }

    if (!!filterLevels.length) {
      options[t('Levels')] = filterLevels;
    }

    return options;
  }

  function loadBreadcrumbs() {
    setScrollToIndex(undefined);
    let crumbs = data.values;

    // Add the (virtual) breadcrumb based on the error or message event if possible.
    const virtualCrumb = getVirtualCrumb();
    if (virtualCrumb) {
      crumbs = [...crumbs, virtualCrumb] as Breadcrumb[];
    }

    const transformedCrumbs = transformCrumbs(crumbs);

    setRelativeTime(transformedCrumbs[transformedCrumbs.length - 1]?.timestamp);
    setBreadcrumbs(transformedCrumbs);
    setFilteredByFilter(transformedCrumbs);
    setFilteredBySearch(transformedCrumbs);
    setFilterOptions(getFilterOptions(transformedCrumbs));
    setScrollToIndex(
      transformedCrumbs.length > 0 ? transformedCrumbs.length - 1 : undefined
    );
  }

  function filterBySearch(newSearchTerm: string, crumbs: BreadcrumbsWithDetails) {
    if (!newSearchTerm.trim()) {
      return crumbs;
    }

    // Slightly hacky, but it works
    // the string is being `stringfy`d here in order to match exactly the same `stringfy`d string of the loop
    const searchFor = JSON.stringify(newSearchTerm)
      // it replaces double backslash generate by JSON.stringfy with single backslash
      .replace(/((^")|("$))/g, '')
      .toLocaleLowerCase();

    return crumbs.filter(obj =>
      Object.keys(
        pick(obj, ['type', 'category', 'message', 'level', 'timestamp', 'data'])
      ).some(key => {
        const info = obj[key];

        if (!defined(info) || !String(info).trim()) {
          return false;
        }

        return JSON.stringify(info)
          .replace(/((^")|("$))/g, '')
          .toLocaleLowerCase()
          .trim()
          .includes(searchFor);
      })
    );
  }

  function getFilteredCrumbsByFilter(newfilterOptions: FilterOptions) {
    const checkedTypeOptions = new Set(
      Object.values(newfilterOptions)[0]
        .filter(newfilterOption => newfilterOption.isChecked)
        .map(option => option.id)
    );

    const checkedLevelOptions = new Set(
      Object.values(newfilterOptions)[1]
        .filter(newfilterOption => newfilterOption.isChecked)
        .map(option => option.id)
    );

    if (!![...checkedTypeOptions].length && !![...checkedLevelOptions].length) {
      return breadcrumbs.filter(
        filteredCrumb =>
          checkedTypeOptions.has(filteredCrumb.type) &&
          checkedLevelOptions.has(filteredCrumb.level)
      );
    }

    if (!![...checkedTypeOptions].length) {
      return breadcrumbs.filter(filteredCrumb =>
        checkedTypeOptions.has(filteredCrumb.type)
      );
    }

    if (!![...checkedLevelOptions].length) {
      return breadcrumbs.filter(filteredCrumb =>
        checkedLevelOptions.has(filteredCrumb.level)
      );
    }

    return breadcrumbs;
  }

  function updateGrid() {
    if (listRef) {
      cache.clearAll();
      listRef.forceUpdateGrid();
      getScrollbarWidth();
    }
  }

  function getScrollbarWidth() {
    const panelTableWidth = panelTableRef?.current?.clientWidth ?? 0;

    const gridInnerWidth =
      panelTableRef?.current?.querySelector(
        '.ReactVirtualized__Grid__innerScrollContainer'
      )?.clientWidth ?? 0;

    const newScrollbarWidth = panelTableWidth - gridInnerWidth;

    if (newScrollbarWidth !== scrollbarWidth) {
      setScrollbarWidth(newScrollbarWidth);
    }
  }

  function handleSearch(value: string) {
    setSearchTerm(value);
    setFilteredBySearch(filterBySearch(value, filteredByFilter));
  }

  function handleFilter(newfilterOptions: FilterOptions) {
    const newfilteredByFilter = getFilteredCrumbsByFilter(newfilterOptions);
    setFilterOptions(newfilterOptions);
    setFilteredByFilter(newfilteredByFilter);
    setFilteredBySearch(filterBySearch(searchTerm, newfilteredByFilter));
  }

  function handleResetFilter() {
    const newFilterOptions = Object.keys(filterOptions).reduce(
      (accumulator, currentValue) => {
        accumulator[currentValue] = filterOptions[currentValue].map(filterOption => ({
          ...filterOption,
          isChecked: false,
        }));
        return accumulator;
      },
      {}
    );

    setFilteredByFilter(breadcrumbs);
    setFilterOptions(newFilterOptions);
    setFilteredBySearch(filterBySearch(searchTerm, breadcrumbs));
  }

  function handleResetSearchBar() {
    setSearchTerm('');
    setFilteredBySearch(breadcrumbs);
  }

  function handleSwitchTimeFormat() {
    setDisplayRelativeTime(!displayRelativeTime);
  }

  function getEmptyMessage() {
    if (!!filteredBySearch.length) {
      return {};
    }

    if (searchTerm && !filteredBySearch.length) {
      const hasActiveFilter = Object.values(filterOptions)
        .flatMap(filterOption => filterOption)
        .find(filterOption => filterOption.isChecked);

      return {
        emptyMessage: t('Sorry, no breadcrumbs match your search query'),
        emptyAction: hasActiveFilter ? (
          <Button onClick={handleResetFilter} priority="primary">
            {t('Reset filter')}
          </Button>
        ) : (
          <Button onClick={handleResetSearchBar} priority="primary">
            {t('Clear search bar')}
          </Button>
        ),
      };
    }

    return {
      emptyMessage: t('There are no breadcrumbs to be displayed'),
    };
  }

  function renderRow({index, key, parent, style}: ListRowProps) {
    const crumb = filteredBySearch[index];
    const isLastItem = filteredBySearch[filteredBySearch.length - 1].id === crumb.id;
    const {height} = style;
    return (
      <CellMeasurer
        cache={cache}
        columnIndex={0}
        key={key}
        parent={parent}
        rowIndex={index}
      >
        {({measure}) => (
          <Crumb
            style={style}
            onLoad={measure}
            data-test-id={isLastItem ? 'last-crumb' : ''}
            crumb={crumb}
            event={event}
            orgSlug={organization.slug}
            searchTerm={searchTerm}
            isLastItem={false}
            relativeTime={relativeTime}
            displayRelativeTime={displayRelativeTime}
            height={height ? String(height) : undefined}
          />
        )}
      </CellMeasurer>
    );
  }

  function renderList() {
    const crumbs = filteredBySearch;

    if (!panelTableHeight) {
      return crumbs.map((crumb, index) => (
        <Crumb
          key={index}
          crumb={crumb}
          event={event}
          orgSlug={organization.slug}
          searchTerm={searchTerm}
          isLastItem={false}
          relativeTime={relativeTime}
          displayRelativeTime={displayRelativeTime}
        />
      ));
    }

    // onResize is required in case the user rotates the device.
    return (
      <AutoSizer disableHeight onResize={updateGrid}>
        {({width}) => (
          <StyledList
            ref={(el: List | null) => {
              listRef = el;
            }}
            deferredMeasurementCache={cache}
            height={LIST_MAX_HEIGHT}
            overscanRowCount={5}
            rowCount={filteredBySearch.length}
            rowHeight={cache.rowHeight}
            rowRenderer={renderRow}
            width={width}
            onScrollbarPresenceChange={({size}: ScrollbarPresenceParams) =>
              setScrollbarWidth(size)
            }
            // when the component mounts, it scrolls to the last item
            scrollToIndex={scrollToIndex}
            scrollToAlignment={scrollToIndex ? 'end' : undefined}
          />
        )}
      </AutoSizer>
    );
  }

  return (
    <StyledEventDataSection
      type={type}
      title={
        <GuideAnchor target="breadcrumbs" position="right">
          <h3>{t('Breadcrumbs')}</h3>
        </GuideAnchor>
      }
      actions={
        <SearchBarAction
          placeholder={t('Search breadcrumbs')}
          onChange={handleSearch}
          query={searchTerm}
          filter={
            <SearchBarActionFilter onChange={handleFilter} options={filterOptions} />
          }
        />
      }
      wrapTitle={false}
      isCentered
    >
      <StyledPanelTable
        isEmpty={!filteredBySearch.length}
        scrollbarWidth={scrollbarWidth}
        headers={[
          t('Type'),
          t('Category'),
          t('Description'),
          t('Level'),
          <Time key="time" onClick={handleSwitchTimeFormat}>
            <Tooltip
              title={
                displayRelativeTime ? t('Switch to absolute') : t('Switch to relative')
              }
            >
              <StyledIconSwitch size="xs" />
            </Tooltip>
            {t('Time')}
          </Time>,
          '',
        ]}
        {...getEmptyMessage()}
      >
        <div ref={panelTableRef}>{renderList()}</div>
      </StyledPanelTable>
    </StyledEventDataSection>
  );
}

export default Breadcrumbs;

const StyledEventDataSection = styled(EventDataSection)`
  margin-bottom: ${space(3)};
`;

const StyledPanelTable = styled(PanelTable)<{scrollbarWidth?: number}>`
  overflow: hidden;
  > * {
    :nth-child(-n + 6) {
      ${overflowEllipsis};
      border-bottom: 1px solid ${p => p.theme.border};
      margin-bottom: 1px;
      :nth-child(6n) {
        height: calc(100% - 1px);
        ${p => !p.scrollbarWidth && `display: none`}
      }
    }

    :nth-child(n + 7) {
      grid-column: 1/-1;
      ${p =>
        !p.isEmpty &&
        `
          display: grid;
          padding: 0;
        `}
    }
  }

  ${p => layout(p.theme, p.scrollbarWidth)}
`;

const Time = styled('div')`
  display: grid;
  grid-template-columns: max-content max-content;
  justify-content: flex-end;
  grid-gap: ${space(1)};
  cursor: pointer;
`;

const StyledIconSwitch = styled(IconSwitch)`
  transition: 0.15s color;
  :hover {
    color: ${p => p.theme.gray300};
  }
`;

// XXX(ts): Emotion11 has some trouble with List's defaultProps
// It gives the list have a dynamic height; otherwise, in the case of filtered
// options, a list will be displayed with an empty space
const StyledList = styled(List as any)<React.ComponentProps<typeof List>>`
  height: auto !important;
  max-height: ${p => p.height}px;
  overflow-y: auto !important;
  outline: none;
`;
