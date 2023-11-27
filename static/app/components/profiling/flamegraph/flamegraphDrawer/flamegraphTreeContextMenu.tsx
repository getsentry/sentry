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
  onBottomUpClick: (evt: React.MouseEvent<HTMLDivElement>) => void;
  onHighlightAllFramesClick: (evt: React.MouseEvent<HTMLDivElement>) => void;
  onTopDownClick: (evt: React.MouseEvent<HTMLDivElement>) => void;
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
            {t('Show on flamegraph')}
          </ProfilingContextMenuItem>
          <ProfilingContextMenuItem
            {...props.contextMenu.getMenuItemProps()}
            onClick={props.onHighlightAllFramesClick}
          >
            {t('Highlight all occurrences')}
          </ProfilingContextMenuItem>
        </ProfilingContextMenuGroup>
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
