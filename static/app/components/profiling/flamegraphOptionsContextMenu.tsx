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
];
const FLAMEGRAPH_VIEW_OPTIONS: FlamegraphViewOptions = ['top down', 'bottom up'];
const FLAMEGRAPH_SORTING_OPTIONS: FlamegraphSorting = ['left heavy', 'call order'];
const FLAMEGRAPH_AXIS_OPTIONS: FlamegraphAxisOptions = ['standalone', 'transaction'];

interface FlameGraphOptionsContextMenuProps {
  contextMenu: ReturnType<typeof useContextMenu>;
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
          <ProfilingContextMenuHeading>{t('Color Coding')}</ProfilingContextMenuHeading>
          {FLAMEGRAPH_COLOR_CODINGS.map((coding, idx) => (
            <ProfilingContextMenuItemCheckbox
              key={idx}
              {...props.contextMenu.getMenuItemProps()}
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
              {...props.contextMenu.getMenuItemProps()}
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
              {...props.contextMenu.getMenuItemProps()}
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
              {...props.contextMenu.getMenuItemProps()}
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
