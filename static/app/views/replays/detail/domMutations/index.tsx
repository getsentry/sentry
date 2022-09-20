import {useCallback, useEffect, useMemo, useState} from 'react';
import {
  AutoSizer,
  CellMeasurer,
  CellMeasurerCache,
  List as ReactVirtualizedList,
  ListRowProps,
} from 'react-virtualized';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';
import isEmpty from 'lodash/isEmpty';

import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import BreadcrumbIcon from 'sentry/components/events/interfaces/breadcrumbs/breadcrumb/type/icon';
import CompactSelect from 'sentry/components/forms/compactSelect';
import HTMLCode from 'sentry/components/htmlCode';
import Placeholder from 'sentry/components/placeholder';
import {getDetails} from 'sentry/components/replays/breadcrumbs/utils';
import PlayerRelativeTime from 'sentry/components/replays/playerRelativeTime';
import SearchBar from 'sentry/components/searchBar';
import {SVGIconProps} from 'sentry/icons/svgIcon';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';
import useExtractedCrumbHtml, {
  Extraction,
} from 'sentry/utils/replays/hooks/useExtractedCrumbHtml';
import type ReplayReader from 'sentry/utils/replays/replayReader';
import {getDomMutationsTypes} from 'sentry/views/replays/detail/domMutations/utils';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import {Filters, getFilteredItems} from 'sentry/views/replays/detail/utils';

type Props = {
  replay: ReplayReader;
};

// The cache is used to measure the height of each row
const cache = new CellMeasurerCache({
  fixedWidth: true,
  minHeight: 82,
});

function DomMutations({replay}: Props) {
  const {isLoading, actions} = useExtractedCrumbHtml({replay});
  const [searchTerm, setSearchTerm] = useState('');
  let listRef: ReactVirtualizedList | null = null;
  const [filters, setFilters] = useState<Filters<Extraction>>({});

  const filteredDomMutations = useMemo(
    () =>
      getFilteredItems({
        items: actions,
        filters,
        searchTerm,
        searchProp: 'html',
      }),
    [actions, filters, searchTerm]
  );

  const handleSearch = useMemo(() => debounce(query => setSearchTerm(query), 150), []);

  const startTimestampMs = replay.getReplay().startedAt.getTime();

  const {handleMouseEnter, handleMouseLeave, handleClick} =
    useCrumbHandlers(startTimestampMs);

  const handleFilters = useCallback(
    (
      selectedValues: (string | number)[],
      key: string,
      filter: (mutation: Extraction) => boolean
    ) => {
      const filtersCopy = {...filters};

      if (selectedValues.length === 0) {
        delete filtersCopy[key];
        setFilters(filtersCopy);
        return;
      }

      setFilters({
        ...filters,
        [key]: filter,
      });
    },
    [filters]
  );

  // Restart cache when filteredDomMutations changes
  useEffect(() => {
    if (listRef) {
      cache.clearAll();
      listRef?.forceUpdateGrid();
    }
  }, [filteredDomMutations, listRef]);

  const renderRow = ({index, key, style, parent}: ListRowProps) => {
    const mutation = filteredDomMutations[index];
    const {html, crumb} = mutation;
    const {title} = getDetails(crumb);

    return (
      <CellMeasurer
        cache={cache}
        columnIndex={0}
        key={key}
        parent={parent}
        rowIndex={index}
      >
        <MutationListItem
          onMouseEnter={() => handleMouseEnter(crumb)}
          onMouseLeave={() => handleMouseLeave(crumb)}
          style={style}
        >
          <IconWrapper color={crumb.color}>
            <BreadcrumbIcon type={crumb.type} />
          </IconWrapper>
          <MutationContent>
            <MutationDetailsContainer>
              <div>
                <TitleContainer>
                  <Title>{title}</Title>
                </TitleContainer>
                <MutationMessage>{crumb.message}</MutationMessage>
              </div>
              <UnstyledButton onClick={() => handleClick(crumb)}>
                <PlayerRelativeTime
                  relativeTimeMs={startTimestampMs}
                  timestamp={crumb.timestamp}
                />
              </UnstyledButton>
            </MutationDetailsContainer>
            <CodeContainer>
              <HTMLCode code={html} />
            </CodeContainer>
          </MutationContent>
        </MutationListItem>
      </CellMeasurer>
    );
  };

  return (
    <MutationContainer>
      <MutationFilters>
        <CompactSelect
          triggerProps={{
            prefix: t('Event Type'),
          }}
          triggerLabel={isEmpty(filters) ? t('Any') : null}
          multiple
          options={getDomMutationsTypes(actions).map(mutationEventType => ({
            value: mutationEventType,
            label: mutationEventType,
          }))}
          size="sm"
          onChange={selections => {
            const selectedValues = selections.map(selection => selection.value);

            handleFilters(selectedValues, 'eventType', (mutation: Extraction) => {
              return selectedValues.includes(mutation.crumb.type);
            });
          }}
        />

        <SearchBar size="sm" onChange={handleSearch} placeholder={t('Search DOM')} />
      </MutationFilters>
      {isLoading ? (
        <Placeholder height="200px" />
      ) : (
        <MutationList>
          <AutoSizer>
            {({width, height}) => (
              <ReactVirtualizedList
                ref={(el: ReactVirtualizedList | null) => {
                  listRef = el;
                }}
                deferredMeasurementCache={cache}
                height={height}
                overscanRowCount={5}
                rowCount={filteredDomMutations.length}
                noRowsRenderer={() => (
                  <EmptyStateWarning withIcon={false} small>
                    {t('No related DOM Events recorded')}
                  </EmptyStateWarning>
                )}
                rowHeight={cache.rowHeight}
                rowRenderer={renderRow}
                width={width}
              />
            )}
          </AutoSizer>
        </MutationList>
      )}
    </MutationContainer>
  );
}

