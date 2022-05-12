import {Fragment, useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {CanvasPoolManager} from 'sentry/utils/profiling/canvasScheduler';
import {useFlamegraphProfilesValue} from 'sentry/utils/profiling/flamegraph/useFlamegraphProfiles';
import {useFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';
import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {FlamegraphRenderer} from 'sentry/utils/profiling/renderers/flamegraphRenderer';

interface FrameCallTreeStackProps {
  flamegraphRenderer: FlamegraphRenderer;
  roots: FlamegraphFrame[];
}

function FrameCallTreeStack({flamegraphRenderer, roots}: FrameCallTreeStackProps) {
  return (
    <FrameBar>
      <FrameCallersTable>
        <FrameCallersTableHeader>
          <tr>
            <th>Self Time</th>
            <th>Total Time</th>
            <th colSpan={100}>Frame</th>
          </tr>
        </FrameCallersTableHeader>
        <tbody>
          {roots.map(r => {
            return (
              <FrameRow
                key={r.key}
                depth={0}
                frame={r}
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
              key={c.key}
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

interface FrameStackProps {
  canvasPoolManager: CanvasPoolManager;
  flamegraphRenderer: FlamegraphRenderer;
}

function FrameStack(props: FrameStackProps) {
  const [tab, setTab] = useState<'bottom up' | 'call order'>('call order');
  const theme = useFlamegraphTheme();
  const {selectedNode} = useFlamegraphProfilesValue();

  const selectedNodeRoots = useMemo(() => {
    return selectedNode ? [selectedNode] : [];
  }, [selectedNode]);

  return selectedNode ? (
    <FrameDrawer
      style={{
        height: (theme.SIZES.FLAMEGRAPH_DEPTH_OFFSET + 2) * theme.SIZES.BAR_HEIGHT,
      }}
    >
      <FrameTabs>
        {/* <li className={tab === 'bottom up' ? 'active' : undefined}>
          <Button priority="link" size="zero" onClick={() => setTab('bottom up')}>
            {t('Bottom Up')}
          </Button>
        </li> */}
        <li
          onClick={() => setTab('call order')}
          className={tab === 'call order' ? 'active' : undefined}
        >
          <Button priority="link" size="zero">
            {t('Call Order')}
          </Button>
        </li>
      </FrameTabs>

      {tab === 'call order' ? (
        <FrameCallTreeStack {...props} roots={selectedNodeRoots} />
      ) : (
        <FrameCallTreeStack {...props} roots={selectedNodeRoots} />
      )}
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
