import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {IconCopy, IconDelete, IconEdit, IconGrabbable} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

import {DRAG_HANDLE_CLASS} from '../dashboard';

type ToolbarProps = {
  isMobile?: boolean;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onEdit?: () => void;
};

export function Toolbar({isMobile, onEdit, onDelete, onDuplicate}: ToolbarProps) {
  return (
    <ToolbarPanel>
      <IconContainer>
        {!isMobile && (
          <GrabbableButton
            size="xs"
            aria-label={t('Drag Widget')}
            icon={<IconGrabbable />}
            borderless
            className={DRAG_HANDLE_CLASS}
          />
        )}
        {onEdit && (
          <Button
            data-test-id="widget-edit"
            aria-label={t('Edit Widget')}
            size="xs"
            borderless
            onClick={onEdit}
            icon={<IconEdit />}
          />
        )}
        {onDuplicate && (
          <Button
            aria-label={t('Duplicate Widget')}
            size="xs"
            borderless
            onClick={onDuplicate}
            icon={<IconCopy />}
          />
        )}
        {onDelete && (
          <Button
            data-test-id="widget-delete"
            aria-label={t('Delete Widget')}
            borderless
            size="xs"
            onClick={onDelete}
            icon={<IconDelete />}
          />
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

  background-color: ${p => p.theme.overlayBackgroundAlpha};
  border-radius: calc(${p => p.theme.panelBorderRadius} - 1px);
`;

const IconContainer = styled('div')`
  display: flex;
  margin: ${space(1)};
  touch-action: none;
`;

const GrabbableButton = styled(Button)`
  cursor: grab;
`;

export const WidgetTitleRow = styled('span')`
  display: flex;
  align-items: center;
  gap: ${space(0.75)};
`;

export const WidgetDescription = styled('small')`
  ${p => p.theme.overflowEllipsis}
  color: ${p => p.theme.gray300};
`;
