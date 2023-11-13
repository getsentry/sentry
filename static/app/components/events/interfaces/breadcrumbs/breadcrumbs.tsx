import React, {Fragment, useCallback, useEffect, useMemo, useRef} from 'react';
import {
  AutoSizer,
  CellMeasurer,
  CellMeasurerCache,
  List,
  ListProps,
} from 'react-virtualized';
import styled from '@emotion/styled';

import {
  BreadcrumbTransactionEvent,
  BreadcrumbWithMeta,
} from 'sentry/components/events/interfaces/breadcrumbs/types';
import PanelTable, {PanelTableProps} from 'sentry/components/panels/panelTable';
import {Tooltip} from 'sentry/components/tooltip';
import {IconSort} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {BreadcrumbType} from 'sentry/types/breadcrumbs';
import {defined} from 'sentry/utils';
import {useApiQuery} from 'sentry/utils/queryClient';
import useProjects from 'sentry/utils/useProjects';
import {useResizableDrawer} from 'sentry/utils/useResizableDrawer';

import {isEventId} from './breadcrumb/data/default';
import {Breadcrumb, BreadcrumbProps} from './breadcrumb';

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
  index: number;
  organization: Organization;
  relativeTime: string;
  searchTerm: string;
  transactionEvents: BreadcrumbTransactionEvent[] | undefined;
}

interface BreadCrumbListClass extends Omit<List, 'props'> {
  props: SharedListProps;
}

interface RenderBreadCrumbRowProps {
  index: number;
  key: string;
  parent: BreadCrumbListClass;
  style: React.CSSProperties;
}

function renderBreadCrumbRow({index, key, parent, style}: RenderBreadCrumbRowProps) {
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
        error={parent.props.breadcrumbs[index].breadcrumb.type === BreadcrumbType.ERROR}
      >
        <Breadcrumb
          index={index}
          cache={cache}
          style={style}
          parent={parent}
          meta={parent.props.breadcrumbs[index].meta}
          breadcrumb={parent.props.breadcrumbs[index].breadcrumb}
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
}

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

  const maybeProject = !loadingProjects
    ? projects.find(project => {
        return event && project.id === event.projectID;
      })
    : null;

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
      <StyledPanelTable
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
      </StyledPanelTable>
      <PanelDragHandle
        onMouseDown={onMouseDown}
        onDoubleClick={onDoubleClick}
        className={isHeld ? 'is-held' : undefined}
      />
    </Fragment>
  );
}

export default Breadcrumbs;

const StyledPanelTable = styled(PanelTable)`
  display: grid;
  overflow: hidden;
  grid-template-columns: 64px 140px 1fr 106px 100px;

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
    color: ${p => p.theme.gray300};
  }
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

const VirtualizedList = React.forwardRef<any, SharedListProps>((props, ref) => {
  return <StyledList ref={ref} {...props} />;
});
const StyledList = styled(List as any)<SharedListProps>`
  height: auto !important;
  max-height: ${p => p.height}px;
  outline: none;
`;

const BreadcrumbRow = styled('div')<{error: boolean}>`
  :not(:last-child) {
    border-bottom: 1px solid ${p => (p.error ? p.theme.red300 : p.theme.innerBorder)};
  }

  :after {
    content: '';
    position: absolute;
    top: -1px;
    left: 0;
    height: 1px;
    width: 100%;
    background-color: ${p => (p.error ? p.theme.red300 : 'transparent')};
  }
`;
