import {useCallback, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {vec2} from 'gl-matrix';

import Button from 'sentry/components/button';
import {IconArrow, IconSettings, IconUser} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {CanvasPoolManager} from 'sentry/utils/profiling/canvasScheduler';
import {useFlamegraphProfilesValue} from 'sentry/utils/profiling/flamegraph/useFlamegraphProfiles';
import {useFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';
import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {formatColorForFrame} from 'sentry/utils/profiling/gl/utils';
import {useVirtualizedTree} from 'sentry/utils/profiling/hooks/useVirtualizedTree/useVirtualizedTree';
import {VirtualizedTreeNode} from 'sentry/utils/profiling/hooks/useVirtualizedTree/VirtualizedTreeNode';
import {invertCallTree} from 'sentry/utils/profiling/profile/utils';
import {FlamegraphRenderer} from 'sentry/utils/profiling/renderers/flamegraphRenderer';

function computeRelativeWeight(base: number, value: number) {
  // Make sure we dont divide by zero
  if (!base || !value) {
    return 0;
  }
  return (value / base) * 100;
}

function makeSortFunction(
  property: 'total weight' | 'self weight' | 'name',
  direction: 'asc' | 'desc'
) {
  if (property === 'total weight') {
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

  if (property === 'self weight') {
    return direction === 'desc'
      ? (
          a: VirtualizedTreeNode<FlamegraphFrame>,
          b: VirtualizedTreeNode<FlamegraphFrame>
        ) => {
          return b.node.node.selfWeight - a.node.node.selfWeight;
        }
      : (
          a: VirtualizedTreeNode<FlamegraphFrame>,
          b: VirtualizedTreeNode<FlamegraphFrame>
        ) => {
          return a.node.node.selfWeight - b.node.node.selfWeight;
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

interface FrameCallTreeStackProps {
  flamegraphRenderer: FlamegraphRenderer;
  referenceNode: FlamegraphFrame;
  roots: FlamegraphFrame[];
}

function FrameCallTreeStack({
  roots,
  flamegraphRenderer,
  referenceNode,
}: FrameCallTreeStackProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [sort, setSort] = useState<'total weight' | 'self weight' | 'name'>(
    'total weight'
  );
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc');

  const sortFunction = useMemo(() => {
    return makeSortFunction(sort, direction);
  }, [sort, direction]);

  const {
    items,
    scrollContainerStyles,
    containerStyles,
    handleExpandTreeNode,
    handleSortingChange,
    handleScroll,
  } = useVirtualizedTree({
    sortFunction,
    scrollContainerRef,
    rowHeight: 24,
    roots,
  });

  const onSortChange = useCallback(
    (newSort: 'total weight' | 'self weight' | 'name') => {
      const newDirection =
        newSort === sort ? (direction === 'asc' ? 'desc' : 'asc') : 'desc';

      setDirection(newDirection);
      setSort(newSort);

      const sortFn = makeSortFunction(newSort, newDirection);
      handleSortingChange(sortFn);
    },
    [sort, direction, handleSortingChange]
  );

  return (
    <FrameBar>
      <FrameCallersTable>
        <FrameCallersTableHeader>
          <FrameWeightCell>
            <TableHeaderButton onClick={() => onSortChange('self weight')}>
              {t('Self Time ')}
              {sort === 'self weight' ? (
                <IconArrow direction={direction === 'desc' ? 'down' : 'up'} />
              ) : null}
            </TableHeaderButton>
          </FrameWeightCell>
          <FrameWeightCell>
            <TableHeaderButton onClick={() => onSortChange('total weight')}>
              {t('Total Time')}{' '}
              {sort === 'total weight' ? (
                <IconArrow direction={direction === 'desc' ? 'down' : 'up'} />
              ) : null}
            </TableHeaderButton>
          </FrameWeightCell>
          <FrameNameCell>
            <TableHeaderButton onClick={() => onSortChange('name')}>
              {t('Frame')}{' '}
              {sort === 'name' ? (
                <IconArrow direction={direction === 'desc' ? 'down' : 'up'} />
              ) : null}
            </TableHeaderButton>
          </FrameNameCell>
        </FrameCallersTableHeader>
        <div
          ref={scrollContainerRef}
          style={scrollContainerStyles}
          onScroll={handleScroll}
        >
          <div style={containerStyles}>
            {items.map(r => {
              return (
                <FrameRow
                  key={r.key}
                  node={r.item}
                  style={r.styles}
                  referenceNode={referenceNode}
                  flamegraphRenderer={flamegraphRenderer}
                  handleExpandedClick={handleExpandTreeNode}
                />
              );
            })}
            {/*
              This is a ghost row, we stretch its width and height to fit the entire table
              so that borders on columns are shown across the entire table and not just the rows.
              This is useful when number of rows does not fill up the entire table height.
             */}
            <div
              style={{
                display: 'flex',
                width: '100%',
                pointerEvents: 'none',
                position: 'absolute',
                height: '100%',
              }}
            >
              <FrameCallersTableCell />
              <FrameCallersTableCell />
              <FrameCallersTableCell />
            </div>
          </div>
        </div>
      </FrameCallersTable>
    </FrameBar>
  );
}

const TableHeaderButton = styled('button')`
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  padding: 0 ${space(1)};
  border: none;
  background-color: ${props => props.theme.surface400};
  transition: background-color 100ms ease-in-out;

  &:hover {
    background-color: #edecee;
  }

  svg {
    width: 10px;
    height: 10px;
  }
`;

interface FrameRowProps {
  flamegraphRenderer: FlamegraphRenderer;
  handleExpandedClick: (
    node: VirtualizedTreeNode<FlamegraphFrame>,
    opts?: {expandChildren: boolean}
  ) => void;
  node: VirtualizedTreeNode<FlamegraphFrame>;
  referenceNode: FlamegraphFrame;
  style: React.CSSProperties;
}

function FrameRow({
  node,
  flamegraphRenderer,
  referenceNode,
  handleExpandedClick,
  style,
}: FrameRowProps) {
  const colorString = useMemo(() => {
    return formatColorForFrame(node.node, flamegraphRenderer);
  }, [node, flamegraphRenderer]);

  const handleExpanding = useCallback(
    (evt: React.MouseEvent) => {
      handleExpandedClick(node, {expandChildren: evt.metaKey});
    },
    [node, handleExpandedClick]
  );

  return (
    <FrameCallersRow style={style}>
      <FrameCallersTableCell textAlign="right">
        {flamegraphRenderer.flamegraph.formatter(node.node.node.selfWeight)}
        <Weight
          weight={computeRelativeWeight(
            referenceNode.node.totalWeight,
            node.node.node.selfWeight
          )}
        />
      </FrameCallersTableCell>
      <FrameCallersTableCell noPadding textAlign="right">
        <FrameWeightTypeContainer>
          <FrameWeightContainer>
            {flamegraphRenderer.flamegraph.formatter(node.node.node.totalWeight)}
            <Weight
              weight={computeRelativeWeight(
                referenceNode.node.totalWeight,
                node.node.node.totalWeight
              )}
            />
          </FrameWeightContainer>
          <FrameTypeIndicator>
            {node.node.node.frame.is_application ? (
              <IconUser size="xs" />
            ) : (
              <IconSettings size="xs" />
            )}
          </FrameTypeIndicator>
        </FrameWeightTypeContainer>
      </FrameCallersTableCell>
      <FrameCallersTableCell
        // We stretch this table to 100% width.
        style={{paddingLeft: node.depth * 14 + 8, width: '100%'}}
      >
        <FrameNameContainer>
          <FrameColorIndicator backgroundColor={colorString} />
          <FrameChildrenIndicator onClick={handleExpanding} open={node.expanded}>
            {node.node.children.length > 0 ? '\u203A' : null}
          </FrameChildrenIndicator>
          <FrameName>{node.node.frame.name}</FrameName>
        </FrameNameContainer>
      </FrameCallersTableCell>
    </FrameCallersRow>
  );
}

interface FrameStackProps {
  canvasPoolManager: CanvasPoolManager;
  flamegraphRenderer: FlamegraphRenderer;
}

const MIN_DRAWER_HEIGHT_PX = 30;

function FrameStack(props: FrameStackProps) {
  const theme = useFlamegraphTheme();
  const {selectedNode} = useFlamegraphProfilesValue();

  const [tab, setTab] = useState<'bottom up' | 'call order'>('call order');
  const [drawerHeight, setDrawerHeight] = useState(
    (theme.SIZES.FLAMEGRAPH_DEPTH_OFFSET + 2) * theme.SIZES.BAR_HEIGHT
  );

  const roots = useMemo(() => {
    if (!selectedNode) {
      return null;
    }

    if (tab === 'call order') {
      return [selectedNode];
    }

    return invertCallTree([selectedNode]);
  }, [selectedNode, tab]);

  const onMouseDown = useCallback((evt: React.MouseEvent<HTMLElement>) => {
    let startResizeVector = vec2.fromValues(evt.clientX, evt.clientY);
    let rafId: number | undefined;

    function handleMouseMove(mvEvent: MouseEvent) {
      if (rafId !== undefined) {
        window.cancelAnimationFrame(rafId);
        rafId = undefined;
      }

      window.requestAnimationFrame(() => {
        const currentPositionVector = vec2.fromValues(mvEvent.clientX, mvEvent.clientY);

        const distance = vec2.subtract(
          vec2.fromValues(0, 0),
          startResizeVector,
          currentPositionVector
        );

        startResizeVector = currentPositionVector;

        setDrawerHeight(h => Math.max(MIN_DRAWER_HEIGHT_PX, h + distance[1]));
        rafId = undefined;
      });
    }

    function handleMouseUp() {
      document.removeEventListener('mousemove', handleMouseMove);
    }

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);

      if (rafId !== undefined) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, []);

  return selectedNode ? (
    <FrameDrawer
      style={{
        height: drawerHeight,
      }}
    >
      <FrameTabs>
        <li className={tab === 'bottom up' ? 'active' : undefined}>
          <Button priority="link" size="zero" onClick={() => setTab('bottom up')}>
            {t('Bottom Up')}
          </Button>
        </li>
        <li
          onClick={() => setTab('call order')}
          className={tab === 'call order' ? 'active' : undefined}
        >
          <Button priority="link" size="zero">
            {t('Call Order')}
          </Button>
        </li>
        <li style={{flex: '1 1 100%', cursor: 'ns-resize'}} onMouseDown={onMouseDown} />
      </FrameTabs>
      <FrameCallTreeStack {...props} roots={roots ?? []} referenceNode={selectedNode} />
    </FrameDrawer>
  ) : null;
}

const FrameDrawer = styled('div')`
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
`;

const FrameWeightTypeContainer = styled('div')`
  display: flex;
  align-items: center;
  justify-content: flex-end;
`;

const FrameTabs = styled('ul')`
  display: flex;
  list-style-type: none;
  padding: 0 0 0 ${space(1)};
  margin: 0;
  border-top: 1px solid ${prop => prop.theme.border};
  background-color: ${props => props.theme.surface400};
  user-select: none;

  > li {
    font-size: ${p => p.theme.fontSizeSmall};
    font-weight: bold;
    margin-right: ${space(1)};

    button {
      border: none;
      border-top: 2px solid transparent;
      border-bottom: 2px solid transparent;
      border-radius: 0;
      margin: 0;
      padding: ${space(0.5)} 0;
      color: ${p => p.theme.textColor};

      &:hover {
        color: ${p => p.theme.textColor};
      }
    }

    &.active button {
      border-bottom: 2px solid ${prop => prop.theme.active};
    }
  }
`;

const Weight = styled((props: {weight: number}) => {
  const {weight, ...rest} = props;
  return (
    <div {...rest}>
      {weight.toFixed(1)}%
      <BackgroundWeightBar style={{transform: `scaleX(${weight / 100})`}} />
    </div>
  );
})`
  display: inline-block;
  min-width: 6ch;
  color: ${props => props.theme.subText};
`;

const FrameTypeIndicator = styled('div')`
  flex-shrink: 0;
  width: 26px;
  height: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${p => p.theme.subText};
`;

const FrameWeightContainer = styled('div')`
  display: flex;
  align-items: center;
  position: relative;
  justify-content: flex-end;
  flex: 1 1 100%;
`;

const BackgroundWeightBar = styled('div')`
  pointer-events: none;
  position: absolute;
  right: 0;
  top: 0;
  background-color: ${props => props.theme.yellow100};
  border-bottom: 1px solid ${props => props.theme.yellow200};
  transform-origin: center right;
  height: 100%;
  width: 100%;
`;

const FrameBar = styled('div')`
  overflow: auto;
  width: 100%;
  position: relative;
  background-color: ${p => p.theme.surface100};
  border-top: 1px solid ${p => p.theme.border};
  flex: 1 1 100%;
`;

const FrameCallersTable = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  margin: 0;
  overflow: auto;
  max-height: 100%;
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
`;

const FrameCallersRow = styled('div')`
  display: flex;
  width: 100%;

  &:hover {
    background-color: ${p => p.theme.surface400};
  }
`;

const FrameNameContainer = styled('div')`
  display: flex;
  align-items: center;
`;

const FrameChildrenIndicator = styled('button')<{open: boolean}>`
  width: 1ch;
  height: 1ch;
  display: flex;
  padding: 0;
  border: none;
  background-color: transparent;
  align-items: center;
  justify-content: center;
  user-select: none;
  transform: ${p => (p.open ? 'rotate(90deg)' : 'rotate(0deg)')};
`;

const FRAME_WEIGHT_CELL_WIDTH_PX = 164;

const FrameWeightCell = styled('div')`
  width: ${FRAME_WEIGHT_CELL_WIDTH_PX}px;
`;

const FrameNameCell = styled('div')`
  flex: 1 1 100%;
`;

const FrameCallersTableHeader = styled('div')`
  top: 0;
  position: sticky;
  z-index: 1;
  display: flex;
  flex: 1;

  > div {
    position: relative;
    border-bottom: 1px solid ${p => p.theme.border};
    background-color: ${p => p.theme.surface400};
    white-space: nowrap;

    &:last-child {
      flex: 1;
    }

    &:not(:last-child) {
      border-right: 1px solid ${p => p.theme.border};
    }
  }
`;

const FrameCallersTableCell = styled('div')<{
  noPadding?: boolean;
  textAlign?: React.CSSProperties['textAlign'];
}>`
  width: ${FRAME_WEIGHT_CELL_WIDTH_PX}px;
  position: relative;
  white-space: nowrap;
  flex-shrink: 0;
  padding: 0 ${p => (p.noPadding ? 0 : space(1))} 0 0;
  text-align: ${p => p.textAlign ?? 'initial'};

  &:not(:last-child) {
    border-right: 1px solid ${p => p.theme.border};
  }
`;

const FrameName = styled('span')`
  margin-left: ${space(0.5)};
`;

const FrameColorIndicator = styled('div')<{
  backgroundColor: React.CSSProperties['backgroundColor'];
}>`
  width: 12px;
  height: 12px;
  border-radius: 2px;
  display: inline-block;
  flex-shrink: 0;
  background-color: ${p => p.backgroundColor};
  margin-right: ${space(1)};
`;

export {FrameStack};
