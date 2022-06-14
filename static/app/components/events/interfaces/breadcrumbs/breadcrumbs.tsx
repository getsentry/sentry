import {useEffect, useRef, useState} from 'react';
import {
  AutoSizer,
  CellMeasurer,
  CellMeasurerCache,
  List,
  ListRowProps,
} from 'react-virtualized';
import styled from '@emotion/styled';

import {PanelTable} from 'sentry/components/panels';
import Tooltip from 'sentry/components/tooltip';
import {IconSort} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Crumb} from 'sentry/types/breadcrumbs';

import Breadcrumb from './breadcrumb';

const PANEL_MAX_HEIGHT = 400;

const cache = new CellMeasurerCache({
  fixedWidth: true,
  minHeight: 42,
});

type Props = Pick<
  React.ComponentProps<typeof Breadcrumb>,
  | 'event'
  | 'organization'
  | 'searchTerm'
  | 'relativeTime'
  | 'displayRelativeTime'
  | 'router'
  | 'route'
> & {
  breadcrumbs: Crumb[];
  emptyMessage: Pick<
    React.ComponentProps<typeof PanelTable>,
    'emptyMessage' | 'emptyAction'
  >;
  onSwitchTimeFormat: () => void;
};

function Breadcrumbs({
  breadcrumbs,
  displayRelativeTime,
  onSwitchTimeFormat,
  organization,
  searchTerm,
  event,
  relativeTime,
  emptyMessage,
  route,
  router,
}: Props) {
  const [scrollToIndex, setScrollToIndex] = useState<number | undefined>(undefined);
  const [scrollbarSize, setScrollbarSize] = useState(0);

  let listRef: List | null = null;
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    updateGrid();
  }, []);

  useEffect(() => {
    if (!!breadcrumbs.length && !scrollToIndex) {
      setScrollToIndex(breadcrumbs.length - 1);
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
            organization={organization}
            searchTerm={searchTerm}
            breadcrumb={breadcrumb}
            event={event}
            relativeTime={relativeTime}
            displayRelativeTime={displayRelativeTime}
            height={height ? String(height) : undefined}
            scrollbarSize={
              (contentRef?.current?.offsetHeight ?? 0) < PANEL_MAX_HEIGHT
                ? scrollbarSize
                : 0
            }
            router={router}
            route={route}
          />
        )}
      </CellMeasurer>
    );
  }

  return (
    <StyledPanelTable
      scrollbarSize={scrollbarSize}
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
            <StyledIconSort size="xs" rotated />
          </Tooltip>

          {t('Time')}
        </Time>,
        '',
      ]}
      isEmpty={!breadcrumbs.length}
      {...emptyMessage}
    >
      <Content ref={contentRef}>
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
              onScrollbarPresenceChange={({size}) => setScrollbarSize(size)}
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
      /* This is to fix a small issue with the border not being fully visible on smaller devices */
      margin-bottom: 1px;

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

  @media (max-width: ${props => props.theme.breakpoints.small}) {
    grid-template-columns: 48px 1fr 74px 82px ${p => `${p.scrollbarSize}px`};
    > * {
      :nth-child(-n + 6) {
        /* Type, Category & Level */
        :nth-child(6n-5),
        :nth-child(6n-4),
        :nth-child(6n-2) {
          color: transparent;
        }

        /* Description & Scrollbar */
        :nth-child(6n-3) {
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
  gap: ${space(1)};
  cursor: pointer;
`;

const StyledIconSort = styled(IconSort)`
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
