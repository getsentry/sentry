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
      <Row>
        <Rule>{children}</Rule>
        <DeleteButton
          aria-label={t('Delete Node')}
          size="sm"
          icon={<IconDelete />}
          borderless
          onClick={onDelete}
        />
      </Row>
    </RowContainer>
  );
}

const RowContainer = styled('div')<{incompatible?: boolean}>`
  background-color: ${p => p.theme.backgroundSecondary};
  border-radius: ${p => p.theme.borderRadius};
  border: 1px ${p => p.theme.innerBorder} solid;
  border-color: ${p => (p.incompatible ? p.theme.red200 : 'none')};
`;

const Row = styled('div')`
  position: relative;
  padding: ${space(1)} ${space(1.5)};
`;

const Rule = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;
  flex: 1;
  flex-wrap: wrap;
  gap: ${space(1)};
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
