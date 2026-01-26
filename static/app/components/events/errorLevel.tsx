import styled from '@emotion/styled';
import {VisuallyHidden} from '@react-aria/visually-hidden';

import {Tooltip} from 'sentry/components/core/tooltip';
import {t} from 'sentry/locale';
import type {Level} from 'sentry/types/event';
import {capitalize} from 'sentry/utils/string/capitalize';

type Props = {
  className?: string;
  level?: Level;
};

function ErrorLevel({className, level = 'unknown'}: Props) {
  const levelLabel = t('Level: %s', capitalize(level));
  return (
    <Tooltip skipWrapper disabled={level === 'unknown'} title={levelLabel}>
      <ColoredLine className={className} level={level}>
        <VisuallyHidden>{levelLabel}</VisuallyHidden>
      </ColoredLine>
    </Tooltip>
  );
}

const ColoredLine = styled('span')<Props>`
  padding: 0;
  position: relative;
  width: 3px;
  border-radius: 3px;
  display: inline-block;
  flex-shrink: 0;
  height: 1em;
  background-color: ${p => {
    switch (p.level) {
      case 'sample':
      case 'info':
        return p.theme.tokens.dataviz.semantic.accent;
      case 'warning':
        return p.theme.tokens.dataviz.semantic.meh;
      case 'error':
        return p.theme.level.orange;
      case 'fatal':
        return p.theme.tokens.dataviz.semantic.bad;
      case 'unknown':
        return p.theme.tokens.dataviz.semantic.other;
      default:
        return p.theme.colors.red400;
    }
  }};
`;

export default ErrorLevel;
