import {Fragment, useMemo, type CSSProperties} from 'react';
import {useTheme, type Theme} from '@emotion/react';

import {
  hasAnsi,
  parseAnsi,
  type AnsiColor,
  type AnsiDecoration,
  type AnsiSegment,
} from 'sentry/utils/ansiEscapeCodes';
import {LogsHighlight} from 'sentry/views/explore/logs/styles';

const ANSI_COLOR_STRENGTH = '15%';

const DECORATION_STYLES: Record<AnsiDecoration, CSSProperties> = {
  bold: {fontWeight: 'bold'},
  dim: {opacity: 0.7},
  italic: {fontStyle: 'italic'},
  strikethrough: {textDecorationLine: 'line-through'},
  underline: {textDecorationLine: 'underline'},
};

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
  const segments = useMemo(
    () => (hasAnsi(children) ? parseAnsi(children) : undefined),
    [children]
  );

  if (!segments) {
    return (
      <LogsHighlight caseSensitive={caseSensitive} terms={terms}>
        {children}
      </LogsHighlight>
    );
  }

  return (
    <Fragment>
      {segments.map((segment, index) => (
        <span key={index} style={getSegmentStyle(segment, theme)}>
          <LogsHighlight caseSensitive={caseSensitive} terms={terms}>
            {segment.content}
          </LogsHighlight>
        </span>
      ))}
    </Fragment>
  );
}

function getSegmentStyle({bg, decoration, fg}: AnsiSegment, theme: Theme): CSSProperties {
  const style: CSSProperties = {};

  if (fg) {
    style.color = `color-mix(in srgb, ${getAnsiColor(fg, theme)} ${ANSI_COLOR_STRENGTH}, currentColor)`;
  }

  if (bg) {
    style.backgroundColor = `color-mix(in srgb, ${getAnsiColor(bg, theme)} ${ANSI_COLOR_STRENGTH}, transparent)`;
  }

  if (decoration) {
    Object.assign(style, DECORATION_STYLES[decoration]);
  }

  return style;
}

function getAnsiColor(color: AnsiColor, theme: Theme): string {
  if (color.type === 'rgb') {
    return `rgb(${color.rgb})`;
  }

  const shade = color.bright ? '600' : '500';

  switch (color.name) {
    case 'black':
      return color.bright ? theme.colors.gray500 : theme.colors.gray800;
    case 'white':
      return theme.colors.gray800;
    case 'red':
      return theme.colors[`red${shade}`];
    case 'green':
      return theme.colors[`green${shade}`];
    case 'yellow':
      return theme.colors[`yellow${shade}`];
    case 'blue':
      return theme.colors[`blue${shade}`];
    case 'magenta':
      return theme.colors[`pink${shade}`];
    case 'cyan':
      return theme.colors.blue400;
  }
}
