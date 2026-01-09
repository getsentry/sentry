import type React from 'react';
import {Fragment, useCallback, useEffect, useMemo, useRef} from 'react';
import type {ListProps} from 'react-virtualized';
import {AutoSizer, CellMeasurer, CellMeasurerCache, List} from 'react-virtualized';
import type {ListRowRenderer} from 'react-virtualized/dist/es/List';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/core/tooltip';
import type {
  BreadcrumbTransactionEvent,
  BreadcrumbWithMeta,
} from 'sentry/components/events/interfaces/breadcrumbs/types';
import type {PanelTableProps} from 'sentry/components/panels/panelTable';
import {PanelTable} from 'sentry/components/panels/panelTable';
import {IconSort} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {BreadcrumbType} from 'sentry/types/breadcrumbs';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {useApiQuery} from 'sentry/utils/queryClient';
import useProjects from 'sentry/utils/useProjects';
import {useResizableDrawer} from 'sentry/utils/useResizableDrawer';

import {isEventId} from './breadcrumb/data/default';
import type {BreadcrumbProps} from './breadcrumb';
import {Breadcrumb} from './breadcrumb';

const PANEL_MIN_HEIGHT = 200;
const PANEL_INITIAL_HEIGHT = 400;

const noop = () => void 0;

const cache = new CellMeasurerCache({
  fixedWidth: true,
  defaultHeight: 38,
});

interface SharedListProps extends ListProps {
  breadcrumbs: BreadcrumbWithMeta[];
  displayRelativeTime: boolean;
  event: BreadcrumbProps['event'];
  organization: Organization;
  relativeTime: string;
  searchTerm: string;
  transactionEvents: BreadcrumbTransactionEvent[] | undefined;
  index?: number;
}

const renderBreadCrumbRow: ListRowRenderer = ({index, key, parent, style}) => {
  return (
    <CellMeasurer
      columnIndex={0}
      key={key}
      cache={cache}
      parent={parent}
      rowIndex={index}
    >
      <BreadcrumbRow
        style={style}
        error={parent.props.breadcrumbs[index]!.breadcrumb.type === BreadcrumbType.ERROR}
      >
        <Breadcrumb
          index={index}
          cache={cache}
          style={style}
          parent={parent}
          meta={parent.props.breadcrumbs[index]!.meta}
          breadcrumb={parent.props.breadcrumbs[index]!.breadcrumb}
          organization={parent.props.organization}
          searchTerm={parent.props.searchTerm}
          event={parent.props.event}
          relativeTime={parent.props.relativeTime}
          displayRelativeTime={parent.props.displayRelativeTime}
          transactionEvents={parent.props.transactionEvents}
          isLastItem={index === parent.props.breadcrumbs.length - 1}
        />
      </BreadcrumbRow>
    </CellMeasurer>
  );
};

