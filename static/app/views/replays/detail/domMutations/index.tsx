import {useEffect} from 'react';
import {
  AutoSizer,
  CellMeasurer,
  CellMeasurerCache,
  List as ReactVirtualizedList,
  ListRowProps,
} from 'react-virtualized';
import styled from '@emotion/styled';

import CompactSelect from 'sentry/components/compactSelect';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import BreadcrumbIcon from 'sentry/components/events/interfaces/breadcrumbs/breadcrumb/type/icon';
import HTMLCode from 'sentry/components/htmlCode';
import Placeholder from 'sentry/components/placeholder';
import {getDetails} from 'sentry/components/replays/breadcrumbs/utils';
import PlayerRelativeTime from 'sentry/components/replays/playerRelativeTime';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {relativeTimeInMs} from 'sentry/components/replays/utils';
import SearchBar from 'sentry/components/searchBar';
import {SVGIconProps} from 'sentry/icons/svgIcon';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {getPrevReplayEvent} from 'sentry/utils/replays/getReplayEvent';
import useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';
import useExtractedCrumbHtml from 'sentry/utils/replays/hooks/useExtractedCrumbHtml';
import type ReplayReader from 'sentry/utils/replays/replayReader';
import useDomFilters from 'sentry/views/replays/detail/domMutations/useDomFilters';
import {getDomMutationsTypes} from 'sentry/views/replays/detail/domMutations/utils';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';

type Props = {
  replay: ReplayReader;
};

// The cache is used to measure the height of each row
const cache = new CellMeasurerCache({
  fixedWidth: true,
  minHeight: 82,
});

function DomMutations({replay}: Props) {
  const startTimestampMs = replay.getReplay().startedAt.getTime();
  const {currentTime} = useReplayContext();
  const {isLoading, actions} = useExtractedCrumbHtml({replay});
  let listRef: ReactVirtualizedList | null = null;

  const {
    items,
    type: filteredTypes,
    searchTerm,
    setType,
    setSearchTerm,
  } = useDomFilters({actions});

  const currentDomMutation = getPrevReplayEvent({
    items: items.map(mutation => mutation.crumb),
    targetTimestampMs: startTimestampMs + currentTime,
    allowEqual: true,
    allowExact: true,
  });

  const {handleMouseEnter, handleMouseLeave, handleClick} =
    useCrumbHandlers(startTimestampMs);

  useEffect(() => {
    // Restart cache when items changes
    if (listRef) {
      cache.clearAll();
      listRef?.forceUpdateGrid();
    }
  }, [items, listRef]);

  const renderRow = ({index, key, style, parent}: ListRowProps) => {
    const mutation = items[index];
    const {html, crumb} = mutation;
    const {title} = getDetails(crumb);

    const hasOccurred =
      currentTime >= relativeTimeInMs(crumb.timestamp || '', startTimestampMs);

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
          isCurrent={crumb.id === currentDomMutation?.id}
        >
          <IconWrapper color={crumb.color} hasOccurred={hasOccurred}>
            <BreadcrumbIcon type={crumb.type} />
          </IconWrapper>
          <MutationContent>
            <MutationDetailsContainer>
              <div>
                <TitleContainer>
                  <Title hasOccurred={hasOccurred}>{title}</Title>
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
          triggerProps={{prefix: t('Event Type')}}
          triggerLabel={filteredTypes.length === 0 ? t('Any') : null}
          multiple
          options={getDomMutationsTypes(actions).map(value => ({value, label: value}))}
          size="sm"
          onChange={selected => setType(selected.map(_ => _.value))}
          value={filteredTypes}
        />
        <SearchBar
          size="sm"
          onChange={setSearchTerm}
          placeholder={t('Search DOM')}
          query={searchTerm}
        />
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
                rowCount={items.length}
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
const IconWrapper = styled('div')<
  {hasOccurred?: boolean} & Required<Pick<SVGIconProps, 'color'>>
>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  min-width: 24px;
  height: 24px;
  border-radius: 50%;
  color: ${p => p.theme.white};
  background: ${p => (p.hasOccurred ? p.theme[p.color] ?? p.color : p.theme.purple200)};
  box-shadow: ${p => p.theme.dropShadowLightest};
  z-index: 2;
`;

const MutationListItem = styled('li')<{isCurrent?: boolean}>`
  display: flex;
  gap: ${space(1)};
  flex-grow: 1;
  padding: ${space(1)} ${space(1.5)};
  position: relative;
  border-bottom: 1px solid ${p => (p.isCurrent ? p.theme.purple300 : 'transparent')};
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

const TitleContainer = styled('div')`
  display: flex;
  justify-content: space-between;
`;

const Title = styled('span')<{hasOccurred?: boolean}>`
  ${p => p.theme.overflowEllipsis};
  text-transform: capitalize;
  color: ${p => (p.hasOccurred ? p.theme.gray400 : p.theme.gray300)};
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
  max-width: 100%;
  overflow: auto;
`;

export default DomMutations;
