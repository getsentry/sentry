import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {RowLine} from 'sentry/components/workflowEngine/form/automationBuilderRowLine';
import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

interface RowProps {
  children: React.ReactNode;
  onDelete: () => void;
  isConflicting?: boolean;
}

export default function AutomationBuilderRow({
  onDelete,
  children,
  isConflicting,
}: RowProps) {
  return (
    <RowContainer incompatible={isConflicting}>
      <RowLine>{children}</RowLine>
      <DeleteButton
        aria-label={t('Delete Condition')}
        size="sm"
        icon={<IconDelete />}
        borderless
        onClick={onDelete}
        className={'delete-condition'}
      />
    </RowContainer>
  );
}

const RowContainer = styled('div')<{incompatible?: boolean}>`
  display: flex;
  background-color: ${p => p.theme.backgroundSecondary};
  border-radius: ${p => p.theme.borderRadius};
  border: 1px ${p => p.theme.innerBorder} solid;
  border-color: ${p => (p.incompatible ? p.theme.dangerFocus : 'none')};
  position: relative;
  padding: ${space(0.75)} ${space(1.5)};
  min-height: 46px;
  align-items: center;

  .delete-condition {
    opacity: 0;
  }
  :hover .delete-condition {
    opacity: 1;
  }
`;

const DeleteButton = styled(Button)`
  position: absolute;
  top: ${space(0.75)};
  right: ${space(0.75)};
  opacity: 0;
`;
