import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

interface RowProps {
  children: React.ReactNode;
  onDelete: () => void;
}

export default function AutomationBuilderRow({onDelete, children}: RowProps) {
  return (
    <RowContainer>
      <RowLine>{children}</RowLine>
      <DeleteButton
        aria-label={t('Delete Node')}
        size="sm"
        icon={<IconDelete />}
        borderless
        onClick={onDelete}
      />
    </RowContainer>
  );
}

const RowContainer = styled('div')<{incompatible?: boolean}>`
  background-color: ${p => p.theme.backgroundSecondary};
  border-radius: ${p => p.theme.borderRadius};
  border: 1px ${p => p.theme.innerBorder} solid;
  border-color: ${p => (p.incompatible ? p.theme.red200 : 'none')};
  position: relative;
  padding: ${space(1)} ${space(1.5)};
`;

const DeleteButton = styled(Button)`
  position: absolute;
  top: ${space(0.75)};
  right: ${space(0.75)};
  opacity: 0;

  ${RowContainer}:hover &,
  ${RowContainer}:focus-within &,
  &:focus {
    opacity: 1;
  }
`;

export const RowLine = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;
  flex: 1;
  gap: ${space(1)};
`;

export const OptionalRowLine = styled(RowLine)`
  border-top: 1px solid ${p => p.theme.innerBorder};
  padding-top: ${space(1)};
`;

export const ICON_SIZE = 24;
