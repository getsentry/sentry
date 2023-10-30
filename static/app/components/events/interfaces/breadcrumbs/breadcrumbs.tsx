import {useCallback, useEffect, useRef, useState} from 'react';
import {
  AutoSizer,
  CellMeasurer,
  CellMeasurerCache,
  List,
  ListRowProps,
} from 'react-virtualized';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {
  BreadcrumbTransactionEvent,
  BreadcrumbWithMeta,
} from 'sentry/components/events/interfaces/breadcrumbs/types';
import PanelTable from 'sentry/components/panels/panelTable';
import {Tooltip} from 'sentry/components/tooltip';
import {IconSort} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {BreadcrumbType} from 'sentry/types/breadcrumbs';
import {defined} from 'sentry/utils';
import {useApiQuery} from 'sentry/utils/queryClient';
import useProjects from 'sentry/utils/useProjects';
import {useResizableDrawer} from 'sentry/utils/useResizableDrawer';

import {isEventId} from './breadcrumb/data/default';
import {Breadcrumb} from './breadcrumb';

const PANEL_MIN_HEIGHT = 200;
const PANEL_INITIAL_HEIGHT = 400;

const cache = new CellMeasurerCache({
  fixedWidth: true,
  defaultHeight: 38,
});

type Props = Pick<
  React.ComponentProps<typeof Breadcrumb>,
  'event' | 'organization' | 'searchTerm' | 'relativeTime' | 'displayRelativeTime'
> & {
  breadcrumbs: BreadcrumbWithMeta[];
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
}: Props) {
  const [scrollbarSize, setScrollbarSize] = useState(0);
  const {projects, fetching: loadingProjects} = useProjects();

  const maybeProject = !loadingProjects
    ? projects.find(project => {
        return event && project.id === event.projectID;
      })
    : null;

  const listRef = useRef<List>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const sentryTransaction = breadcrumbs.filter(
    crumb =>
      crumb.breadcrumb.category === 'sentry.transaction' &&
      defined(crumb.breadcrumb.message) &&
      isEventId(crumb.breadcrumb.message)
  );

  const sentryTransactionIds = sentryTransaction
    .map(crumb => crumb.breadcrumb.message)
    .filter(defined);

  const {data: transactionEvents} = useApiQuery<{
    data: BreadcrumbTransactionEvent[];
    meta: any;
  }>(
    [
      `/organizations/${organization.slug}/events/`,
      {
        query: {
          query: `id:[${sentryTransactionIds}]`,
          field: ['title'],
          project: [maybeProject?.id],
        },
      },
    ],
    {
      staleTime: Infinity,
      enabled: sentryTransactionIds.length > 0 && defined(maybeProject),
    }
  );

  const updateGrid = useCallback(() => {
    if (listRef.current) {
      cache.clearAll();
      listRef.current.forceUpdateGrid();
    }
  }, []);

  useEffect(() => {
    updateGrid();
  }, [breadcrumbs, updateGrid]);

  const {
    size: containerSize,
    isHeld,
    onMouseDown,
    onDoubleClick,
  } = useResizableDrawer({
    direction: 'down',
    onResize: () => void 0,
    initialSize: PANEL_INITIAL_HEIGHT,
    min: PANEL_MIN_HEIGHT,
  });

  function renderRow({index, key, parent, style}: ListRowProps) {
    const {breadcrumb, meta} = breadcrumbs[index];
    const isLastItem = index === breadcrumbs.length - 1;

    return (
      <CellMeasurer
        cache={cache}
        columnIndex={0}
        key={key}
        parent={parent}
        rowIndex={index}
      >
        {({measure}) => (
          <BreadcrumbRow style={style} error={breadcrumb.type === BreadcrumbType.ERROR}>
            <Breadcrumb
              index={index}
              cache={cache}
              isLastItem={isLastItem}
              style={style}
              onResize={measure}
              organization={organization}
              searchTerm={searchTerm}
              breadcrumb={breadcrumb}
              meta={meta}
              event={event}
              relativeTime={relativeTime}
              displayRelativeTime={displayRelativeTime}
              scrollbarSize={
                (contentRef?.current?.offsetHeight ?? 0) < containerSize
                  ? scrollbarSize
                  : 0
              }
              transactionEvents={transactionEvents?.data}
            />
          </BreadcrumbRow>
        )}
      </CellMeasurer>
    );
  }

  return (
    <Wrapper>
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
          // Space for the scrollbar
          '',
        ]}
        isEmpty={!breadcrumbs.length}
        {...emptyMessage}
      >
        <Content ref={contentRef}>
          <AutoSizer disableHeight onResize={updateGrid}>
            {({width}) => (
              <StyledList
                ref={listRef}
                deferredMeasurementCache={cache}
                height={containerSize}
                overscanRowCount={5}
                rowCount={breadcrumbs.length}
                rowHeight={cache.rowHeight}
                rowRenderer={renderRow}
                width={width}
                onScrollbarPresenceChange={({size}) => setScrollbarSize(size)}
              />
            )}
          </AutoSizer>
        </Content>
      </StyledPanelTable>
      <PanelDragHandle
        onMouseDown={onMouseDown}
        onDoubleClick={onDoubleClick}
        className={isHeld ? 'is-held' : undefined}
      />
    </Wrapper>
  );
}

export default Breadcrumbs;

const Wrapper = styled('div')`
  position: relative;
`;

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

    /* Scroll bar header */
    :nth-child(6) {
      padding: 0;
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
  overflow: hidden;
`;

const PanelDragHandle = styled('div')`
  position: absolute;
  bottom: -1px;
  left: 1px;
  right: 1px;
  height: 10px;
  cursor: ns-resize;
  display: flex;
  align-items: center;

  &::after {
    content: '';
    height: 5px;
    width: 100%;
    border-radius: ${p => p.theme.borderRadiusBottom};
    transition: background 100ms ease-in-out;
  }

  &:hover::after,
  &.is-held:after {
    background: ${p => p.theme.purple300};
  }
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

const BreadcrumbRow = styled('div')<{error: boolean}>`
  :not(:last-child) {
    border-bottom: 1px solid ${p => (p.error ? p.theme.red300 : p.theme.innerBorder)};
  }

  ${p =>
    p.error &&
    css`
      :after {
        content: '';
        position: absolute;
        top: -1px;
        left: 0;
        height: 1px;
        width: 100%;
        background: ${p.theme.red300};
      }
    `}
`;
