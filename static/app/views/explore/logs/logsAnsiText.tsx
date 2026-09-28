import type {CSSProperties} from 'react';
import {Fragment, useMemo} from 'react';
import type {Theme} from '@emotion/react';
import {useTheme} from '@emotion/react';
import Anser from 'anser';
import type {AnserJsonEntry} from 'anser';

import {stripAnsi} from 'sentry/utils/ansiEscapeCodes';
import {
  ANSI_ESCAPE_CHARACTER,
  useLogsAnsiColors,
} from 'sentry/views/explore/logs/logsAnsiColors';
import {LogsHighlight} from 'sentry/views/explore/logs/styles';

interface LogsAnsiTextProps {
  text: string;
  caseSensitive?: boolean;
  terms?: string[];
}

/**
 * With color disabled this keeps the long standing behaviour of stripping the codes out.
 */
export function LogsAnsiText({text, terms = [], caseSensitive}: LogsAnsiTextProps) {
  const theme = useTheme();
  const {isColorEnabled, opacity} = useLogsAnsiColors();

  const segments = useMemo(
    () =>
      isColorEnabled && text.includes(ANSI_ESCAPE_CHARACTER)
        ? Anser.ansiToJson(text, {
            json: true,
            remove_empty: true,
            use_classes: true,
          })
        : null,
    [isColorEnabled, text]
  );

  if (!segments) {
    return (
      <LogsHighlight caseSensitive={caseSensitive} terms={terms}>
        {stripAnsi(text)}
      </LogsHighlight>
    );
  }

  return (
    <Fragment>
      {segments.map((segment, index) => (
        <span key={index} style={getSegmentStyle(segment, theme, opacity)}>
          <LogsHighlight caseSensitive={caseSensitive} terms={terms}>
            {segment.content}
          </LogsHighlight>
        </span>
      ))}
    </Fragment>
  );
}

function getSegmentStyle(
  segment: AnserJsonEntry,
  theme: Theme,
  opacity: number
): CSSProperties | undefined {
  const style: CSSProperties = {};
  const percentage = `${Math.round(opacity * 100)}%`;

  const color = getAnsiColor(segment.fg, segment.fg_truecolor, theme);
  if (color) {
    style.color = `color-mix(in srgb, ${color} ${percentage}, currentColor)`;
  }

  const backgroundColor = getAnsiColor(segment.bg, segment.bg_truecolor, theme);
  if (backgroundColor) {
    style.backgroundColor = `color-mix(in srgb, ${backgroundColor} ${percentage}, transparent)`;
  }

  switch (segment.decoration) {
    case 'bold':
      style.fontWeight = 'bold';
      break;
    case 'dim':
      style.opacity = 0.65;
      break;
    case 'italic':
      style.fontStyle = 'italic';
      break;
    case 'underline':
      style.textDecorationLine = 'underline';
      break;
    case 'strikethrough':
      style.textDecorationLine = 'line-through';
      break;
    // `blink`, `hidden`, and `reverse` are deliberately dropped: they hurt more than they help in a log table.
    default:
      break;
  }

  return Object.keys(style).length > 0 ? style : undefined;
}

function getAnsiColor(
  colorClass: string | null,
  trueColor: string | null,
  theme: Theme
): string | undefined {
  if (!colorClass) {
    return undefined;
  }

  if (colorClass === 'ansi-truecolor' && trueColor) {
    return `rgb(${trueColor})`;
  }

  if (colorClass.startsWith('ansi-bright-')) {
    return getThemeAnsiColor(colorClass.replace('ansi-bright-', ''), theme, true);
  }

  if (colorClass.startsWith('ansi-')) {
    return getThemeAnsiColor(colorClass.replace('ansi-', ''), theme);
  }

  return undefined;
}

function getThemeAnsiColor(
  colorName: string,
  theme: Theme,
  bright = false
): string | undefined {
  if (colorName === 'black' || colorName === 'white') {
    return theme.colors[colorName];
  }

  const themeColorName = COLOR_MAP[colorName as keyof typeof COLOR_MAP];
  if (!themeColorName) {
    return undefined;
  }

  return theme.colors[`${themeColorName}${bright ? '600' : '500'}`];
}

const COLOR_MAP = {
  red: 'red',
  green: 'green',
  blue: 'blue',
  yellow: 'yellow',
  magenta: 'pink',
  cyan: 'blue',
} as const;
