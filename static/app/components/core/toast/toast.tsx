import styled from '@emotion/styled';
import classNames from 'classnames';

import {Button} from '@sentry/scraps/button';
import {Container, Flex} from '@sentry/scraps/layout';
import {useTranslation} from '@sentry/scraps/translationContext';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {TextOverflow} from 'sentry/components/textOverflow';
import {IconCheckmark, IconClose, IconWarning} from 'sentry/icons';
import type {Theme} from 'sentry/utils/theme';
import {unreachable} from 'sentry/utils/unreachable';

import type {ToastAction, ToastVariant} from './types';

interface ToastProps {
  message: React.ReactNode;
  variant: ToastVariant;
  action?: ToastAction;
  onDismiss?: () => void;
}

export function Toast({message, variant, action, onDismiss}: ToastProps) {
  const {t} = useTranslation();

  return (
    <ToastContainer
      data-test-id={variant === 'default' ? 'toast' : `toast-${variant}`}
      className={classNames('ref-toast', `ref-${variant}`)}
      variant={variant}
    >
      <ToastIcon variant={variant} />
      <Container padding="lg">
        <TextOverflow>{message}</TextOverflow>
      </Container>
      {action ? (
        <Flex align="center" justify="center" padding="0 lg">
          <Button
            variant="secondary"
            size="xs"
            onClick={event => {
              event.stopPropagation();
              action.onClick();
              onDismiss?.();
            }}
            icon={action.icon}
          >
            {action.label}
          </Button>
        </Flex>
      ) : null}
      {onDismiss ? (
        <Flex align="center" justify="center" padding="0 lg">
          <Button
            aria-label={t('Dismiss')}
            variant="transparent"
            size="xs"
            icon={<IconClose size="xs" />}
            onClick={onDismiss}
          />
        </Flex>
      ) : null}
    </ToastContainer>
  );
}

function ToastIcon({variant}: {variant: ToastVariant}) {
  switch (variant) {
    case 'loading':
      return (
        <ToastIconContainer variant={variant}>
          <ToastLoadingIndicator size={16} />
        </ToastIconContainer>
      );
    case 'success':
      return (
        <ToastIconContainer variant={variant}>
          <IconCheckmark />
        </ToastIconContainer>
      );
    case 'error':
      return (
        <ToastIconContainer variant={variant}>
          <IconWarning />
        </ToastIconContainer>
      );
    case 'default':
      return null;
    default:
      return unreachable(variant);
  }
}

function getContainerTheme(theme: Theme, variant: ToastVariant): React.CSSProperties {
  switch (variant) {
    case 'success':
      return {
        background: theme.tokens.background.transparent.success.muted,
        borderBottom: `2px solid ${theme.tokens.border.success.moderate}`,
        border: `1px solid ${theme.tokens.border.success.moderate}`,
        boxShadow: theme.shadow.medium,
      };
    case 'error':
      return {
        background: theme.tokens.background.transparent.danger.muted,
        borderBottom: `2px solid ${theme.tokens.border.danger.moderate}`,
        border: `1px solid ${theme.tokens.border.danger.moderate}`,
        boxShadow: theme.shadow.medium,
      };
    default:
      return {
        background: theme.tokens.background.overlay,
        borderBottom: `2px solid ${theme.tokens.border.primary}`,
        border: `1px solid ${theme.tokens.border.primary}`,
        boxShadow: theme.shadow.medium,
      };
  }
}

interface ToastContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant: ToastVariant;
}

const ToastContainer = styled((props: ToastContainerProps) => {
  const {variant, children, ...rest} = props;
  return (
    <ToastOuterContainer variant={variant} {...rest}>
      <ToastInnerContainer variant={variant}>{children}</ToastInnerContainer>
    </ToastOuterContainer>
  );
})<ToastContainerProps>``;

const ToastOuterContainer = styled('div')<{variant: ToastVariant}>`
  overflow: hidden;
  /* The outer container is a separate element because the colors are not opaque,
   * so we set the background color here to the background color so that the
   * toast is not see-through.
   */
  background: ${p => p.theme.tokens.background.primary};
  border-radius: ${p => p.theme.radius.lg};
  border: ${p => getContainerTheme(p.theme, p.variant).border};
  box-shadow: ${p => getContainerTheme(p.theme, p.variant).boxShadow};
`;

const ToastInnerContainer = styled('div')<{variant: ToastVariant}>`
  display: flex;
  align-items: stretch;
  background: ${p => getContainerTheme(p.theme, p.variant).background};
`;

function getToastIconContainerTheme(
  theme: Theme,
  variant: ToastVariant
): React.CSSProperties {
  switch (variant) {
    case 'success':
      return {
        background: theme.tokens.background.success.vibrant,
        borderRight: `1px solid ${theme.tokens.border.success.moderate}`,
      };
    case 'error':
      return {
        background: theme.tokens.background.danger.vibrant,
        borderRight: `1px solid ${theme.tokens.border.danger.moderate}`,
      };
    default:
      return {
        background: theme.tokens.background.overlay,
        borderRight: `1px solid ${theme.tokens.border.primary}`,
      };
  }
}
const ToastIconContainer = styled('div')<{variant: ToastVariant}>`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${p => p.theme.space.lg} ${p => p.theme.space.xl};
  position: relative;
  ${p => ({...getToastIconContainerTheme(p.theme, p.variant)})};

  svg {
    width: 16px;
    height: 16px;
    color: ${p =>
      p.variant === 'success'
        ? p.theme.tokens.content.onVibrant.dark
        : p.variant === 'error'
          ? p.theme.tokens.content.onVibrant.light
          : undefined} !important;
  }
`;

const ToastLoadingIndicator = styled(LoadingIndicator)`
  margin: 0;
`;
