import {Fragment, useCallback, useState} from 'react';
import styled from '@emotion/styled';

import space from 'sentry/styles/space';
import {CanvasPoolManager} from 'sentry/utils/profiling/canvasScheduler';
import {useFlamegraphProfilesValue} from 'sentry/utils/profiling/flamegraph/useFlamegraphProfiles';
import {useFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';
import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {FlamegraphRenderer} from 'sentry/utils/profiling/renderers/flamegraphRenderer';

interface FrameStackProps {
  canvasPoolManager: CanvasPoolManager;
  flamegraphRenderer: FlamegraphRenderer;
}

function FrameStack({flamegraphRenderer}: FrameStackProps) {
  const theme = useFlamegraphTheme();
  const {selectedNode} = useFlamegraphProfilesValue();

  return selectedNode ? (
    <FrameBar
      style={{
        height: theme.SIZES.FLAMEGRAPH_DEPTH_OFFSET * theme.SIZES.BAR_HEIGHT,
      }}
    >
      <FrameCallersTable>
        <FrameCallersTableHeader>
          <tr>
            <th>Self Time</th>
            <th>Total Time</th>
            <th colSpan={100}>Frame</th>
          </tr>
        </FrameCallersTableHeader>
        <tbody>
          <FrameRow
            key={selectedNode?.frame?.key}
            depth={0}
            frame={selectedNode}
            flamegraphRenderer={flamegraphRenderer}
          />
          {/* We add a row at the end with rowSpan so that we can have that nice border-right stretched over the entire table */}
          <tr>
            <FrameCallersTableCell rowSpan={100} />
            <FrameCallersTableCell rowSpan={100} />
            <FrameCallersTableCell rowSpan={100} />
          </tr>
        </tbody>
      </FrameCallersTable>
    </FrameBar>
  ) : null;
}

function FrameRow({
  depth,
  frame,
  flamegraphRenderer,
  initialOpen,
}: {
  depth: number;
  flamegraphRenderer: FlamegraphRenderer;
  frame: FlamegraphFrame;
  initialOpen?: boolean;
}) {
  const [open, setOpen] = useState<boolean>(initialOpen ?? false);
  const [forceOpenChildren, setForceOpenChildren] = useState<boolean>(
    initialOpen ?? false
  );

  const color = flamegraphRenderer.getColorForFrame(frame);

  const colorString =
    color.length === 4
      ? `rgba(${color
          .slice(0, 3)
          .map(n => n * 255)
          .join(',')}, ${color[3]})`
      : `rgba(${color.map(n => n * 255).join(',')}, 1.0)`;

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

  return (
    <Fragment>
      <FrameCallersRow onClick={handleClick}>
        <FrameCallersTableCell textAlign="right">
          {flamegraphRenderer.flamegraph.formatter(frame.frame.selfWeight)}
        </FrameCallersTableCell>
        <FrameCallersTableCell textAlign="right">
          {flamegraphRenderer.flamegraph.formatter(frame.frame.totalWeight)}
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
        ? frame.children.map(c => (
            <FrameRow
              key={c.frame.key}
              initialOpen={forceOpenChildren ? open : undefined}
              frame={c}
              flamegraphRenderer={flamegraphRenderer}
              depth={depth + 1}
            />
          ))
        : null}
    </Fragment>
  );
}

const FrameBar = styled('div')`
  overflow: auto;
  width: 100%;
  position: relative;
  background-color: ${p => p.theme.surface100};
  border-top: 1px solid ${p => p.theme.border};
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
    background-color: ${p => p.theme.surface100};
    white-space: nowrap;
    padding: 0 ${space(1)};

    &:first-child,
    &:nth-child(2) {
      min-width: 100px;
    }

    &:not(:last-child) {
      border-right: 1px solid ${p => p.theme.border};
    }
  }
`;

const FrameCallersTableCell = styled('td')<{
  textAlign?: React.CSSProperties['textAlign'];
}>`
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
