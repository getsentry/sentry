import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';

import {InfoTip} from '@sentry/scraps/info';

import {PerformanceDuration} from 'sentry/components/performanceDuration';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {AggregateProfileSource} from 'sentry/utils/analytics/profilingAnalyticsEvents';
import {defined} from 'sentry/utils/defined';
import type {
  CanvasPoolManager,
  CanvasScheduler,
} from 'sentry/utils/profiling/canvasScheduler';
import {filterFlamegraphTree} from 'sentry/utils/profiling/filterFlamegraphTree';
import {useFlamegraphProfiles} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphProfiles';
import {useDispatchFlamegraphState} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphState';
import {useFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';
import type {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {formatColorForFrame} from 'sentry/utils/profiling/gl/utils';
import {useContextMenu} from 'sentry/utils/profiling/hooks/useContextMenu';
import {VirtualizedTree} from 'sentry/utils/profiling/hooks/useVirtualizedTree/VirtualizedTree';
import type {VirtualizedTreeNode} from 'sentry/utils/profiling/hooks/useVirtualizedTree/VirtualizedTreeNode';
import {invertCallTree} from 'sentry/utils/profiling/profile/utils';
import {relativeWeight} from 'sentry/utils/profiling/units/units';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useFlamegraph} from 'sentry/views/explore/profiling/flamegraphProvider';
import {useProfileGroup} from 'sentry/views/explore/profiling/profileGroupProvider';

import {AggregateFlamegraphTreeContextMenu} from './aggregateFlamegraphTreeContextMenu';
import {
  CallTreeTable,
  CallTreeTableContainer,
  CallTreeTableFrameCell,
  CallTreeTableRow,
  CallTreeTableWeightCell,
  useCallTreeTable,
} from './callTreeTable';

function makeSortFunction(
  property: 'sample count' | 'duration' | 'name',
  direction: 'asc' | 'desc'
) {
  if (property === 'sample count') {
    return direction === 'desc'
      ? (
          a: VirtualizedTreeNode<FlamegraphFrame>,
          b: VirtualizedTreeNode<FlamegraphFrame>
        ) => {
          return b.node.node.totalWeight - a.node.node.totalWeight;
        }
      : (
          a: VirtualizedTreeNode<FlamegraphFrame>,
          b: VirtualizedTreeNode<FlamegraphFrame>
        ) => {
          return a.node.node.totalWeight - b.node.node.totalWeight;
        };
  }

  if (property === 'duration') {
    return direction === 'desc'
      ? (
          a: VirtualizedTreeNode<FlamegraphFrame>,
          b: VirtualizedTreeNode<FlamegraphFrame>
        ) => {
          const avgA = a.node.frame.averageCallDuration || 0;
          const avgB = b.node.frame.averageCallDuration || 0;
          return avgB - avgA;
        }
      : (
          a: VirtualizedTreeNode<FlamegraphFrame>,
          b: VirtualizedTreeNode<FlamegraphFrame>
        ) => {
          const avgA = a.node.frame.averageCallDuration || 0;
          const avgB = b.node.frame.averageCallDuration || 0;
          return avgA - avgB;
        };
  }

  if (property === 'name') {
    return direction === 'desc'
      ? (
          a: VirtualizedTreeNode<FlamegraphFrame>,
          b: VirtualizedTreeNode<FlamegraphFrame>
        ) => {
          return a.node.frame.name.localeCompare(b.node.frame.name);
        }
      : (
          a: VirtualizedTreeNode<FlamegraphFrame>,
          b: VirtualizedTreeNode<FlamegraphFrame>
        ) => {
          return b.node.frame.name.localeCompare(a.node.frame.name);
        };
  }

  throw new Error(`Unknown sort property ${property}`);
}

function skipRecursiveNodes(n: VirtualizedTreeNode<FlamegraphFrame>): boolean {
  return n.node.node.isDirectRecursive();
}

interface AggregateFlamegraphTreeTableProps {
  canvasPoolManager: CanvasPoolManager;
  canvasScheduler: CanvasScheduler;
  frameFilter: 'system' | 'application' | 'all';
  profileType: AggregateProfileSource;
  recursion: 'collapsed' | null;
  expanded?: boolean;
}

export function AggregateFlamegraphTreeTable({
  canvasPoolManager,
  canvasScheduler,
  expanded,
  profileType,
  recursion,
  frameFilter,
}: AggregateFlamegraphTreeTableProps) {
  const organization = useOrganization();
  const dispatch = useDispatchFlamegraphState();
  const profiles = useFlamegraphProfiles();
  const profileGroup = useProfileGroup();
  const flamegraph = useFlamegraph();
  const theme = useFlamegraphTheme();
  const referenceNode = flamegraph.root;

  const [treeView, setTreeView] = useLocalStorageState<'bottom up' | 'top down'>(
    'profiling-aggregate-call-tree-view',
    'bottom up'
  );

  const rootNodes = useMemo(() => {
    return flamegraph.root.children;
  }, [flamegraph.root.children]);

  const tree: FlamegraphFrame[] | null = useMemo(() => {
    function skipFunction(frame: FlamegraphFrame): boolean {
      return frameFilter === 'application'
        ? !frame.frame.is_application
        : frameFilter === 'system'
          ? frame.frame.is_application
          : false;
    }

    const maybeFilteredRoots =
      frameFilter === 'all' ? rootNodes : filterFlamegraphTree(rootNodes, skipFunction);

    if (treeView === 'top down') {
      return maybeFilteredRoots;
    }
    return invertCallTree(maybeFilteredRoots);
  }, [frameFilter, rootNodes, treeView]);

  const {colorMap} = useMemo(() => {
    return theme.COLORS.stackToColor(
      flamegraph.frames,
      theme.COLORS.COLOR_MAPS['by symbol name'],
      theme.COLORS.COLOR_BUCKET,
      theme
    );
  }, [theme, flamegraph.frames]);

  const getFrameColor = useCallback(
    (frame: FlamegraphFrame) => {
      return formatColorForFrame(
        frame,
        colorMap.get(frame.key) ?? theme.COLORS.FRAME_FALLBACK_COLOR
      );
    },
    [theme, colorMap]
  );

  useEffect(() => {
    if (defined(profiles.threadId)) {
      return;
    }
    const threadID =
      typeof profileGroup.activeProfileIndex === 'number'
        ? profileGroup.profiles[profileGroup.activeProfileIndex]?.threadId
        : null;
    // fall back case, when we finally load the active profile index from the profile,
    // make sure we update the thread id so that it is show first
    if (defined(threadID)) {
      dispatch({
        type: 'set thread id',
        payload: threadID,
      });
    }
  }, [profileGroup, profiles.threadId, dispatch]);

  const [sort, setSort] = useState<'sample count' | 'duration' | 'name'>('sample count');
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc');
  const sortFunction = useMemo(() => {
    return makeSortFunction(sort, direction);
  }, [sort, direction]);

  const [tableParentContainer, setTableParentContainer] = useState<HTMLDivElement | null>(
    null
  );
  const contextMenu = useContextMenu({container: tableParentContainer});

  const virtualizedTree = useMemo(() => {
    return VirtualizedTree.fromRoots(tree ?? []);
  }, [tree]);

  const {
    items: renderItems,
    rowCount,
    tableRef,
    handleSortingChange,
    handleScrollTo,
    handleExpandTreeNode,
    handleRowClick: _handleRowClick,
    getRowProps,
    getNodeAtIndex,
  } = useCallTreeTable({
    expanded,
    skipFunction: recursion === 'collapsed' ? skipRecursiveNodes : undefined,
    sortFunction,
    tree,
    virtualizedTree,
  });

  const handleRowClick = useCallback(
    (index: number) => {
      const handler = _handleRowClick(index);
      return function (evt: React.MouseEvent<HTMLElement>) {
        trackAnalytics('profiling_views.flamegraph.click.highlight_frame', {
          organization,
          profile_type: profileType,
        });
        const frame = getNodeAtIndex(index);
        if (frame) {
          canvasPoolManager.dispatch('highlight frame', [[frame], 'selected']);
        }
        handler(evt);
      };
    },
    [canvasPoolManager, _handleRowClick, getNodeAtIndex, organization, profileType]
  );

  useEffect(() => {
    function onShowInTableView(frame: FlamegraphFrame) {
      handleScrollTo(node => node.node === frame.node);
    }

    canvasScheduler.on('zoom at frame', onShowInTableView);
    canvasScheduler.on('show in table view', onShowInTableView);
    return () => {
      canvasScheduler.off('show in table view', onShowInTableView);
      canvasScheduler.off('zoom at frame', onShowInTableView);
    };
  }, [canvasScheduler, handleScrollTo]);

  const onSortChange = useCallback(
    (newSort: 'sample count' | 'duration' | 'name') => {
      const newDirection =
        newSort === sort ? (direction === 'asc' ? 'desc' : 'asc') : 'desc';

      setDirection(newDirection);
      setSort(newSort);

      const sortFn = makeSortFunction(newSort, newDirection);
      handleSortingChange(sortFn);
    },
    [sort, direction, handleSortingChange]
  );

  const onSortBySampleCount = useCallback(() => {
    onSortChange('sample count');
  }, [onSortChange]);

  const onSortByName = useCallback(() => {
    onSortChange('name');
  }, [onSortChange]);

  const onSortByDuration = useCallback(() => {
    onSortChange('duration');
  }, [onSortChange]);

  const onBottomUpClick = useCallback(() => {
    setTreeView('bottom up');
  }, [setTreeView]);

  const onTopDownClick = useCallback(() => {
    setTreeView('top down');
  }, [setTreeView]);

  return (
    <CallTreeTableContainer ref={setTableParentContainer}>
      <AggregateFlamegraphTreeContextMenu
        onBottomUpClick={onBottomUpClick}
        onTopDownClick={onTopDownClick}
        contextMenu={contextMenu}
      />
      <CallTreeTable
        ref={tableRef}
        items={renderItems}
        rowCount={rowCount}
        header={
          <Fragment>
            <SimpleTable.HeaderCell
              handleSortClick={onSortBySampleCount}
              sort={sort === 'sample count' ? direction : undefined}
            >
              {t('Samples')}{' '}
              <InfoTip
                title={t('How often this frame appeared in stack samples.')}
                size="sm"
                position="top"
              />
            </SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell
              handleSortClick={onSortByDuration}
              sort={sort === 'duration' ? direction : undefined}
            >
              {t('Average Duration')}{' '}
              <InfoTip
                title={t('Average duration of this frame across different samples.')}
                size="sm"
                position="top"
              />
            </SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell
              handleSortClick={onSortByName}
              sort={sort === 'name' ? direction : undefined}
            >
              {t('Frame')}
            </SimpleTable.HeaderCell>
          </Fragment>
        }
      >
        {renderItems.map(r => (
          <CallTreeTableRow
            key={r.key}
            {...getRowProps(r)}
            onClick={handleRowClick(r.key)}
            onContextMenu={contextMenu.handleContextMenu}
          >
            <CallTreeTableWeightCell
              relativeWeight={relativeWeight(
                referenceNode.node.totalWeight,
                r.item.node.node.totalWeight
              )}
            >
              {r.item.node.node.totalWeight.toFixed(0)}
            </CallTreeTableWeightCell>
            <CallTreeTableWeightCell>
              {defined(r.item.node.frame.averageCallDuration) ? (
                <PerformanceDuration
                  nanoseconds={r.item.node.frame.averageCallDuration}
                  abbreviation
                />
              ) : (
                t('Unknown')
              )}
            </CallTreeTableWeightCell>
            <CallTreeTableFrameCell
              frameColor={getFrameColor(r.item.node)}
              node={r.item}
              onExpandClick={handleExpandTreeNode}
            />
          </CallTreeTableRow>
        ))}
      </CallTreeTable>
    </CallTreeTableContainer>
  );
}
