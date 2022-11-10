import {useCallback, useEffect, useRef, useState} from 'react';
import {AutoSizer, CellMeasurer, CellMeasurerCache, List} from 'react-virtualized';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {PanelTable} from 'sentry/components/panels';
import {PanelTableProps} from 'sentry/components/panels/panelTable';
import Tooltip from 'sentry/components/tooltip';
import {IconSort} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {EntryType} from 'sentry/types';
import {Crumb} from 'sentry/types/breadcrumbs';
import {Event} from 'sentry/types/event';

import {Breadcrumb} from './breadcrumb';

const PANEL_MAX_HEIGHT = 400;

const cache = new CellMeasurerCache({
  fixedWidth: true,
  minHeight: 42,
});

type Props = {
  displayRelativeTime: boolean;
  event: Event;
  onSwitchTimeFormat: () => void;
  relativeTime: string;
  searchTerm: string;
  breadcrumbs?: Crumb[];
  emptyAction?: PanelTableProps['emptyAction'];
  emptyMessage?: PanelTableProps['emptyMessage'];
};

export function Breadcrumbs({
  breadcrumbs,
  displayRelativeTime,
  onSwitchTimeFormat,
  searchTerm,
  event,
  relativeTime,
  emptyMessage,
  emptyAction,
}: Props) {
  const [scrollbarSize, setScrollbarSize] = useState(0);
  const entryIndex = event.entries.findIndex(
    entry => entry.type === EntryType.BREADCRUMBS
  );

  const contentRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<List>(null);

  const updateGrid = useCallback(() => {
    if (listRef.current) {
      cache.clearAll();
      listRef.current.forceUpdateGrid();
    }
  }, []);

  useEffect(() => {
    updateGrid();
  }, [breadcrumbs, updateGrid]);

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
      isEmpty={!(breadcrumbs ?? []).length}
      emptyMessage={emptyMessage}
      emptyAction={emptyAction}
      isLoading={breadcrumbs === undefined}
    >
      <Content ref={contentRef}>
        <AutoSizer disableHeight onResize={updateGrid}>
          {({width}) => (
            <StyledList
              ref={listRef}
              deferredMeasurementCache={cache}
              height={PANEL_MAX_HEIGHT}
              scrollToIndex={0}
              scrollToAlignment="end"
              overscanRowCount={5}
              rowCount={(breadcrumbs ?? []).length}
              rowHeight={cache.rowHeight}
              rowRenderer={rowProps => {
                return (
                  <CellMeasurer
                    cache={cache}
                    columnIndex={0}
                    key={rowProps.key}
                    parent={rowProps.parent}
                    rowIndex={rowProps.index}
                    style={rowProps.style}
                  >
                    {({measure}) => (
                      <Breadcrumb
                        data-test-id={
                          (breadcrumbs ?? [])[(breadcrumbs ?? []).length - 1].id ===
                          (breadcrumbs ?? [])[rowProps.index].id
                            ? 'last-crumb'
                            : 'crumb'
                        }
                        style={rowProps.style}
                        onLoad={measure}
                        searchTerm={searchTerm}
                        breadcrumb={(breadcrumbs ?? [])[rowProps.index]}
                        meta={
                          event._meta?.entries?.[entryIndex]?.data?.values?.[
                            rowProps.index
                          ]
                        }
                        event={event}
                        relativeTime={relativeTime}
                        displayRelativeTime={displayRelativeTime}
                        height={
                          rowProps.style.height
                            ? String(rowProps.style.height)
                            : undefined
                        }
                        scrollbarSize={
                          (contentRef?.current?.offsetHeight ?? 0) < PANEL_MAX_HEIGHT
                            ? scrollbarSize
                            : 0
                        }
                      />
                    )}
                  </CellMeasurer>
                );
              }}
              width={width}
              onScrollbarPresenceChange={({size}) => setScrollbarSize(size)}
            />
          )}
        </AutoSizer>
      </Content>
    </StyledPanelTable>
  );
}

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
      ${p => !p.isEmpty && 'transform: scaleY(-1)'}; /* Flip the list */
      grid-column: 1/-1;
      ${p =>
        !p.isEmpty &&
        css`
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
