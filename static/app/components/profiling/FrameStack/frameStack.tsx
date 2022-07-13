import {memo, useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import {IconPanel} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {CanvasPoolManager} from 'sentry/utils/profiling/canvasScheduler';
import {filterFlamegraphTree} from 'sentry/utils/profiling/filterFlamegraphTree';
import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import {useFlamegraphPreferences} from 'sentry/utils/profiling/flamegraph/useFlamegraphPreferences';
import {useFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';
import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {useVerticallyResizableDrawer} from 'sentry/utils/profiling/hooks/useResizableDrawer';
import {invertCallTree} from 'sentry/utils/profiling/profile/utils';

import {FrameStackTable} from './frameStackTable';

interface FrameStackProps {
  canvasPoolManager: CanvasPoolManager;
  formatDuration: Flamegraph['formatter'];
  getFrameColor: (frame: FlamegraphFrame) => string;
  referenceNode: FlamegraphFrame;
  rootNodes: FlamegraphFrame[];
}

const FrameStack = memo(function FrameStack(props: FrameStackProps) {
  const theme = useFlamegraphTheme();
  const [flamegraphPreferences, dispatchFlamegraphPreferences] =
    useFlamegraphPreferences();

  const [tab, setTab] = useState<'bottom up' | 'call order'>('call order');
  const [treeType, setTreeType] = useState<'all' | 'application' | 'system'>('all');
  const [recursion, setRecursion] = useState<'collapsed' | null>(null);

  const maybeFilteredOrInvertedTree: FlamegraphFrame[] | null = useMemo(() => {
    const skipFunction: (f: FlamegraphFrame) => boolean =
      treeType === 'application'
        ? f => !f.frame.is_application
        : treeType === 'system'
        ? f => f.frame.is_application
        : () => false;

    const maybeFilteredRoots =
      treeType !== 'all'
        ? filterFlamegraphTree(props.rootNodes, skipFunction)
        : props.rootNodes;

    if (tab === 'call order') {
      return maybeFilteredRoots;
    }

    return invertCallTree(maybeFilteredRoots);
  }, [tab, treeType, props.rootNodes]);

  const handleRecursionChange = useCallback(
    (evt: React.ChangeEvent<HTMLInputElement>) => {
      setRecursion(evt.currentTarget.checked ? 'collapsed' : null);
    },
    []
  );

  const onBottomUpClick = useCallback(() => {
    setTab('bottom up');
  }, []);

  const onCallOrderClick = useCallback(() => {
    setTab('call order');
  }, []);

  const onAllApplicationsClick = useCallback(() => {
    setTreeType('all');
  }, []);

  const onApplicationsClick = useCallback(() => {
    setTreeType('application');
  }, []);

  const onSystemsClick = useCallback(() => {
    setTreeType('system');
  }, []);

  const onTableLeftClick = useCallback(() => {
    dispatchFlamegraphPreferences({type: 'set layout', payload: 'table_left'});
  }, [dispatchFlamegraphPreferences]);

  const onTableBottomClick = useCallback(() => {
    dispatchFlamegraphPreferences({type: 'set layout', payload: 'table_bottom'});
  }, [dispatchFlamegraphPreferences]);

  const onTableRightClick = useCallback(() => {
    dispatchFlamegraphPreferences({type: 'set layout', payload: 'table_right'});
  }, [dispatchFlamegraphPreferences]);

  const {height, onMouseDown} = useVerticallyResizableDrawer({
    initialHeight: (theme.SIZES.FLAMEGRAPH_DEPTH_OFFSET + 2) * theme.SIZES.BAR_HEIGHT,
    minHeight: 30,
  });

  return (
    <FrameDrawer
      style={{
        // If the table is not at the bottom, the height should not be managed
        height: flamegraphPreferences.layout === 'table_bottom' ? height : undefined,
      }}
    >
      <FrameTabs>
        <li className={tab === 'bottom up' ? 'active' : undefined}>
          <Button
            data-title={t('Bottom Up')}
            priority="link"
            size="zero"
            onClick={onBottomUpClick}
          >
            {t('Bottom Up')}
          </Button>
        </li>
        <li className={tab === 'call order' ? 'active' : undefined}>
          <Button
            data-title={t('Call Order')}
            priority="link"
            size="zero"
            onClick={onCallOrderClick}
          >
            {t('Call Order')}
          </Button>
        </li>
        <Separator />
        <li className={treeType === 'all' ? 'active' : undefined}>
          <Button
            data-title={t('All Frames')}
            priority="link"
            size="zero"
            onClick={onAllApplicationsClick}
          >
            {t('All Frames')}
          </Button>
        </li>
        <li className={treeType === 'application' ? 'active' : undefined}>
          <Button
            data-title={t('Application Frames')}
            priority="link"
            size="zero"
            onClick={onApplicationsClick}
          >
            {t('Application Frames')}
          </Button>
        </li>
        <li className={treeType === 'system' ? 'active' : undefined}>
          <Button
            data-title={t('System Frames')}
            priority="link"
            size="zero"
            onClick={onSystemsClick}
          >
            {t('System Frames')}
          </Button>
        </li>
        <Separator />
        <li>
          <FrameDrawerLabel>
            <input
              type="checkbox"
              checked={recursion === 'collapsed'}
              onChange={handleRecursionChange}
            />
            {t('Collapse recursion')}
          </FrameDrawerLabel>
        </li>
        <li
          style={{
            flex: '1 1 100%',
            cursor:
              flamegraphPreferences.layout === 'table_bottom' ? 'ns-resize' : undefined,
          }}
          onMouseDown={
            flamegraphPreferences.layout === 'table_bottom' ? onMouseDown : undefined
          }
        />
        <li>
          <LayoutSelectionContainer>
            <StyledButton
              active={flamegraphPreferences.layout === 'table_left'}
              onClick={onTableLeftClick}
              size="xs"
              title={t('Table left')}
            >
              <IconPanel size="xs" direction="right" />
            </StyledButton>
            <StyledButton
              active={flamegraphPreferences.layout === 'table_bottom'}
              onClick={onTableBottomClick}
              size="xs"
              title={t('Table bottom')}
            >
              <IconPanel size="xs" direction="down" />
            </StyledButton>
            <StyledButton
              active={flamegraphPreferences.layout === 'table_right'}
              onClick={onTableRightClick}
              size="xs"
              title={t('Table right')}
            >
              <IconPanel size="xs" direction="left" />
            </StyledButton>
          </LayoutSelectionContainer>
        </li>
      </FrameTabs>
      <FrameStackTable
        {...props}
        recursion={recursion}
        referenceNode={props.referenceNode}
        tree={maybeFilteredOrInvertedTree ?? []}
        canvasPoolManager={props.canvasPoolManager}
      />
    </FrameDrawer>
  );
});

const FrameDrawerLabel = styled('label')`
  display: flex;
  align-items: center;
  white-space: nowrap;
  margin-bottom: 0;
  height: 100%;
  font-weight: normal;

  > input {
    margin: 0 ${space(0.5)} 0 0;
  }
`;

const FrameDrawer = styled('div')`
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  height: 100%;
`;

const Separator = styled('li')`
  width: 1px;
  height: 66%;
  margin: 0 ${space(0.5)};
  background: ${p => p.theme.border};
  transform: translateY(29%);
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
    margin-right: ${space(1)};

    button {
      border: none;
      border-top: 2px solid transparent;
      border-bottom: 2px solid transparent;
      border-radius: 0;
      margin: 0;
      padding: ${space(0.5)} 0;
      color: ${p => p.theme.textColor};

      &::after {
        display: block;
        content: attr(data-title);
        font-weight: bold;
        height: 1px;
        color: transparent;
        overflow: hidden;
        visibility: hidden;
        white-space: nowrap;
      }

      &:hover {
        color: ${p => p.theme.textColor};
      }
    }

    &.active button {
      font-weight: bold;
      border-bottom: 2px solid ${prop => prop.theme.active};
    }
  }
`;

const StyledButton = styled(Button)<{active: boolean}>`
  border: none;
  background-color: transparent;
  box-shadow: none;
  transition: none !important;
  opacity: ${p => (p.active ? 0.7 : 0.5)};

  &:not(:last-child) {
    margin-right: ${space(1)};
  }

  &:hover {
    border: none;
    background-color: transparent;
    box-shadow: none;
    opacity: ${p => (p.active ? 0.6 : 0.5)};
  }
`;

const LayoutSelectionContainer = styled('div')`
  display: flex;
  align-items: center;
`;

const FRAME_WEIGHT_CELL_WIDTH_PX = 164;
export const FrameCallersTableCell = styled('div')<{
  isSelected?: boolean;
  noPadding?: boolean;
  textAlign?: React.CSSProperties['textAlign'];
}>`
  width: ${FRAME_WEIGHT_CELL_WIDTH_PX}px;
  position: relative;
  white-space: nowrap;
  flex-shrink: 0;
  padding: 0 ${p => (p.noPadding ? 0 : space(1))} 0 0;
  text-align: ${p => p.textAlign ?? 'initial'};

  &:first-child,
  &:nth-child(2) {
    position: sticky;
    z-index: 1;
    background-color: ${p => (p.isSelected ? p.theme.blue300 : p.theme.background)};
  }

  &:first-child {
    left: 0;
  }
  &:nth-child(2) {
    left: ${FRAME_WEIGHT_CELL_WIDTH_PX}px;
  }

  &:not(:last-child) {
    border-right: 1px solid ${p => p.theme.border};
  }
`;

export {FrameStack};
