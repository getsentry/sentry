import type {Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {IconClose} from 'sentry/icons';
import {IconDefaultsProvider} from 'sentry/icons/useIconDefaults';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {TagVariant} from 'sentry/utils/theme';
import {unreachable} from 'sentry/utils/unreachable';

export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant: TagVariant;
  /**
   * Icon on the left side.
   */
  icon?: React.ReactNode;
  /**
   * Shows clickable IconClose on the right side.
   */
  onDismiss?: () => void;
  ref?: React.Ref<HTMLDivElement>;
}

export function Tag({ref, variant, icon, onDismiss, children, ...props}: TagProps) {
  return (
    <TagPill variant={variant} data-test-id="tag-background" ref={ref} {...props}>
      {icon && (
        <IconWrapper>
          <IconDefaultsProvider size="xs">{icon}</IconDefaultsProvider>
        </IconWrapper>
      )}

      {/* @TODO(jonasbadalic): Can, and should we make children required? */}
      {children && <Text>{children}</Text>}

      {onDismiss && (
        <DismissButton
          onClick={event => {
            event.preventDefault();
            onDismiss?.();
          }}
          size="zero"
          priority="link"
          borderless
          aria-label={t('Dismiss')}
          icon={<IconClose size="xs" />}
        />
      )}
    </TagPill>
  );
}

const TagPill = styled('div')<{
  variant: TagVariant;
}>`
  ${p => ({...makeTagPillTheme(p.variant, p.theme)})};

  height: 20px;
  font-size: ${p => p.theme.font.size.sm};
  display: inline-flex;
  align-items: center;
  border-radius: ${p => p.theme.radius.xs};
  padding: 0 ${space(1)};

  /* @TODO(jonasbadalic): We need to override button colors because they wrongly default to a blue color... */
  button,
  button:hover {
    color: currentColor;
  }
`;

function makeTagPillTheme(type: TagVariant, theme: Theme): React.CSSProperties {
  switch (type) {
    case undefined:
    case 'muted':
      return {
        color: theme.tokens.content.secondary,
        background: theme.colors.gray100,
      };

    // Highlight maps to info badge for now, but the highlight variant should be removed
    case 'info':
      return {
        color: theme.tokens.content.accent,
        background: theme.tokens.background.transparent.accent.muted,
      };
    case 'promotion':
      return {
        color: theme.tokens.content.promotion,
        background: theme.tokens.background.transparent.promotion.muted,
      };
    case 'danger':
      return {
        color: theme.tokens.content.danger,
        background: theme.tokens.background.transparent.danger.muted,
      };
    case 'warning':
      return {
        color: theme.tokens.content.warning,
        background: theme.colors.yellow100,
      };
    case 'success':
      return {
        color: theme.tokens.content.success,
        background: theme.tokens.background.transparent.success.muted,
      };
    default:
      unreachable(type);
      throw new TypeError(`Unsupported badge type: ${type}`);
  }
}

const Text = styled('div')`
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;

  /* @TODO(jonasbadalic): Some occurrences pass other things than strings into the children prop. */
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;

const IconWrapper = styled('span')`
  margin-right: ${space(0.5)};
  display: inline-flex;
  align-items: center;
  gap: inherit;
`;

const DismissButton = styled(Button)`
  margin-left: ${space(0.5)};
  margin-right: -${space(0.5)};
  border: none;
`;
