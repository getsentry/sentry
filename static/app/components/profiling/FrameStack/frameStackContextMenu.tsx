import {Fragment} from 'react';

import {
  ProfilingContextMenu,
  ProfilingContextMenuGroup,
  ProfilingContextMenuHeading,
  ProfilingContextMenuItem,
  ProfilingContextMenuLayer,
} from 'sentry/components/profiling/ProfilingContextMenu/profilingContextMenu';
import {t} from 'sentry/locale';
import {useContextMenu} from 'sentry/utils/profiling/hooks/useContextMenu';

interface FrameStackContextMenuProps {
  contextMenu: ReturnType<typeof useContextMenu>;
  onZoomIntoFrameClick: (evt: React.MouseEvent<HTMLDivElement>) => void;
}

export function FrameStackContextMenu(props: FrameStackContextMenuProps) {
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
          <ProfilingContextMenuHeading>{t('Flamegraph')}</ProfilingContextMenuHeading>
          <ProfilingContextMenuItem
            {...props.contextMenu.getMenuItemProps()}
            onClick={props.onZoomIntoFrameClick}
          >
            {t('Show in flamegraph')}
          </ProfilingContextMenuItem>
        </ProfilingContextMenuGroup>
      </ProfilingContextMenu>
    </Fragment>
  ) : null;
}