const MutationFilters = styled('div')`
  display: grid;
  gap: ${space(1)};
  grid-template-columns: max-content 1fr;
  margin-bottom: ${space(1)};
  @media (max-width: ${p => p.theme.breakpoints.small}) {
    margin-top: ${space(1)};
  }
`;

const MutationContainer = styled(FluidHeight)`
  height: 100%;
`;

const MutationList = styled('ul')`
  list-style: none;
  position: relative;
  height: 100%;
  overflow: hidden;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding-left: 0;
  margin-bottom: 0;
`;

const MutationListItem = styled('li')`
  display: flex;
  gap: ${space(1)};
  flex-grow: 1;
  padding: ${space(1)} ${space(1.5)};
  position: relative;
  &:hover {
    background-color: ${p => p.theme.backgroundSecondary};
  }

  /* Draw a vertical line behind the breadcrumb icon. The line connects each row together, but is truncated for the first and last items */
  &::after {
    content: '';
    position: absolute;
    left: 23.5px;
    top: 0;
    width: 1px;
    background: ${p => p.theme.gray200};
    height: 100%;
  }

  &:first-of-type::after {
    top: ${space(1)};
    bottom: 0;
  }

  &:last-of-type::after {
    top: 0;
    height: ${space(1)};
  }

  &:only-of-type::after {
    height: 0;
  }
`;

const MutationContent = styled('div')`
  overflow: hidden;
  width: 100%;

  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const MutationDetailsContainer = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-grow: 1;
`;

/**
 * Taken `from events/interfaces/.../breadcrumbs/types`
 */
const IconWrapper = styled('div')<Required<Pick<SVGIconProps, 'color'>>>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  min-width: 24px;
  height: 24px;
  border-radius: 50%;
  color: ${p => p.theme.white};
  background: ${p => p.theme[p.color] ?? p.color};
  box-shadow: ${p => p.theme.dropShadowLightest};
  z-index: 2;
`;

const TitleContainer = styled('div')`
  display: flex;
  justify-content: space-between;
`;

const Title = styled('span')`
  ${p => p.theme.overflowEllipsis};
  text-transform: capitalize;
  color: ${p => p.theme.gray400};
  font-weight: bold;
  line-height: ${p => p.theme.text.lineHeightBody};
`;

const UnstyledButton = styled('button')`
  background: none;
  border: none;
  padding: 0;
  line-height: 0.75;
`;

const MutationMessage = styled('p')`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeSmall};
  margin-bottom: 0;
`;

const CodeContainer = styled('div')`
  max-height: 400px;
`;

export default DomMutations;
