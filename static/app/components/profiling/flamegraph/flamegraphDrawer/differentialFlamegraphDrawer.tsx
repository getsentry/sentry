import type {MouseEventHandler} from 'react';
import {memo, useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {Checkbox} from 'sentry/components/core/checkbox';
import {ExportProfileButton} from 'sentry/components/profiling/exportProfileButton';
import {IconPanel} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {
  CanvasPoolManager,
  CanvasScheduler,
} from 'sentry/utils/profiling/canvasScheduler';
import {filterFlamegraphTree} from 'sentry/utils/profiling/filterFlamegraphTree';
import type {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import type {FlamegraphPreferences} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/reducers/flamegraphPreferences';
import {useFlamegraphPreferences} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphPreferences';
import {useDispatchFlamegraphState} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphState';
import type {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import type {ProfileGroup} from 'sentry/utils/profiling/profile/importProfile';
import {invertCallTree} from 'sentry/utils/profiling/profile/utils';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';

import {FlamegraphTreeTable} from './flamegraphTreeTable';

interface DifferentialFlamegraphDrawerProps {
  canvasPoolManager: CanvasPoolManager;
  canvasScheduler: CanvasScheduler;
  flamegraph: Flamegraph;
  formatDuration: Flamegraph['formatter'];
  getFrameColor: (frame: FlamegraphFrame) => string;
  profileGroup: ProfileGroup;
  referenceNode: FlamegraphFrame;
  rootNodes: FlamegraphFrame[];
  onResize?: MouseEventHandler<HTMLElement>;
  onResizeReset?: MouseEventHandler<HTMLElement>;
}

const DifferentialFlamegraphDrawer = memo(function FlamegraphDrawer(
  props: DifferentialFlamegraphDrawerProps
) {
  const params = useParams();
  const orgSlug = useOrganization().slug;
  const flamegraphPreferences = useFlamegraphPreferences();
  const dispatch = useDispatchFlamegraphState();

  const [tab, setTab] = useLocalStorageState<'bottom up' | 'top down'>(
    'profiling-drawer-view',
    'bottom up'
  );
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

    if (tab === 'top down') {
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
  }, [setTab]);

  const onTopDownClick = useCallback(() => {
    setTab('top down');
  }, [setTab]);

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
    dispatch({type: 'set layout', payload: 'table left'});
  }, [dispatch]);

  const onTableBottomClick = useCallback(() => {
    dispatch({type: 'set layout', payload: 'table bottom'});
  }, [dispatch]);

  const onTableRightClick = useCallback(() => {
    dispatch({type: 'set layout', payload: 'table right'});
  }, [dispatch]);

  return (
    <FrameDrawer layout={flamegraphPreferences.layout}>
      <ProfilingDetailsFrameTabs>
        <ProfilingDetailsListItem className={tab === 'bottom up' ? 'active' : undefined}>
          <Button
            data-title={t('Bottom Up')}
            priority="link"
            size="zero"
            onClick={onBottomUpClick}
          >
            {t('Bottom Up')}
          </Button>
        </ProfilingDetailsListItem>
        <ProfilingDetailsListItem
          margin="none"
          className={tab === 'top down' ? 'active' : undefined}
        >
          <Button
            data-title={t('Top Down')}
            priority="link"
            size="zero"
            onClick={onTopDownClick}
          >
            {t('Top Down')}
          </Button>
        </ProfilingDetailsListItem>
        <Separator />
        <ProfilingDetailsListItem className={treeType === 'all' ? 'active' : undefined}>
          <Button
            data-title={t('All Frames')}
            priority="link"
            size="zero"
            onClick={onAllApplicationsClick}
          >
            {t('All Frames')}
          </Button>
        </ProfilingDetailsListItem>
        <ProfilingDetailsListItem
          className={treeType === 'application' ? 'active' : undefined}
        >
          <Button
            data-title={t('Application Frames')}
            priority="link"
            size="zero"
            onClick={onApplicationsClick}
          >
            {t('Application Frames')}
          </Button>
        </ProfilingDetailsListItem>
        <ProfilingDetailsListItem
          margin="none"
          className={treeType === 'system' ? 'active' : undefined}
        >
          <Button
            data-title={t('System Frames')}
            priority="link"
            size="zero"
            onClick={onSystemsClick}
          >
            {t('System Frames')}
          </Button>
        </ProfilingDetailsListItem>
        <Separator />
        <ProfilingDetailsListItem>
          <FrameDrawerLabel>
            <Checkbox
              size="xs"
              checked={recursion === 'collapsed'}
              onChange={handleRecursionChange}
            />
            {t('Collapse recursion')}
          </FrameDrawerLabel>
        </ProfilingDetailsListItem>
        <ProfilingDetailsListItem
          style={{
            flex: '1 1 100%',
            cursor:
              flamegraphPreferences.layout === 'table bottom' ? 'ns-resize' : undefined,
          }}
          onMouseDown={
            flamegraphPreferences.layout === 'table bottom' ? props.onResize : undefined
          }
          onDoubleClick={
            flamegraphPreferences.layout === 'table bottom'
              ? props.onResizeReset
              : undefined
          }
        />
        <ProfilingDetailsListItem margin="none">
          <ExportProfileButton
            variant="xs"
            eventId={params.eventId}
            projectId={params.projectId}
            orgId={orgSlug}
            disabled={params.eventId === undefined || params.projectId === undefined}
          />
        </ProfilingDetailsListItem>
        <Separator />
        <ProfilingDetailsListItem>
          <LayoutSelectionContainer>
            <StyledButton
              active={flamegraphPreferences.layout === 'table left'}
              onClick={onTableLeftClick}
              size="xs"
              title={t('Table left')}
            >
              <IconPanel size="xs" direction="left" />
            </StyledButton>
            <StyledButton
              active={flamegraphPreferences.layout === 'table bottom'}
              onClick={onTableBottomClick}
              size="xs"
              title={t('Table bottom')}
            >
              <IconPanel size="xs" direction="down" />
            </StyledButton>
            <StyledButton
              active={flamegraphPreferences.layout === 'table right'}
              onClick={onTableRightClick}
              size="xs"
              title={t('Table right')}
            >
              <IconPanel size="xs" direction="right" />
            </StyledButton>
          </LayoutSelectionContainer>
        </ProfilingDetailsListItem>
      </ProfilingDetailsFrameTabs>

      <FlamegraphTreeTable
        {...props}
        expanded={tab === 'top down'}
        onTopDownClick={onTopDownClick}
        onBottomUpClick={onBottomUpClick}
        recursion={recursion}
        flamegraph={props.flamegraph}
        referenceNode={props.referenceNode}
        tree={maybeFilteredOrInvertedTree ?? []}
        canvasScheduler={props.canvasScheduler}
        canvasPoolManager={props.canvasPoolManager}
      />

      {flamegraphPreferences.layout === 'table left' ||
      flamegraphPreferences.layout === 'table right' ? (
        <ResizableVerticalDrawer>
          {/* The border should be 1px, but we want the actual handler to be wider
          to improve the user experience and not have users have to click on the exact pixel */}
          <InvisibleHandler
            onMouseDown={props.onResize}
            onDoubleClick={props.onResizeReset}
          />
        </ResizableVerticalDrawer>
      ) : null}
    </FrameDrawer>
  );
});

