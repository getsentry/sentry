import {Fragment} from 'react';

import {
  ProfilingContextMenu,
  ProfilingContextMenuGroup,
  ProfilingContextMenuHeading,
  ProfilingContextMenuItem,
  ProfilingContextMenuLayer,
} from 'sentry/components/profiling/profilingContextMenu';
import {t} from 'sentry/locale';
import {useContextMenu} from 'sentry/utils/profiling/hooks/useContextMenu';

interface FlamegraphTreeContextMenuProps {
  contextMenu: ReturnType<typeof useContextMenu>;
  onHighlightAllFramesClick: (evt: React.MouseEvent<HTMLDivElement>) => void;
  onZoomIntoFrameClick: (evt: React.MouseEvent<HTMLDivElement>) => void;
}

export function FlamegraphTreeContextMenu(props: FlamegraphTreeContextMenuProps) {
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
          <ProfilingContextMenuHeading>{t('Actions')}</ProfilingContextMenuHeading>
          <ProfilingContextMenuItem
            {...props.contextMenu.getMenuItemProps()}
            onClick={props.onZoomIntoFrameClick}
          >
            {t('Show on flamechart')}
          </ProfilingContextMenuItem>
          <ProfilingContextMenuItem
            {...props.contextMenu.getMenuItemProps()}
            onClick={props.onHighlightAllFramesClick}
          >
            {t('Highlight all occurrences')}
          </ProfilingContextMenuItem>
        </ProfilingContextMenuGroup>
      </ProfilingContextMenu>
    </Fragment>
  ) : null;
}
