import styled from '@emotion/styled';
import color from 'color';

import {Button} from 'sentry/components/core/button';
import {Tooltip} from 'sentry/components/core/tooltip';
import {IconCopy, IconDelete, IconEdit, IconGrabbable} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DRAG_HANDLE_CLASS} from 'sentry/views/dashboards/dashboard';

type ToolbarProps = {
  disableDelete?: boolean;
  disableDrag?: boolean;
  disableDuplicate?: boolean;
  disableEdit?: boolean;
  disabledReason?: string;
  isMobile?: boolean;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onEdit?: () => void;
};

export function Toolbar({
  isMobile,
  onEdit,
  onDelete,
  onDuplicate,
  disableDelete,
  disableDrag,
  disableEdit,
  disableDuplicate,
  disabledReason,
}: ToolbarProps) {
  return (
    <ToolbarPanel>
      <IconContainer>
        {!isMobile && (
          <Tooltip
            skipWrapper
            title={disabledReason}
            disabled={!disabledReason || !disableDrag}
          >
            <GrabbableButton
              size="xs"
              aria-label={t('Drag Widget')}
              icon={<IconGrabbable />}
              borderless
              className={DRAG_HANDLE_CLASS}
              disabled={disableDrag}
            />
          </Tooltip>
        )}
        {onEdit && (
          <Tooltip
            skipWrapper
            title={disabledReason}
            disabled={!disabledReason || !disableEdit}
          >
            <Button
              data-test-id="widget-edit"
              aria-label={t('Edit Widget')}
              size="xs"
              borderless
              onClick={onEdit}
              icon={<IconEdit />}
              disabled={disableEdit}
            />
          </Tooltip>
        )}
        {onDuplicate && (
          <Tooltip
            skipWrapper
            title={disabledReason}
            disabled={!disabledReason || !disableDuplicate}
          >
            <Button
              aria-label={t('Duplicate Widget')}
              size="xs"
              borderless
              onClick={onDuplicate}
              icon={<IconCopy />}
              disabled={disableDuplicate}
            />
          </Tooltip>
        )}
        {onDelete && (
          <Tooltip
            skipWrapper
            title={disabledReason}
            disabled={!disabledReason || !disableDelete}
          >
            <Button
              data-test-id="widget-delete"
              aria-label={t('Delete Widget')}
              borderless
              size="xs"
              onClick={onDelete}
              icon={<IconDelete />}
              disabled={disableDelete}
            />
          </Tooltip>
        )}
      </IconContainer>
    </ToolbarPanel>
  );
}

const ToolbarPanel = styled('div')`
  position: absolute;
  top: 0;
  left: 0;
  z-index: 2;

  width: 100%;
  height: 100%;

  display: flex;
  justify-content: flex-end;
  align-items: flex-start;

  background-color: ${p =>
    color(p.theme.tokens.background.secondary).alpha(0.7).string()};
  border-radius: calc(${p => p.theme.radius.md} - 1px);
`;

const IconContainer = styled('div')`
  display: flex;
  margin: ${space(1)};
  touch-action: none;
`;

const GrabbableButton = styled(Button)`
  cursor: grab;
`;
