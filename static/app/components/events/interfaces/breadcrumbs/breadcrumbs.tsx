import {useEffect, useState} from 'react';
import {
  AutoSizer,
  CellMeasurer,
  CellMeasurerCache,
  List,
  ListRowProps,
  ScrollbarPresenceParams,
} from 'react-virtualized';
import styled from '@emotion/styled';

import {PanelTable} from 'app/components/panels';
import Tooltip from 'app/components/tooltip';
import {IconSwitch} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {BreadcrumbsWithDetails} from 'app/types/breadcrumbs';

import Breadcrumb from './breadcrumb';

const PANEL_MAX_HEIGHT = 400;

const cache = new CellMeasurerCache({
  fixedWidth: true,
  minHeight: 42,
});

type Props = Pick<
  React.ComponentProps<typeof Breadcrumb>,
  'event' | 'orgSlug' | 'searchTerm' | 'relativeTime' | 'displayRelativeTime'
> & {
  breadcrumbs: BreadcrumbsWithDetails;
  onSwitchTimeFormat: () => void;
  emptyMessage: Pick<
    React.ComponentProps<typeof PanelTable>,
    'emptyMessage' | 'emptyAction'
  >;
};

type State = {
  scrollToIndex?: number;
  scrollbarSize?: number;
};

function Breadcrumbs({
  breadcrumbs,
  displayRelativeTime,
  onSwitchTimeFormat,
  orgSlug,
  searchTerm,
  event,
  relativeTime,
  emptyMessage,
}: Props) {
  const [state, setState] = useState<State>({});
  const {scrollToIndex, scrollbarSize} = state;

  let listRef: List | null = null;

  useEffect(() => {
    updateGrid();
  }, []);

  useEffect(() => {
    if (!!breadcrumbs.length && !scrollToIndex) {
      setState({...state, scrollToIndex: breadcrumbs.length - 1});
      return;
    }
    updateGrid();
  }, [breadcrumbs]);

  useEffect(() => {
    if (scrollToIndex !== undefined) {
      updateGrid();
    }
  }, [scrollToIndex]);

  function updateGrid() {
    if (listRef) {
      cache.clearAll();
      listRef.forceUpdateGrid();
    }
  }

  function setScrollbarSize({size}: ScrollbarPresenceParams) {
    setState({scrollbarSize: size});
  }

  function renderRow({index, key, parent, style}: ListRowProps) {
    const breadcrumb = breadcrumbs[index];
    const isLastItem = breadcrumbs[breadcrumbs.length - 1].id === breadcrumb.id;
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
          <Breadcrumb
            data-test-id={isLastItem ? 'last-crumb' : 'crumb'}
            style={style}
            onLoad={measure}
            orgSlug={orgSlug}
            searchTerm={searchTerm}
            breadcrumb={breadcrumb}
            event={event}
            relativeTime={relativeTime}
            displayRelativeTime={displayRelativeTime}
            height={height ? String(height) : undefined}
          />
        )}
      </CellMeasurer>
    );
  }

  return (
    <StyledPanelTable
      scrollbarSize={scrollbarSize ?? 0}
      headers={[
        t('Type'),
        t('Category'),
        t('Description'),
        t('Level'),
        <Time key="time" onClick={onSwitchTimeFormat}>
          <Tooltip
            containerDisplayMode="inline-flex"
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
      isEmpty={!breadcrumbs.length}
      {...emptyMessage}
    >
      <Content>
        <AutoSizer disableHeight onResize={updateGrid}>
          {({width}) => (
            <StyledList
              ref={(el: List | null) => {
                listRef = el;
              }}
              deferredMeasurementCache={cache}
              height={PANEL_MAX_HEIGHT}
              overscanRowCount={5}
              rowCount={breadcrumbs.length}
              rowHeight={cache.rowHeight}
              rowRenderer={renderRow}
              width={width}
              onScrollbarPresenceChange={setScrollbarSize}
              // when the component mounts, it scrolls to the last item
              scrollToIndex={scrollToIndex}
              scrollToAlignment={scrollToIndex ? 'end' : undefined}
            />
          )}
        </AutoSizer>
      </Content>
    </StyledPanelTable>
  );
}

export default Breadcrumbs;

const StyledPanelTable = styled(PanelTable)<{scrollbarSize: number}>`
  display: grid;
  grid-template-columns: 64px 140px 1fr 106px 100px ${p => `${p.scrollbarSize}px`};

  > * {
    :nth-child(-n + 6) {
      border-bottom: 1px solid ${p => p.theme.border};
      border-radius: 0;

      /* Type */
      :nth-child(6n-5) {
        text-align: center;
      }
    }

    /* Content */
    :nth-child(n + 7) {
      grid-column: 1/-1;
      ${p =>
        !p.isEmpty &&
        `
          padding: 0;
        `}
    }
  }

  @media (max-width: ${props => props.theme.breakpoints[0]}) {
    grid-template-columns: 48px 1fr 75px 81px;
    > * {
      :nth-child(-n + 6) {
        /* Type */
        :nth-child(6n-5) {
          padding-right: 0;
        }

        /* Type, Category & Level */
        :nth-child(6n-5),
        :nth-child(6n-4),
        :nth-child(6n-2) {
          color: transparent;
        }

        /* Description & Scrollbar */
        :nth-child(6n-3),
        :nth-child(6n) {
          display: none;
        }
      }
    }
  }

  overflow: hidden;
`;

const Time = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  grid-gap: ${space(1)};
  cursor: pointer;
`;

const StyledIconSwitch = styled(IconSwitch)`
  transition: 0.15s color;
  :hover {
    color: ${p => p.theme.gray300};
  }
`;

const Content = styled('div')`
  max-height: ${PANEL_MAX_HEIGHT}px;
  overflow: hidden;
`;

// XXX(ts): Emotion11 has some trouble with List's defaultProps
//
// It gives the list have a dynamic height; otherwise, in the case of filtered
// options, a list will be displayed with an empty space
const StyledList = styled(List as any)<React.ComponentProps<typeof List>>`
  height: auto !important;
  max-height: ${p => p.height}px;
  outline: none;
`;
