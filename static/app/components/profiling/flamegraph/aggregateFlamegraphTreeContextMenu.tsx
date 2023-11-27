import {Fragment, useCallback} from 'react';

import {
  ProfilingContextMenu,
  ProfilingContextMenuGroup,
  ProfilingContextMenuHeading,
  ProfilingContextMenuItem,
  ProfilingContextMenuLayer,
} from 'sentry/components/profiling/profilingContextMenu';
import {t} from 'sentry/locale';
import {useContextMenu} from 'sentry/utils/profiling/hooks/useContextMenu';

interface AggregateFlamegraphTreeContextMenuProps {
  contextMenu: ReturnType<typeof useContextMenu>;
  onBottomUpClick: (evt: React.MouseEvent<HTMLDivElement>) => void;
  onTopDownClick: (evt: React.MouseEvent<HTMLDivElement>) => void;
}

export function AggregateFlamegraphTreeContextMenu(
  props: AggregateFlamegraphTreeContextMenuProps
) {
  const closeContextMenu = useCallback(
    () => props.contextMenu.setOpen(false),
    [props.contextMenu]
  );

  return props.contextMenu.open ? (
    <Fragment>
      <ProfilingContextMenuLayer onClick={closeContextMenu} />
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
          <ProfilingContextMenuHeading>{t('View')}</ProfilingContextMenuHeading>
          <ProfilingContextMenuItem
            {...props.contextMenu.getMenuItemProps()}
            onClick={props.onBottomUpClick}
          >
            {t('Bottom Up')}
          </ProfilingContextMenuItem>
          <ProfilingContextMenuItem
            {...props.contextMenu.getMenuItemProps()}
            onClick={props.onTopDownClick}
          >
            {t('Top Down')}
          </ProfilingContextMenuItem>
        </ProfilingContextMenuGroup>
      </ProfilingContextMenu>
    </Fragment>
  ) : null;
}
