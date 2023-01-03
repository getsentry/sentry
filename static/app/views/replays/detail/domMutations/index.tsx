import {useRef} from 'react';
import {
  AutoSizer,
  CellMeasurer,
  List as ReactVirtualizedList,
  ListRowProps,
} from 'react-virtualized';
import styled from '@emotion/styled';

import BreadcrumbIcon from 'sentry/components/events/interfaces/breadcrumbs/breadcrumb/type/icon';
import HTMLCode from 'sentry/components/htmlCode';
import Placeholder from 'sentry/components/placeholder';
import {getDetails} from 'sentry/components/replays/breadcrumbs/utils';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {relativeTimeInMs} from 'sentry/components/replays/utils';
import {SVGIconProps} from 'sentry/icons/svgIcon';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {getPrevReplayEvent} from 'sentry/utils/replays/getReplayEvent';
import useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';
import useExtractedCrumbHtml from 'sentry/utils/replays/hooks/useExtractedCrumbHtml';
import type ReplayReader from 'sentry/utils/replays/replayReader';
import DomFilters from 'sentry/views/replays/detail/domMutations/domFilters';
import useDomFilters from 'sentry/views/replays/detail/domMutations/useDomFilters';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import NoRowRenderer from 'sentry/views/replays/detail/noRowRenderer';
import TimestampButton from 'sentry/views/replays/detail/timestampButton';
import useVirtualizedList from 'sentry/views/replays/detail/useVirtualizedList';

type Props = {
  replay: null | ReplayReader;
  startTimestampMs: number;
};

function DomMutations({replay, startTimestampMs}: Props) {
  const {currentTime, currentHoverTime} = useReplayContext();
  const {isLoading, actions} = useExtractedCrumbHtml({replay});

  const filterProps = useDomFilters({actions: actions || []});
  const {items, setSearchTerm} = filterProps;
  const clearSearchTerm = () => setSearchTerm('');

  const {handleMouseEnter, handleMouseLeave, handleClick} =
    useCrumbHandlers(startTimestampMs);

  const crumbs = items.map(mutation => mutation.crumb);
  const current = getPrevReplayEvent({
    items: crumbs,
    targetTimestampMs: startTimestampMs + currentTime,
    allowEqual: true,
    allowExact: true,
  });

  const hovered = currentHoverTime
    ? getPrevReplayEvent({
        items: crumbs,
        targetTimestampMs: startTimestampMs + currentHoverTime,
        allowEqual: true,
        allowExact: true,
      })
    : null;

  const listRef = useRef<ReactVirtualizedList>(null);
  const {cache} = useVirtualizedList({
    cellMeasurer: {
      fixedWidth: true,
      minHeight: 82,
    },
    ref: listRef,
    deps: [items],
  });

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
          isCurrent={crumb.id === current?.id}
          isHovered={crumb.id === hovered?.id}
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
              <TimestampButton
                onClick={() => handleClick(crumb)}
                startTimestampMs={startTimestampMs}
                timestampMs={crumb.timestamp || ''}
              />
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
      <DomFilters actions={actions} {...filterProps} />
      <MutationList>
        {isLoading || !actions ? (
          <Placeholder height="100%" />
        ) : (
          <AutoSizer>
            {({width, height}) => (
              <ReactVirtualizedList
                ref={listRef}
                deferredMeasurementCache={cache}
                height={height}
                overscanRowCount={5}
                rowCount={items.length}
                noRowsRenderer={() => (
                  <NoRowRenderer
                    unfilteredItems={actions}
                    clearSearchTerm={clearSearchTerm}
                  >
                    {t('No DOM events recorded')}
                  </NoRowRenderer>
                )}
                rowHeight={cache.rowHeight}
                rowRenderer={renderRow}
                width={width}
              />
            )}
          </AutoSizer>
        )}
      </MutationList>
    </MutationContainer>
  );
}

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

const MutationListItem = styled('li')<{isCurrent: boolean; isHovered: boolean}>`
  display: flex;
  gap: ${space(1)};
  flex-grow: 1;
  padding: ${space(1)} ${space(1.5)};
  position: relative;
  border-bottom: 1px solid
    ${p =>
      p.isCurrent ? p.theme.purple300 : p.isHovered ? p.theme.purple200 : 'transparent'};

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
