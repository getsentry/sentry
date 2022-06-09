import {useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {vec2} from 'gl-matrix';

import Button from 'sentry/components/button';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {CanvasPoolManager} from 'sentry/utils/profiling/canvasScheduler';
import {filterFlamegraphTree} from 'sentry/utils/profiling/filterFlamegraphTree';
import {useFlamegraphProfilesValue} from 'sentry/utils/profiling/flamegraph/useFlamegraphProfiles';
import {useFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';
import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {invertCallTree} from 'sentry/utils/profiling/profile/utils';
import {FlamegraphRenderer} from 'sentry/utils/profiling/renderers/flamegraphRenderer';

import {FrameStackTable} from './frameStackTable';

interface FrameStackProps {
  canvasPoolManager: CanvasPoolManager;
  flamegraphRenderer: FlamegraphRenderer;
}

const MIN_DRAWER_HEIGHT_PX = 30;

function FrameStack(props: FrameStackProps) {
  const theme = useFlamegraphTheme();
  const {selectedNode} = useFlamegraphProfilesValue();

  const [tab, setTab] = useState<'bottom up' | 'call order'>('call order');
  const [treeType, setTreeType] = useState<'all' | 'application' | 'system'>('all');

  const [drawerHeight, setDrawerHeight] = useState(
    (theme.SIZES.FLAMEGRAPH_DEPTH_OFFSET + 2) * theme.SIZES.BAR_HEIGHT
  );

  const roots: FlamegraphFrame[] | null = useMemo(() => {
    if (!selectedNode) {
      return null;
    }

    const skipFunction =
      treeType === 'application'
        ? (f: FlamegraphFrame): boolean => !f.frame.is_application
        : treeType === 'system'
        ? (f: FlamegraphFrame): boolean => f.frame.is_application
        : () => false;

    const maybeFilteredRoots =
      treeType !== 'all'
        ? filterFlamegraphTree([selectedNode], skipFunction)
        : [selectedNode];

    if (tab === 'call order') {
      return maybeFilteredRoots;
    }

    return invertCallTree(maybeFilteredRoots);
  }, [selectedNode, tab, treeType]);

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
        <li className={tab === 'call order' ? 'active' : undefined}>
          <Button priority="link" size="zero" onClick={() => setTab('call order')}>
            {t('Call Order')}
          </Button>
        </li>
        <li className={treeType === 'all' ? 'active' : undefined}>
          <Button priority="link" size="zero" onClick={() => setTreeType('all')}>
            {t('All Frames')}
          </Button>
        </li>
        <li className={treeType === 'application' ? 'active' : undefined}>
          <Button priority="link" size="zero" onClick={() => setTreeType('application')}>
            {t('Application Frames')}
          </Button>
        </li>
        <li className={treeType === 'system' ? 'active' : undefined}>
          <Button priority="link" size="zero" onClick={() => setTreeType('system')}>
            {t('System Frames')}
          </Button>
        </li>
        <li style={{flex: '1 1 100%', cursor: 'ns-resize'}} onMouseDown={onMouseDown} />
      </FrameTabs>
      <FrameStackTable
        {...props}
        roots={roots ?? []}
        referenceNode={selectedNode}
        canvasPoolManager={props.canvasPoolManager}
      />
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

const FRAME_WEIGHT_CELL_WIDTH_PX = 164;
export const FrameCallersTableCell = styled('div')<{
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

export {FrameStack};
