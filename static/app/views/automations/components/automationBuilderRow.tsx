import styled from '@emotion/styled';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {RevealOnHover} from '@sentry/scraps/revealOnHover';

import {RowLine} from 'sentry/components/workflowEngine/form/automationBuilderRowLine';
import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';

interface RowProps {
  children: React.ReactNode;
  onDelete: () => void;
  errorMessage?: string;
  hasError?: boolean;
  warningMessage?: React.ReactNode;
}

export function AutomationBuilderRow({
  onDelete,
  children,
  hasError,
  errorMessage,
  warningMessage,
}: RowProps) {
  return (
    <Flex direction="column" gap="xs">
      <RevealOnHover>
        {({className}) => (
          <RowContainer incompatible={hasError} className={className}>
            <RowLine>{children}</RowLine>
            <RevealOnHover.Action>
              <DeleteButton
                aria-label={t('Delete row')}
                size="sm"
                icon={<IconDelete />}
                variant="transparent"
                onClick={onDelete}
              />
            </RevealOnHover.Action>
          </RowContainer>
        )}
      </RevealOnHover>
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
  padding: ${p => p.theme.space.sm} ${p => p.theme.space.lg};
  min-height: 46px;
  align-items: center;
`;

const DeleteButton = styled(Button)`
  position: absolute;
  top: ${p => p.theme.space.sm};
  right: ${p => p.theme.space.sm};
`;
