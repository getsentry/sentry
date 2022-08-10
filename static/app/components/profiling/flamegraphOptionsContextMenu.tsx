import {Fragment} from 'react';

import {t} from 'sentry/locale';
import {
  FlamegraphAxisOptions,
  FlamegraphColorCodings,
  FlamegraphSorting,
  FlamegraphViewOptions,
} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/flamegraphPreferences';
import {useFlamegraphPreferences} from 'sentry/utils/profiling/flamegraph/useFlamegraphPreferences';
import {useContextMenu} from 'sentry/utils/profiling/hooks/useContextMenu';

import {
  ProfilingContextMenu,
  ProfilingContextMenuGroup,
  ProfilingContextMenuHeading,
  ProfilingContextMenuItemCheckbox,
  ProfilingContextMenuLayer,
} from './ProfilingContextMenu/profilingContextMenu';

const FLAMEGRAPH_COLOR_CODINGS: FlamegraphColorCodings = [
  'by symbol name',
  'by system / application',
  'by library',
  'by recursion',
  'by frequency',
];
const FLAMEGRAPH_VIEW_OPTIONS: FlamegraphViewOptions = ['top down', 'bottom up'];
const FLAMEGRAPH_SORTING_OPTIONS: FlamegraphSorting = ['left heavy', 'call order'];
const FLAMEGRAPH_AXIS_OPTIONS: FlamegraphAxisOptions = ['standalone', 'transaction'];

interface FlameGraphOptionsContextMenuProps {
  contextMenu: ReturnType<typeof useContextMenu>;
  isHighlightingAllOccurences: boolean;
  onHighlightAllOccurencesClick: () => void;
}

export function FlamegraphOptionsContextMenu(props: FlameGraphOptionsContextMenuProps) {
  const [preferences, dispatch] = useFlamegraphPreferences();

  return props.contextMenu.open ? (
    <Fragment>
      <ProfilingContextMenuLayer onClick={() => props.contextMenu.setOpen(false)} />
      <ProfilingContextMenu
        {...props.contextMenu.getMenuProps()}
        style={{
          position: 'absolute',
          left: props.contextMenu.position?.left ?? -9999,
          top: props.contextMenu.position?.top ?? -9999,
          maxHeight: props.contextMenu.containerCoordinates?.height ?? 'auto',
        }}
      >
        <ProfilingContextMenuGroup>
          <ProfilingContextMenuHeading>{t('Frame')}</ProfilingContextMenuHeading>
          <ProfilingContextMenuItemCheckbox
            {...props.contextMenu.getMenuItemProps({
              onClick: props.onHighlightAllOccurencesClick,
            })}
            onClick={e => {
              // We need to prevent the click from propagating to the context menu layer.
              e.preventDefault();
              props.onHighlightAllOccurencesClick();
            }}
            checked={props.isHighlightingAllOccurences}
          >
            {t('Highlight all occurrences')}
          </ProfilingContextMenuItemCheckbox>
        </ProfilingContextMenuGroup>
        <ProfilingContextMenuGroup>
          <ProfilingContextMenuHeading>{t('Color Coding')}</ProfilingContextMenuHeading>
          {FLAMEGRAPH_COLOR_CODINGS.map((coding, idx) => (
            <ProfilingContextMenuItemCheckbox
              key={idx}
              {...props.contextMenu.getMenuItemProps({
                onClick: () => dispatch({type: 'set color coding', payload: coding}),
              })}
              onClick={() => dispatch({type: 'set color coding', payload: coding})}
              checked={preferences.colorCoding === coding}
            >
              {coding}
            </ProfilingContextMenuItemCheckbox>
          ))}
        </ProfilingContextMenuGroup>
        <ProfilingContextMenuGroup>
          <ProfilingContextMenuHeading>{t('View')}</ProfilingContextMenuHeading>
          {FLAMEGRAPH_VIEW_OPTIONS.map((view, idx) => (
            <ProfilingContextMenuItemCheckbox
              key={idx}
              {...props.contextMenu.getMenuItemProps({
                onClick: () => dispatch({type: 'set view', payload: view}),
              })}
              onClick={() => dispatch({type: 'set view', payload: view})}
              checked={preferences.view === view}
            >
              {view}
            </ProfilingContextMenuItemCheckbox>
          ))}
        </ProfilingContextMenuGroup>
        <ProfilingContextMenuGroup>
          <ProfilingContextMenuHeading>{t('Sorting')}</ProfilingContextMenuHeading>
          {FLAMEGRAPH_SORTING_OPTIONS.map((sorting, idx) => (
            <ProfilingContextMenuItemCheckbox
              key={idx}
              {...props.contextMenu.getMenuItemProps({
                onClick: () => dispatch({type: 'set sorting', payload: sorting}),
              })}
              onClick={() => dispatch({type: 'set sorting', payload: sorting})}
              checked={preferences.sorting === sorting}
            >
              {sorting}
            </ProfilingContextMenuItemCheckbox>
          ))}
        </ProfilingContextMenuGroup>
        <ProfilingContextMenuGroup>
          <ProfilingContextMenuHeading>{t('X Axis')}</ProfilingContextMenuHeading>
          {FLAMEGRAPH_AXIS_OPTIONS.map((axis, idx) => (
            <ProfilingContextMenuItemCheckbox
              key={idx}
              {...props.contextMenu.getMenuItemProps({
                onClick: () => dispatch({type: 'set xAxis', payload: axis}),
              })}
              onClick={() => dispatch({type: 'set xAxis', payload: axis})}
              checked={preferences.xAxis === axis}
            >
              {axis}
            </ProfilingContextMenuItemCheckbox>
          ))}
        </ProfilingContextMenuGroup>
      </ProfilingContextMenu>
    </Fragment>
  ) : null;
}
