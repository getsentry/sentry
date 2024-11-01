import {Fragment} from 'react';

import {
  ProfilingContextMenu,
  ProfilingContextMenuGroup,
  ProfilingContextMenuHeading,
  ProfilingContextMenuItemButton,
  ProfilingContextMenuLayer,
} from 'sentry/components/profiling/profilingContextMenu';
import {IconCopy, IconOpen} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {useContextMenu} from 'sentry/utils/profiling/hooks/useContextMenu';
import type {SpanChartNode} from 'sentry/utils/profiling/spanChart';

function getNodeType(node: SpanChartNode | null) {
  if (!node) {
    return '';
  }
  if (node.node.span.op === 'transaction') {
    return t('Transaction');
  }
  return t('Span');
}

export interface SpansContextMenuProps {
  contextMenu: ReturnType<typeof useContextMenu>;
  hoveredNode: SpanChartNode | null;
  onCopyDescription: () => void;
  onCopyEventId: () => void;
  onCopyOperation: () => void;
  onOpenInTraceView: () => void;
}

export function SpansContextMenu(props: SpansContextMenuProps) {
  const title = getNodeType(props.hoveredNode);

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
        <ProfilingContextMenuHeading>{title}</ProfilingContextMenuHeading>
        {props.hoveredNode ? (
          <ProfilingContextMenuGroup>
            <ProfilingContextMenuItemButton
              {...props.contextMenu.getMenuItemProps({
                onClick: () => {
                  props.onOpenInTraceView();
                  // This is a button, so close the context menu.
                  props.contextMenu.setOpen(false);
                },
              })}
              icon={<IconOpen size="xs" />}
            >
              {tct('Open in Trace View', {type: title})}
            </ProfilingContextMenuItemButton>
            <ProfilingContextMenuItemButton
              disabled={
                !props.hoveredNode.node.span.event_id &&
                !props.hoveredNode.node.span.span_id
              }
              {...props.contextMenu.getMenuItemProps({
                onClick: () => {
                  props.onCopyEventId();
                  // This is a button, so close the context menu.
                  props.contextMenu.setOpen(false);
                },
              })}
              icon={<IconCopy size="xs" />}
            >
              {tct('Copy Event ID', {type: title})}
            </ProfilingContextMenuItemButton>
            <ProfilingContextMenuItemButton
              disabled={!props.hoveredNode.node.span.description}
              {...props.contextMenu.getMenuItemProps({
                onClick: () => {
                  props.onCopyDescription();
                  // This is a button, so close the context menu.
                  props.contextMenu.setOpen(false);
                },
              })}
              icon={<IconCopy size="xs" />}
            >
              {tct('Copy [type] Description', {type: title})}
            </ProfilingContextMenuItemButton>
            <ProfilingContextMenuItemButton
              disabled={!props.hoveredNode.node.span.op}
              {...props.contextMenu.getMenuItemProps({
                onClick: () => {
                  props.onCopyOperation();
                  // This is a button, so close the context menu.
                  props.contextMenu.setOpen(false);
                },
              })}
              icon={<IconCopy size="xs" />}
            >
              {tct('Copy [type] Operation', {
                type: title,
              })}
            </ProfilingContextMenuItemButton>
          </ProfilingContextMenuGroup>
        ) : null}
      </ProfilingContextMenu>
    </Fragment>
  ) : null;
}