const ResizableVerticalDrawer = styled('div')`
  width: 1px;
  grid-area: drawer;
  background-color: ${p => p.theme.border};
  position: relative;
`;

const InvisibleHandler = styled('div')`
  opacity: 0;
  width: ${space(1)};
  position: absolute;
  inset: 0;
  cursor: ew-resize;
  transform: translateX(-50%);
  background-color: transparent;
`;

const FrameDrawerLabel = styled('label')`
  display: flex;
  align-items: center;
  white-space: nowrap;
  margin-bottom: 0;
  height: 100%;
  font-weight: ${p => p.theme.fontWeightNormal};
  gap: ${space(0.5)};
`;

// Linter produces a false positive for the grid layout. I did not manage to find out
// how to "fix it" or why it is not working, I imagine it could be due to the ternary?
const FrameDrawer = styled('div')<{layout: FlamegraphPreferences['layout']}>`
  display: grid;
  grid-template-rows: auto 1fr;
  grid-template-columns: ${({layout}) =>
    layout === 'table left' ? '1fr auto' : layout === 'table right' ? 'auto 1fr' : '1fr'};
  /* false positive for grid layout */
  /* stylelint-disable */
  grid-template-areas: ${({layout}) =>
    layout === 'table bottom'
      ? `
    'tabs tabs'
    'table details'
    'drawer drawer'
    `
      : layout === 'table left'
        ? `
      'tabs tabs drawer'
      'table table drawer'
      'details details drawer';
      `
        : `
      'drawer tabs tabs'
      'drawer table table'
      'drawer details details';
      `};
`;
const Separator = styled('li')`
  width: 1px;
  height: 66%;
  margin: 0 ${space(1)};
  background: 1px solid ${p => p.theme.border};
  transform: translateY(29%);
`;

export const ProfilingDetailsFrameTabs = styled('ul')`
  display: flex;
  list-style-type: none;
  padding: 0 ${space(1)};
  margin: 0;
  border-top: 1px solid ${prop => prop.theme.border};
  background-color: ${props => props.theme.surface200};
  user-select: none;
  grid-area: tabs;
`;

export const ProfilingDetailsListItem = styled('li')<{
  margin?: 'none';
  size?: 'sm';
}>`
  font-size: ${p => p.theme.fontSizeSmall};
  margin-right: ${p => (p.margin === 'none' ? 0 : space(1))};

  button {
    border: none;
    border-top: 2px solid transparent;
    border-bottom: 2px solid transparent;
    border-radius: 0;
    margin: 0;
    padding: ${p => (p.size === 'sm' ? space(0.25) : space(0.5))} 0;
    color: ${p => p.theme.textColor};
    max-height: ${p => (p.size === 'sm' ? '24px' : 'auto')};

    &::after {
      display: block;
      content: attr(data-title);
      font-weight: ${p => p.theme.fontWeightBold};
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
    font-weight: ${p => p.theme.fontWeightBold};
    border-bottom: 2px solid ${prop => prop.theme.active};
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

export {DifferentialFlamegraphDrawer};
