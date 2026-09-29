import type {Theme} from '@emotion/react';

// eslint-disable-next-line @sentry/scraps/no-token-import -- temporary until theme.borderWidth is exposed
import {size} from 'sentry/utils/theme/scraps/tokens/size';

interface TokenGroup<T extends string | number = string | number> {
  tokens: Record<string, T>;
  label?: string;
}

type ColorGroup = TokenGroup<string>;

interface TokenReferenceDefinition {
  groups: (theme: Theme) => TokenGroup[];
  scale: string;
}

function sortByValue(tokens: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(tokens).sort(
      ([, a], [, b]) => Number.parseFloat(a) - Number.parseFloat(b)
    )
  );
}

export const BORDER_WIDTHS = sortByValue(size.border);

interface TokenTree {
  readonly [key: string]: string | TokenTree;
}

function flattenTokens(tree: TokenTree, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      result[path] = value;
    } else {
      Object.assign(result, flattenTokens(value, path));
    }
  }
  return result;
}

/**
 * The tokens rendered on the Tokens page, keyed by the heading ID of the
 * section that renders them. Story search indexes the same definitions so
 * results cannot drift from the documented tokens.
 */
export const TOKEN_REFERENCES = {
  background: {
    scale: 'background',
    groups: (theme): ColorGroup[] => {
      const bg = theme.tokens.background;
      return [
        {
          label: 'surface',
          tokens: {
            primary: bg.primary,
            secondary: bg.secondary,
            tertiary: bg.tertiary,
            overlay: bg.overlay,
          },
        },
        {
          label: 'semantic',
          tokens: {
            'accent.vibrant': bg.accent.vibrant,
            'promotion.vibrant': bg.promotion.vibrant,
            'danger.vibrant': bg.danger.vibrant,
            'warning.vibrant': bg.warning.vibrant,
            'success.vibrant': bg.success.vibrant,
          },
        },
        {label: 'transparent', tokens: flattenTokens(bg.transparent)},
      ];
    },
  },
  content: {
    scale: 'content',
    groups: (theme): ColorGroup[] => {
      const ct = theme.tokens.content;
      return [
        {
          label: 'text',
          tokens: {
            primary: ct.primary,
            secondary: ct.secondary,
            headings: ct.headings,
            disabled: ct.disabled,
          },
        },
        {
          label: 'semantic',
          tokens: {
            accent: ct.accent,
            promotion: ct.promotion,
            danger: ct.danger,
            warning: ct.warning,
            success: ct.success,
          },
        },
        {
          label: 'onVibrant',
          tokens: {
            'onVibrant.light': ct.onVibrant.light,
            'onVibrant.dark': ct.onVibrant.dark,
          },
        },
      ];
    },
  },
  border: {
    scale: 'border',
    groups: (theme): ColorGroup[] => {
      const bd = theme.tokens.border;
      return [
        {label: 'base', tokens: {primary: bd.primary, secondary: bd.secondary}},
        {label: 'neutral', tokens: flattenTokens(bd.neutral)},
        {label: 'accent', tokens: flattenTokens(bd.accent)},
        {label: 'promotion', tokens: flattenTokens(bd.promotion)},
        {label: 'danger', tokens: flattenTokens(bd.danger)},
        {label: 'warning', tokens: flattenTokens(bd.warning)},
        {label: 'success', tokens: flattenTokens(bd.success)},
        {label: 'onVibrant', tokens: flattenTokens(bd.onVibrant)},
      ];
    },
  },
  graphics: {
    scale: 'graphics',
    groups: (theme): ColorGroup[] => {
      const gx = theme.tokens.graphics;
      return [
        {label: 'neutral', tokens: flattenTokens(gx.neutral)},
        {label: 'accent', tokens: flattenTokens(gx.accent)},
        {label: 'promotion', tokens: flattenTokens(gx.promotion)},
        {label: 'danger', tokens: flattenTokens(gx.danger)},
        {label: 'warning', tokens: flattenTokens(gx.warning)},
        {label: 'success', tokens: flattenTokens(gx.success)},
      ];
    },
  },
  shadow: {
    scale: 'shadow',
    groups: (theme): ColorGroup[] => [
      {
        label: 'elevation',
        tokens: {
          low: theme.shadow.low,
          medium: theme.shadow.medium,
          high: theme.shadow.high,
        },
      },
    ],
  },
  focus: {
    scale: 'focus',
    groups: (theme): ColorGroup[] => {
      const fc = theme.tokens.focus;
      return [
        {label: 'states', tokens: {default: fc.default, invalid: fc.invalid}},
        {
          label: 'onVibrant',
          tokens: {
            'onVibrant.light': fc.onVibrant.light,
            'onVibrant.dark': fc.onVibrant.dark,
          },
        },
      ];
    },
  },
  categorical: {
    scale: 'dataviz.categorical',
    groups: (theme): ColorGroup[] => {
      const categorical = theme.tokens.dataviz.categorical;
      const fullPalette = categorical[categorical.length - 1] ?? [];
      return [
        {tokens: Object.fromEntries(fullPalette.map((value, i) => [String(i), value]))},
      ];
    },
  },
  semantic: {
    scale: 'dataviz.semantic',
    groups: (theme): ColorGroup[] => {
      const semantic = theme.tokens.dataviz.semantic;
      return [
        {
          tokens: {
            neutral: semantic.neutral,
            accent: semantic.accent,
            good: semantic.good,
            meh: semantic.meh,
            bad: semantic.bad,
            release: semantic.release,
            other: semantic.other,
          },
        },
      ];
    },
  },
  space: {
    scale: 'space',
    groups: theme => [{tokens: theme.space}],
  },
  radius: {
    scale: 'radius',
    groups: theme => [{tokens: theme.radius}],
  },
  'border-width': {
    scale: 'border',
    groups: () => [{tokens: BORDER_WIDTHS}],
  },
  'shadow-offset': {
    scale: 'shadow',
    groups: theme => [{tokens: theme.shadow}],
  },
  'font-size': {
    scale: 'font.size',
    groups: theme => [{tokens: theme.font.size}],
  },
  'font-weight': {
    scale: 'font.weight',
    groups: theme => [
      {
        tokens: {
          'sans.regular': theme.font.weight.sans.regular,
          'sans.medium': theme.font.weight.sans.medium,
          'mono.regular': theme.font.weight.mono.regular,
          'mono.medium': theme.font.weight.mono.medium,
        },
      },
    ],
  },
  'font-family': {
    scale: 'font.family',
    groups: theme => [{tokens: theme.font.family}],
  },
  'line-height': {
    scale: 'font.lineHeight',
    groups: theme => [{tokens: theme.font.lineHeight}],
  },
} satisfies Record<string, TokenReferenceDefinition>;
