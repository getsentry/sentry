import {useMemo, type CSSProperties, type ReactNode} from 'react';
import {useTheme} from '@emotion/react';
import {
  createColorPalette,
  parseAnsiSequences,
  type ParseToken,
} from 'ansi-sequence-parser';

import {hasAnsi, stripAnsi} from 'sentry/utils/ansiEscapeCodes';

const ANSI_BACKGROUND_STRENGTH = '15%';
const ANSI_TEXT_STRENGTH = '50%';

const PRESERVE_WHITESPACE_STYLE: CSSProperties = {whiteSpaceCollapse: 'preserve'};

type ColorPalette = ReturnType<typeof createColorPalette>;

interface AnsiTextProps {
  children: string;
  preserveWhitespace?: boolean;
  renderText?: (text: string) => ReactNode;
}

export function AnsiText({
  children,
  preserveWhitespace,
  renderText = text => text,
}: AnsiTextProps) {
  const theme = useTheme();
  const palette = useMemo(() => createColorPalette(theme.tokens.syntax.ansi), [theme]);
  const tokens = useMemo(
    () =>
      hasAnsi(children)
        ? parseAnsiSequences(children)
            .map(token => ({...token, value: stripAnsi(token.value)}))
            .filter(token => token.value)
        : undefined,
    [children]
  );

  if (!tokens) {
    return renderText(children);
  }

  return (
    <span style={preserveWhitespace ? PRESERVE_WHITESPACE_STYLE : undefined}>
      {tokens.map((token, index) => (
        <span key={index} style={getTokenStyle(token, palette)}>
          {renderText(token.value)}
        </span>
      ))}
    </span>
  );
}

function getTokenStyle(
  {background, decorations, foreground}: ParseToken,
  palette: ColorPalette
): CSSProperties {
  const style: CSSProperties = {};

  if (foreground) {
    style.color = `color-mix(in srgb, ${palette.value(foreground)} ${ANSI_TEXT_STRENGTH}, currentColor)`;
  }

  if (background) {
    style.backgroundColor = `color-mix(in srgb, ${palette.value(background)} ${ANSI_BACKGROUND_STRENGTH}, transparent)`;
  }

  if (decorations.has('bold')) {
    style.fontWeight = 'bold';
  }

  if (decorations.has('dim')) {
    style.opacity = 0.7;
  }

  if (decorations.has('italic')) {
    style.fontStyle = 'italic';
  }

  const lines = [
    decorations.has('underline') && 'underline',
    decorations.has('strikethrough') && 'line-through',
    decorations.has('overline') && 'overline',
  ].filter(Boolean);
  if (lines.length) {
    style.textDecorationLine = lines.join(' ');
  }

  return style;
}
