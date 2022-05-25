import {Fragment, useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {vec2} from 'gl-matrix';

import Button from 'sentry/components/button';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {CanvasPoolManager} from 'sentry/utils/profiling/canvasScheduler';
import {useFlamegraphProfilesValue} from 'sentry/utils/profiling/flamegraph/useFlamegraphProfiles';
import {useFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';
import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {formatColorForFrame} from 'sentry/utils/profiling/gl/utils';
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
      ? (a: FlamegraphFrame, b: FlamegraphFrame) => {
          return b.node.totalWeight - a.node.totalWeight;
        }
      : (a: FlamegraphFrame, b: FlamegraphFrame) => {
          return a.node.totalWeight - b.node.totalWeight;
        };
  }

  if (property === 'self weight') {
    return direction === 'desc'
      ? (a: FlamegraphFrame, b: FlamegraphFrame) => {
          return b.node.selfWeight - a.node.selfWeight;
        }
      : (a: FlamegraphFrame, b: FlamegraphFrame) => {
          return a.node.selfWeight - b.node.selfWeight;
        };
  }

  if (property === 'name') {
    return direction === 'desc'
      ? (a: FlamegraphFrame, b: FlamegraphFrame) => {
          return a.frame.name.localeCompare(b.frame.name);
        }
      : (a: FlamegraphFrame, b: FlamegraphFrame) => {
          return b.frame.name.localeCompare(a.frame.name);
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
  flamegraphRenderer,
  roots,
  referenceNode,
}: FrameCallTreeStackProps) {
  const [sort, setSort] = useState<'total weight' | 'self weight' | 'name'>(
    'total weight'
  );
  const [direction, setDirection] = useState<'asc' | 'desc'>('desc');

  const sortFunction: FrameRowProps['sortFunction'] = useMemo(() => {
    if (sort === null) {
      return () => 0;
    }
    return makeSortFunction(sort, direction);
  }, [sort, direction]);

  const onSortChange = useCallback(
    (newSort: 'total weight' | 'self weight' | 'name') => {
      // If sort is the same, just invert the direction
      if (newSort === sort) {
        setDirection(direction === 'asc' ? 'desc' : 'asc');
        return;
      }

      // Else set the new sort and default to descending order
      setSort(newSort);
      setDirection('desc');
    },
    [sort, direction]
  );

  return (
    <FrameBar>
      <FrameCallersTable>
        <FrameCallersTableHeader>
          <tr>
            <th>
              <TableHeaderButton onClick={() => onSortChange('self weight')}>
                {t('Self Time ')}
                {sort === 'self weight' ? (
                  <IconArrow direction={direction === 'desc' ? 'down' : 'up'} />
                ) : null}
              </TableHeaderButton>
            </th>
            <th>
              <TableHeaderButton onClick={() => onSortChange('total weight')}>
                {t('Total Time')}{' '}
                {sort === 'total weight' ? (
                  <IconArrow direction={direction === 'desc' ? 'down' : 'up'} />
                ) : null}
              </TableHeaderButton>
            </th>
            <th colSpan={100}>
              <TableHeaderButton onClick={() => onSortChange('name')}>
                {t('Frame')}{' '}
                {sort === 'name' ? (
                  <IconArrow direction={direction === 'desc' ? 'down' : 'up'} />
                ) : null}
              </TableHeaderButton>
            </th>
          </tr>
        </FrameCallersTableHeader>
        <tbody>
          {roots.sort(sortFunction).map(r => {
            return (
              <FrameRow
                key={r.key}
                depth={0}
                frame={r}
                sortFunction={sortFunction}
                referenceNode={referenceNode}
                flamegraphRenderer={flamegraphRenderer}
              />
            );
          })}
          {/* We add a row at the end with rowSpan so that we can have that nice border-right stretched over the entire table */}
          <tr>
            <FrameCallersTableCell rowSpan={100} />
            <FrameCallersTableCell rowSpan={100} />
            <FrameCallersTableCell rowSpan={100} />
          </tr>
        </tbody>
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
  depth: number;
  flamegraphRenderer: FlamegraphRenderer;
  frame: FlamegraphFrame;
  referenceNode: FlamegraphFrame;
  sortFunction: (a: FlamegraphFrame, b: FlamegraphFrame) => number;
  initialOpen?: boolean;
}

function FrameRow({
  depth,
  frame,
  flamegraphRenderer,
  referenceNode,
  sortFunction,
  initialOpen,
}: FrameRowProps) {
  const [open, setOpen] = useState<boolean>(initialOpen ?? false);
  const [forceOpenChildren, setForceOpenChildren] = useState<boolean>(
    initialOpen ?? false
  );

  const handleClick = useCallback(
    (evt: React.MouseEvent<HTMLTableRowElement>) => {
      if (evt.metaKey) {
        setForceOpenChildren(!forceOpenChildren);
      } else {
        // Once a user closes the row, we don't want to reopen it on subsequent clicks
        setForceOpenChildren(false);
      }
      setOpen(!open);
    },
    [open, forceOpenChildren]
  );

  const colorString = useMemo(() => {
    return formatColorForFrame(frame, flamegraphRenderer);
  }, [frame, flamegraphRenderer]);

  return (
    <Fragment>
      <FrameCallersRow onClick={handleClick}>
        <FrameCallersTableCell textAlign="right">
          {flamegraphRenderer.flamegraph.formatter(frame.node.selfWeight)}
          <Weight
            weight={computeRelativeWeight(
              referenceNode.node.selfWeight,
              frame.node.selfWeight
            )}
          />
        </FrameCallersTableCell>
        <FrameCallersTableCell textAlign="right">
          {flamegraphRenderer.flamegraph.formatter(frame.node.totalWeight)}
          <Weight
            weight={computeRelativeWeight(
              referenceNode.node.totalWeight,
              frame.node.totalWeight
            )}
          />
        </FrameCallersTableCell>
        <FrameCallersTableCell
          // We stretch this table to 100% width.
          style={{paddingLeft: depth * 14 + 8, width: '100%'}}
          colSpan={100}
        >
          <FrameNameContainer>
            <FrameColorIndicator backgroundColor={colorString} />
            <FrameChildrenIndicator open={open}>
              {frame.children.length > 0 ? '\u203A' : null}
            </FrameChildrenIndicator>
            <FrameName>{frame.frame.name}</FrameName>
          </FrameNameContainer>
        </FrameCallersTableCell>
      </FrameCallersRow>
      {open
        ? frame.children
            .sort(sortFunction)
            .map(c => (
              <FrameRow
                key={c.key}
                frame={c}
                referenceNode={referenceNode}
                initialOpen={forceOpenChildren ? open : undefined}
                flamegraphRenderer={flamegraphRenderer}
                sortFunction={sortFunction}
                depth={depth + 1}
              />
            ))
        : null}
    </Fragment>
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

const FrameTabs = styled('ul')`
  display: flex;
  list-style-type: none;
  padding: 0 ${space(1)};
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
      {weight.toFixed(2)}%
      <BackgroundWeightBar style={{transform: `scaleX(${weight / 100})`}} />
    </div>
  );
})`
  display: inline-block;
  min-width: 7ch;
  color: ${props => props.theme.subText};
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

const FrameCallersTable = styled('table')`
  border-collapse: separate;
  font-size: ${p => p.theme.fontSizeSmall};
  margin: 0;
  overflow: auto;
  max-height: 100%;
  height: 100%;
  width: 100%;

  tbody {
    height: 100%;
    overflow: auto;
  }
`;

const FrameCallersRow = styled('tr')`
  height: 1px;

  &:hover {
    background-color: ${p => p.theme.surface400};
  }
`;

const FrameNameContainer = styled('div')`
  display: flex;
  align-items: center;
`;

const FrameChildrenIndicator = styled('span')<{open: boolean}>`
  width: 1ch;
  height: 1ch;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  transform: ${p => (p.open ? 'rotate(90deg)' : 'rotate(0deg)')};
`;

const FrameCallersTableHeader = styled('thead')`
  top: 0;
  position: sticky;
  z-index: 1;

  th {
    position: relative;
    border-bottom: 1px solid ${p => p.theme.border};
    background-color: ${p => p.theme.surface400};
    white-space: nowrap;

    &:first-child,
    &:nth-child(2) {
      min-width: 140px;
    }

    &:not(:last-child) {
      border-right: 1px solid ${p => p.theme.border};
    }
  }
`;

const FrameCallersTableCell = styled('td')<{
  textAlign?: React.CSSProperties['textAlign'];
}>`
  position: relative;
  white-space: nowrap;
  padding: 0 ${space(1)};
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
  background-color: ${p => p.backgroundColor};
  margin-right: ${space(1)};
`;

export {FrameStack};
