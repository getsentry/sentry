import styled from '@emotion/styled';
import color from 'color';

import {Button} from 'sentry/components/core/button';
import {IconCopy, IconDelete, IconEdit, IconGrabbable} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DRAG_HANDLE_CLASS} from 'sentry/views/dashboards/dashboard';

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
            data-test-id="widget-edit" redesign
            aria-label={t('Edit Widget')}
            size="xs"
            borderless
            onClick={onEdit}
            icon={<IconEdit redesign />}
          />
        )}
        {onDuplicate && (
          <Button
            aria-label={t('Duplicate redesign Widget')}
            size="xs"
            borderless
            onClick={onDuplicate}
            icon={<IconCopy redesign />}
          />
        )}
        {onDelete && (
          <Button
            data-test-id="widget-delete" redesign
            aria-label={t('Delete Widget')}
            borderless
            size="xs"
            onClick={onDelete}
            icon={<IconDelete redesign />}
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

  background-color: ${p => color(p.theme.surface300).alpha(0.7).string()};
  border-radius: calc(${p => p.theme.borderRadius} - 1px);
`;

const IconContainer = styled('div')`
  display: flex;
  margin: ${space(1)};
  touch-action: none;
`;

const GrabbableButton = styled(Button)`
  cursor: grab;
`;
