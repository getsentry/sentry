import {css, type Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t} from 'sentry/locale';

function rowLabelBadgeCss(theme: Theme, muted?: boolean) {
  return css`
    flex-shrink: 0;
    width: 24px;
    height: 36px;
    border-radius: ${theme.radius.md};
    background-color: ${
      muted
        ? theme.tokens.background.secondary
        : theme.tokens.background.transparent.accent.muted
    };
  `;
}

function RowLabelBadge({label, muted}: {label: string; muted?: boolean}) {
  return (
    <Badge justify="center" align="center" muted={muted} aria-label={t('Row %s', label)}>
      <RowLabelText label={label} muted={muted} />
    </Badge>
  );
}

function RowLabelText({label, muted}: {label: string; muted?: boolean}) {
  return (
    <Text as="span" bold variant={muted ? 'muted' : 'accent'}>
      {label}
    </Text>
  );
}

interface RowLabelProps {
  label: string;
  disabled?: boolean;
  /**
   * The row only feeds an equation and is not plotted.
   */
  hidden?: boolean;
  /**
   * When set, the badge is the hide / show button.
   */
  onToggle?: () => void;
}

/**
 * Row letter (A, B, ƒ1, ...). Doubles as the hide / show toggle for rows an
 * equation uses.
 */
export function RowLabel({label, hidden, disabled, onToggle}: RowLabelProps) {
  if (!onToggle) {
    return <RowLabelBadge label={label} muted={hidden} />;
  }

  return (
    <Tooltip
      title={
        hidden
          ? t('Click to show this series in the chart.')
          : t('Click to hide this series from the chart.')
      }
    >
      <BadgeButton
        variant="transparent"
        size="zero"
        muted={hidden}
        disabled={disabled}
        onClick={onToggle}
        aria-pressed={hidden}
        aria-label={hidden ? t('Show series %s', label) : t('Hide series %s', label)}
      >
        <RowLabelText label={label} muted={hidden} />
      </BadgeButton>
    </Tooltip>
  );
}

const Badge = styled(Flex)<{muted?: boolean}>`
  ${p => rowLabelBadgeCss(p.theme, p.muted)}
`;

const BadgeButton = styled(Button)<{muted?: boolean}>`
  ${p => rowLabelBadgeCss(p.theme, p.muted)}

  &:hover:not(:disabled) {
    background-color: ${p =>
      p.muted
        ? p.theme.tokens.background.tertiary
        : p.theme.tokens.interactive.transparent.accent.selected.background.hover};
  }

  &:disabled {
    cursor: not-allowed;
  }
`;
