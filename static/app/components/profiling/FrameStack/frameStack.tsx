import {useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {CanvasPoolManager} from 'sentry/utils/profiling/canvasScheduler';
import {useFlamegraphProfilesValue} from 'sentry/utils/profiling/flamegraph/useFlamegraphProfiles';
import {useFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';
import {useVerticallyResizableDrawer} from 'sentry/utils/profiling/hooks/useResizableDrawer';
import {invertCallTree} from 'sentry/utils/profiling/profile/utils';
import {FlamegraphRenderer} from 'sentry/utils/profiling/renderers/flamegraphRenderer';

import {FrameStackTable} from './frameStackTable';

interface FrameStackProps {
  canvasPoolManager: CanvasPoolManager;
  flamegraphRenderer: FlamegraphRenderer;
}

function FrameStack(props: FrameStackProps) {
  const theme = useFlamegraphTheme();
  const {selectedNode} = useFlamegraphProfilesValue();

  const [tab, setTab] = useState<'bottom up' | 'call order'>('call order');
  const [recursion, setRecursion] = useState<'collapsed' | null>(null);

  const roots = useMemo(() => {
    if (!selectedNode) {
      return null;
    }

    if (tab === 'call order') {
      return [selectedNode];
    }

    return invertCallTree([selectedNode]);
  }, [selectedNode, tab]);

  const handleRecursionChange = useCallback(
    (evt: React.ChangeEvent<HTMLInputElement>) => {
      setRecursion(evt.currentTarget.checked ? 'collapsed' : null);
    },
    []
  );

  const {height, onMouseDown} = useVerticallyResizableDrawer({
    initialHeight: (theme.SIZES.FLAMEGRAPH_DEPTH_OFFSET + 2) * theme.SIZES.BAR_HEIGHT,
    minHeight: 30,
  });

  return selectedNode ? (
    <FrameDrawer
      style={{
        height,
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
        <li>
          <FrameDrawerLabel>
            <input type="checkbox" onChange={handleRecursionChange} />
            Collapse recursion
          </FrameDrawerLabel>
        </li>
        <li style={{flex: '1 1 100%', cursor: 'ns-resize'}} onMouseDown={onMouseDown} />
      </FrameTabs>
      <FrameStackTable
        {...props}
        recursion={recursion}
        roots={roots ?? []}
        referenceNode={selectedNode}
        canvasPoolManager={props.canvasPoolManager}
      />
    </FrameDrawer>
  ) : null;
}

const FrameDrawerLabel = styled('label')`
  display: flex;
  align-items: center;
  white-space: nowrap;
  margin-bottom: 0;
  height: 100%;

  > input {
    margin: 0 ${space(0.5)} 0 0;
  }
`;

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
