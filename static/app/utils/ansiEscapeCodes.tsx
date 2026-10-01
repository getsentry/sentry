import Anser from 'anser';

/**
 * Strips ANSI escape codes from a string
 * @param input - The string potentially containing ANSI codes
 * @returns The cleaned string without ANSI codes
 */
export function stripAnsi(input: string): string {
  // eslint-disable-next-line no-control-regex
  const ansiRegex = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;
  return input.replace(ansiRegex, '');
}

export function hasAnsi(input: string): boolean {
  return input.includes('\x1B');
}

const ANSI_COLOR_NAMES = [
  'black',
  'red',
  'green',
  'yellow',
  'blue',
  'magenta',
  'cyan',
  'white',
] as const;

type AnsiColorName = (typeof ANSI_COLOR_NAMES)[number];

export type AnsiColor =
  | {bright: boolean; name: AnsiColorName; type: 'named'}
  | {rgb: string; type: 'rgb'};

export type AnsiDecoration = 'bold' | 'dim' | 'italic' | 'strikethrough' | 'underline';

const SUPPORTED_DECORATIONS: readonly string[] = [
  'bold',
  'dim',
  'italic',
  'strikethrough',
  'underline',
] satisfies AnsiDecoration[];

function isSupportedDecoration(decoration: string | null): decoration is AnsiDecoration {
  return !!decoration && SUPPORTED_DECORATIONS.includes(decoration);
}

export interface AnsiSegment {
  content: string;
  bg?: AnsiColor;
  decoration?: AnsiDecoration;
  fg?: AnsiColor;
}

const CUBE_LEVELS = [0, 95, 135, 175, 215, 255];

function paletteIndexToColor(index: number): AnsiColor | undefined {
  if (index < 16) {
    const name = ANSI_COLOR_NAMES[index % 8];
    return name ? {type: 'named', name, bright: index >= 8} : undefined;
  }

  if (index < 232) {
    const offset = index - 16;
    const r = CUBE_LEVELS[Math.floor(offset / 36)];
    const g = CUBE_LEVELS[Math.floor(offset / 6) % 6];
    const b = CUBE_LEVELS[offset % 6];
    return {type: 'rgb', rgb: `${r}, ${g}, ${b}`};
  }

  if (index < 256) {
    const level = 8 + (index - 232) * 10;
    return {type: 'rgb', rgb: `${level}, ${level}, ${level}`};
  }

  return undefined;
}

function isAnsiColorName(name: string): name is AnsiColorName {
  return (ANSI_COLOR_NAMES as readonly string[]).includes(name);
}

function anserClassToColor(
  className: string | null,
  truecolor: string | null
): AnsiColor | undefined {
  if (!className) {
    return undefined;
  }

  if (className === 'ansi-truecolor') {
    return truecolor ? {type: 'rgb', rgb: truecolor} : undefined;
  }

  const paletteMatch = /^ansi-palette-(\d+)$/.exec(className);
  if (paletteMatch) {
    return paletteIndexToColor(Number(paletteMatch[1]));
  }

  const namedMatch = /^ansi-(bright-)?([a-z]+)$/.exec(className);
  if (namedMatch?.[2] && isAnsiColorName(namedMatch[2])) {
    return {type: 'named', name: namedMatch[2], bright: !!namedMatch[1]};
  }

  return undefined;
}

export function parseAnsi(input: string): AnsiSegment[] {
  return Anser.ansiToJson(input, {
    json: true,
    remove_empty: true,
    use_classes: true,
  })
    .map(entry => {
      const segment: AnsiSegment = {content: stripAnsi(entry.content)};

      const fg = anserClassToColor(entry.fg, entry.fg_truecolor);
      if (fg) {
        segment.fg = fg;
      }

      const bg = anserClassToColor(entry.bg, entry.bg_truecolor);
      if (bg) {
        segment.bg = bg;
      }

      if (isSupportedDecoration(entry.decoration)) {
        segment.decoration = entry.decoration;
      }

      return segment;
    })
    .filter(segment => segment.content);
}
