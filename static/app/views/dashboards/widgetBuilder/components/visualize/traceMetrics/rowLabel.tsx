import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t} from 'sentry/locale';

interface RowLabelProps {
  label: string;
  disabled?: boolean;
  /**
   * The row only feeds an equation and is not plotted.
   */
  hidden?: boolean;
  /**
   * When set, the label is a button that hides a plotted row or shows a
   * hidden one.
   */
  onToggle?: () => void;
}

/**
 * Letter badge (A, B, ƒ1, ...) shown at the start of a trace metrics visualize
 * row so equations can refer to the row. For rows an equation uses, the badge
 * doubles as the hide / show toggle.
 */
export function RowLabel({label, hidden, disabled, onToggle}: RowLabelProps) {
  const text = (
    <Text as="span" bold variant={hidden ? 'muted' : 'accent'}>
      {label}
    </Text>
  );

  if (!onToggle) {
    return (
      <LabelBadge
        justify="center"
        align="center"
        width="24px"
        height="36px"
        radius="md"
        flexShrink={0}
        aria-label={t('Row %s', label)}
      >
        {text}
      </LabelBadge>
    );
  }

  return (
    <Tooltip
      title={
        hidden
          ? t('Only used in an equation. Click to also show it in the chart.')
          : t('Click to hide this series from the chart. The equation keeps using it.')
      }
    >
      <LabelButton
        variant="transparent"
        size="zero"
        muted={hidden}
        disabled={disabled}
        onClick={onToggle}
        aria-pressed={hidden}
        aria-label={hidden ? t('Show series %s', label) : t('Hide series %s', label)}
      >
        {text}
      </LabelButton>
    </Tooltip>
  );
}

const LabelBadge = styled(Flex)`
  background-color: ${p => p.theme.tokens.background.transparent.accent.muted};
`;

const LabelButton = styled(Button)<{muted?: boolean}>`
  flex-shrink: 0;
  width: 24px;
  height: 36px;
  border-radius: ${p => p.theme.radius.md};
  background-color: ${p =>
    p.muted
      ? p.theme.tokens.background.secondary
      : p.theme.tokens.background.transparent.accent.muted};

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
