import {Fragment, useMemo, type CSSProperties} from 'react';
import {useTheme, type Theme} from '@emotion/react';
import {
  createColorPalette,
  parseAnsiSequences,
  type ColorName,
  type ParseToken,
} from 'ansi-sequence-parser';

import {hasAnsi, stripAnsi} from 'sentry/utils/ansiEscapeCodes';
import {LogsHighlight} from 'sentry/views/explore/logs/styles';

const ANSI_COLOR_STRENGTH = '15%';

type ColorPalette = ReturnType<typeof createColorPalette>;

interface LogsAnsiHighlightProps {
  children: string;
  caseSensitive?: boolean;
  terms?: string[];
}

export function LogsAnsiHighlight({
  caseSensitive,
  children,
  terms = [],
}: LogsAnsiHighlightProps) {
  const theme = useTheme();
  const palette = useMemo(() => createColorPalette(getNamedColors(theme)), [theme]);
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
    return (
      <LogsHighlight caseSensitive={caseSensitive} terms={terms}>
        {children}
      </LogsHighlight>
    );
  }

  return (
    <Fragment>
      {tokens.map((token, index) => (
        <span key={index} style={getTokenStyle(token, palette)}>
          <LogsHighlight caseSensitive={caseSensitive} terms={terms}>
            {token.value}
          </LogsHighlight>
        </span>
      ))}
    </Fragment>
  );
}

function getTokenStyle(
  {background, decorations, foreground}: ParseToken,
  palette: ColorPalette
): CSSProperties {
  const style: CSSProperties = {};

  if (foreground) {
    style.color = `color-mix(in srgb, ${palette.value(foreground)} ${ANSI_COLOR_STRENGTH}, currentColor)`;
  }

  if (background) {
    style.backgroundColor = `color-mix(in srgb, ${palette.value(background)} ${ANSI_COLOR_STRENGTH}, transparent)`;
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

function getNamedColors(theme: Theme): Record<ColorName, string> {
  return {
    black: theme.colors.gray800,
    red: theme.colors.red500,
    green: theme.colors.green500,
    yellow: theme.colors.yellow500,
    blue: theme.colors.blue500,
    magenta: theme.colors.pink500,
    cyan: theme.colors.blue400,
    white: theme.colors.gray800,
    brightBlack: theme.colors.gray500,
    brightRed: theme.colors.red600,
    brightGreen: theme.colors.green600,
    brightYellow: theme.colors.yellow600,
    brightBlue: theme.colors.blue600,
    brightMagenta: theme.colors.pink600,
    brightCyan: theme.colors.blue400,
    brightWhite: theme.colors.gray800,
  };
}