interface Props
  extends Pick<
    BreadcrumbProps,
    'event' | 'organization' | 'searchTerm' | 'relativeTime' | 'displayRelativeTime'
  > {
  breadcrumbs: BreadcrumbWithMeta[];
  emptyMessage: Pick<
    React.ComponentProps<typeof PanelTable>,
    'emptyMessage' | 'emptyAction'
  >;
  onSwitchTimeFormat: () => void;
}

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
  const {projects, fetching: loadingProjects} = useProjects();

  const maybeProject = loadingProjects
    ? null
    : projects.find(project => {
        return event && project.id === event.projectID;
      });

  const listRef = useRef<List>(null);

  const sentryTransactionIds = useMemo(() => {
    const crumbs: string[] = [];

    for (const crumb of breadcrumbs) {
      if (
        crumb.breadcrumb.category !== 'sentry.transaction' ||
        !defined(crumb.breadcrumb.message) ||
        !isEventId(crumb.breadcrumb.message)
      ) {
        continue;
      }

      crumbs.push(crumb.breadcrumb.message);
    }

    return crumbs;
  }, [breadcrumbs]);

  const {data: transactionEvents} = useApiQuery<{
    data: BreadcrumbTransactionEvent[];
    meta: any;
  }>(
    [
      `/organizations/${organization.slug}/events/`,
      {
        query: {
          query: `id:[${sentryTransactionIds}]`,
          field: ['title', 'trace', 'timestamp'],
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

  const {
    size: containerSize,
    isHeld,
    onMouseDown,
    onDoubleClick,
  } = useResizableDrawer({
    direction: 'down',
    onResize: noop,
    initialSize: PANEL_INITIAL_HEIGHT,
    min: PANEL_MIN_HEIGHT,
  });

  const panelHeaders: PanelTableProps['headers'] = useMemo(() => {
    return [
      t('Type'),
      t('Category'),
      t('Description'),
      t('Level'),
      <Time key="time" onClick={onSwitchTimeFormat}>
        <Tooltip
          containerDisplayMode="inline-flex"
          title={displayRelativeTime ? t('Switch to absolute') : t('Switch to relative')}
        >
          <StyledIconSort size="xs" rotated />
        </Tooltip>

        {t('Time')}
      </Time>,
    ];
  }, [displayRelativeTime, onSwitchTimeFormat]);

  // Force update the grid whenever updateGrid, breadcrumbs or transactionEvents changes.
  // This will recompute cell sizes so which might change as a consequence of having more
  // data, which affects how cells are rendered (e.g. links might become internal transaction links).
  useEffect(() => {
    updateGrid();
  }, [breadcrumbs, updateGrid, transactionEvents?.data]);

  return (
    <Fragment>
      <StyledBreadcrumbPanelTable
        headers={panelHeaders}
        isEmpty={!breadcrumbs.length}
        {...emptyMessage}
      >
        <AutoSizer disableHeight onResize={updateGrid}>
          {({width}) => (
            <VirtualizedList
              ref={listRef}
              deferredMeasurementCache={cache}
              height={containerSize}
              overscanRowCount={5}
              organization={organization}
              rowCount={breadcrumbs.length}
              rowHeight={cache.rowHeight}
              rowRenderer={renderBreadCrumbRow}
              searchTerm={searchTerm}
              width={width}
              event={event}
              breadcrumbs={breadcrumbs}
              relativeTime={relativeTime}
              displayRelativeTime={displayRelativeTime}
              transactionEvents={transactionEvents?.data}
            />
          )}
        </AutoSizer>
      </StyledBreadcrumbPanelTable>
      <PanelDragHandle
        onMouseDown={onMouseDown}
        onDoubleClick={onDoubleClick}
        className={isHeld ? 'is-held' : undefined}
      />
    </Fragment>
  );
}

export default Breadcrumbs;

export const StyledBreadcrumbPanelTable = styled(PanelTable)`
  display: grid;
  overflow: hidden;
  grid-template-columns: 64px 140px 1fr 106px 100px;
  margin-bottom: 1px;

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
        css`
          padding: 0;
        `}
    }
  }

  @media (max-width: ${props => props.theme.breakpoints.sm}) {
    grid-template-columns: 48px 1fr 74px 82px;
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
    color: ${p => p.theme.subText};
  }
`;

const PanelDragHandle = styled('div')`
  position: absolute;
  bottom: -1px;
  left: 0px;
  right: 1px;
  height: 10px;
  cursor: ns-resize;
  display: flex;
  align-items: center;

  &::after {
    content: '';
    height: 5px;
    width: 100%;
    border-radius: 0 0 ${p => p.theme.radius.md} ${p => p.theme.radius.md};
    transition: background 100ms ease-in-out;
  }

  &:hover::after,
  &.is-held:after {
    background: ${p => p.theme.tokens.graphics.accent.vibrant};
  }
`;

// XXX(ts): Emotion11 has some trouble with List's defaultProps
//
// It gives the list have a dynamic height; otherwise, in the case of filtered
// options, a list will be displayed with an empty space

function VirtualizedList({ref, ...props}: SharedListProps & {ref: React.RefObject<any>}) {
  return <StyledList ref={ref} {...props} />;
}
const StyledList = styled(List as any)<SharedListProps>`
  height: auto !important;
  max-height: ${p => p.height}px;
  outline: none;
`;

export const BreadcrumbRow = styled('div')<{error: boolean}>`
  :not(:last-child) {
    border-bottom: 1px solid
      ${p => (p.error ? p.theme.colors.red400 : p.theme.tokens.border.secondary)};
  }

  :after {
    content: '';
    position: absolute;
    top: -1px;
    left: 0;
    height: 1px;
    width: 100%;
    background-color: ${p => (p.error ? p.theme.colors.red400 : 'transparent')};
  }
`;
