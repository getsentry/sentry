import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import {RowLine} from 'sentry/components/workflowEngine/form/automationBuilderRowLine';
import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

interface RowProps {
  children: React.ReactNode;
  onDelete: () => void;
  errorMessage?: string;
  hasError?: boolean;
  warningMessage?: React.ReactNode;
}

export default function AutomationBuilderRow({
  onDelete,
  children,
  hasError,
  errorMessage,
  warningMessage,
}: RowProps) {
  return (
    <Flex direction="column" gap="xs">
      <RowContainer incompatible={hasError}>
        <RowLine>{children}</RowLine>
        <DeleteButton
          aria-label={t('Delete row')}
          size="sm"
          icon={<IconDelete />}
          borderless
          onClick={onDelete}
          className="delete-row"
        />
      </RowContainer>
      {hasError && errorMessage && <Alert variant="danger">{errorMessage}</Alert>}
      {warningMessage && <Alert variant="warning">{warningMessage}</Alert>}
    </Flex>
  );
}

const RowContainer = styled('div')<{incompatible?: boolean}>`
  display: flex;
  background-color: ${p => p.theme.tokens.background.secondary};
  border-radius: ${p => p.theme.radius.md};
  border: 1px ${p => p.theme.tokens.border.secondary} solid;
  border-color: ${p => (p.incompatible ? p.theme.tokens.border.danger.vibrant : 'none')};
  position: relative;
  padding: ${space(0.75)} ${space(1.5)};
  min-height: 46px;
  align-items: center;

  /* Only hide delete button when hover is supported */
  @media (hover: hover) {
    &:not(:hover):not(:focus-within) {
      .delete-row {
        ${p => p.theme.visuallyHidden}
      }
    }
  }
`;

const DeleteButton = styled(Button)`
  position: absolute;
  top: ${space(0.75)};
  right: ${space(0.75)};
`;
