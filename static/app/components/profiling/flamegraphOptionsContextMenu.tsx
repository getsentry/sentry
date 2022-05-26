import {Fragment, useEffect, useState} from 'react';

import {t} from 'sentry/locale';
import {
  FlamegraphAxisOptions,
  FlamegraphColorCodings,
  FlamegraphSorting,
  FlamegraphViewOptions,
} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/flamegraphPreferences';
import {useFlamegraphPreferences} from 'sentry/utils/profiling/flamegraph/useFlamegraphPreferences';
import {Rect} from 'sentry/utils/profiling/gl/utils';
import {
  computeBestContextMenuPosition,
  useContextMenu,
} from 'sentry/utils/profiling/hooks/useContextMenu';

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
  container: HTMLElement | null;
  contextMenuCoordinates: Rect | null;
  contextMenuProps: ReturnType<typeof useContextMenu>;
}

export function FlamegraphOptionsContextMenu(props: FlameGraphOptionsContextMenuProps) {
  const [containerCoordinates, setContainerCoordinates] = useState<Rect | null>(null);
  const [menuCoordinates, setMenuCoordinates] = useState<Rect | null>(null);
  const {open, setOpen, menuRef, getMenuProps, getMenuItemProps} = props.contextMenuProps;

  const [preferences, dispatch] = useFlamegraphPreferences();

  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      // Do nothing if clicking ref's element or descendent elements
      if (!menuRef || menuRef.contains(event.target as Node)) {
        return;
      }

      setOpen(false);
    };

    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [menuRef, setOpen]);

  // Observe the menu
  useEffect(() => {
    if (!menuRef) {
      return undefined;
    }

    const resizeObserver = new window.ResizeObserver(entries => {
      const contentRect = entries[0].contentRect;
      setMenuCoordinates(new Rect(0, 0, contentRect.width, contentRect.height));
    });

    resizeObserver.observe(menuRef);

    return () => {
      resizeObserver.disconnect();
    };
  }, [menuRef]);

  // Observe the container
  useEffect(() => {
    if (!props.container) {
      return undefined;
    }

    const resizeObserver = new window.ResizeObserver(entries => {
      const contentRect = entries[0].contentRect;
      setContainerCoordinates(new Rect(0, 0, contentRect.width, contentRect.height));
    });

    resizeObserver.observe(props.container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [props.container]);

  const position =
    props.contextMenuCoordinates && containerCoordinates && menuCoordinates
      ? computeBestContextMenuPosition(
          props.contextMenuCoordinates,
          containerCoordinates,
          menuCoordinates
        )
      : null;

  return (
    <Fragment>
      {open ? (
        <ProfilingContextMenuLayer
          onClick={() => {
            setOpen(false);
          }}
        />
      ) : null}
      {props.contextMenuCoordinates ? (
        <ProfilingContextMenu
          {...getMenuProps()}
          style={{
            position: 'absolute',
            visibility: open ? 'initial' : 'hidden',
            left: position?.left ?? -9999,
            top: position?.top ?? -9999,
            pointerEvents: open ? 'initial' : 'none',
            maxHeight: containerCoordinates?.height ?? 'auto',
          }}
        >
          <ProfilingContextMenuGroup>
            <ProfilingContextMenuHeading>{t('Color Coding')}</ProfilingContextMenuHeading>
            {FLAMEGRAPH_COLOR_CODINGS.map((coding, idx) => (
              <ProfilingContextMenuItemCheckbox
                key={idx}
                {...getMenuItemProps()}
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
                {...getMenuItemProps()}
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
                {...getMenuItemProps()}
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
                {...getMenuItemProps()}
                onClick={() => dispatch({type: 'set xAxis', payload: axis})}
                checked={preferences.xAxis === axis}
              >
                {axis}
              </ProfilingContextMenuItemCheckbox>
            ))}
          </ProfilingContextMenuGroup>
        </ProfilingContextMenu>
      ) : null}
    </Fragment>
  );
}
