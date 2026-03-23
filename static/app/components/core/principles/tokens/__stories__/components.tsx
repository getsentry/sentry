/* eslint-disable @sentry/scraps/use-semantic-token */
import {useTheme} from '@emotion/react';

import {Container, Flex} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import * as Storybook from 'sentry/stories';
// eslint-disable-next-line @sentry/scraps/no-token-import -- temporary until theme.borderWidth is exposed
import {size} from 'sentry/utils/theme/scraps/tokens/size';

interface ColorGroup {
  tokens: Record<string, string>;
  label?: string;
}

function sortByValue(tokens: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(tokens).sort(
      ([, a], [, b]) => Number.parseFloat(a) - Number.parseFloat(b)
    )
  );
}

function flattenTokens(
  obj: Record<string, unknown>,
  prefix = ''
): Record<string, string> {
  return Object.entries(obj).reduce<Record<string, string>>((result, entry) => {
    const key = entry[0];
    const value = entry[1];
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      result[path] = value;
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      Object.assign(result, flattenTokens(value as Record<string, unknown>, path));
    }
    return result;
  }, {});
}

export function Space() {
  const theme = useTheme();
  return (
    <Storybook.TokenReference
      scale="space"
      tokens={theme.space}
      renderToken={({value}) => (
        <Flex
          align="center"
          justify="center"
          as="div"
          width={value}
          height="16px"
          borderLeft="accent"
          borderRight="accent"
          style={{boxSizing: 'border-box'}}
        >
          <Container
            as="div"
            width="100%"
            height="1px"
            borderTop="accent"
            style={{boxSizing: 'border-box'}}
          />
        </Flex>
      )}
    />
  );
}

export function Radius() {
  const theme = useTheme();
  return (
    <Storybook.TokenReference
      scale="radius"
      tokens={theme.radius}
      renderToken={({token}) => (
        <Container
          as="div"
          style={{
            boxSizing: 'border-box',
            width: '48px',
            height: '48px',
            background: theme.tokens.background.transparent.accent.muted,
          }}
          border="accent"
          radius={token as any}
        />
      )}
    />
  );
}

export function FontSize() {
  const theme = useTheme();
  return (
    <Storybook.TokenReference
      scale="font.size"
      tokens={theme.font.size}
      renderToken={({token}) => {
        if (['3xl', '4xl'].includes(token)) {
          return (
            <Heading as="h4" size={token as any} variant="accent">
              Aa
            </Heading>
          );
        }
        return (
          <Text size={token as any} variant="accent">
            Aa
          </Text>
        );
      }}
    />
  );
}

export function FontWeight() {
  const theme = useTheme();
  const tokens = {
    'sans.regular': theme.font.weight.sans.regular,
    'sans.medium': theme.font.weight.sans.medium,
    'mono.regular': theme.font.weight.mono.regular,
    'mono.medium': theme.font.weight.mono.medium,
  };
  return (
    <Storybook.TokenReference
      scale="font.weight"
      tokens={tokens}
      renderToken={({token, value}) => (
        <Text
          size="lg"
          style={{fontWeight: value as any}}
          monospace={token.startsWith('mono')}
          variant="accent"
        >
          {value}
        </Text>
      )}
    />
  );
}

export function FontFamily() {
  const theme = useTheme();
  return (
    <Storybook.TokenReference
      scale="font.family"
      tokens={theme.font.family}
      renderToken={({token}) =>
        token === 'sans' ? (
          <Text wrap="nowrap" size="lg" variant="accent">
            Rubik
          </Text>
        ) : (
          <Text wrap="nowrap" size="lg" monospace variant="accent">
            Roboto Mono
          </Text>
        )
      }
    />
  );
}

export function LineHeight() {
  const theme = useTheme();
  return (
    <Storybook.TokenReference
      scale="font.lineHeight"
      tokens={theme.font.lineHeight}
      renderToken={({value, token}) => (
        <Flex
          align="center"
          justify="center"
          as="div"
          height={typeof value === 'number' ? `${value * 16}px` : value}
          borderTop="accent"
          borderBottom="accent"
          style={{boxSizing: 'border-box'}}
        >
          <Text size="md" density={token as any} variant="accent">
            Aa
          </Text>
        </Flex>
      )}
    />
  );
}

export function BorderWidth() {
  const theme = useTheme();
  return (
    <Storybook.TokenReference
      scale="border"
      tokens={sortByValue(size.border)}
      renderToken={({value}) => (
        <Container
          as="div"
          style={{
            boxSizing: 'border-box',
            width: '48px',
            height: value,
            background: theme.tokens.border.accent.vibrant,
          }}
        />
      )}
    />
  );
}

export function ShadowOffset() {
  const theme = useTheme();
  return (
    <Storybook.TokenReference
      scale="shadow"
      tokens={theme.shadow}
      renderToken={({value}) => (
        <Container
          as="div"
          style={{
            boxSizing: 'border-box',
            width: '32px',
            height: '32px',
            background: theme.tokens.background.primary,
            boxShadow: `${value}`,
          }}
          border="accent"
          radius="xs"
        />
      )}
    />
  );
}

export function BackgroundColors() {
  const theme = useTheme();
  const bg = theme.tokens.background;
  const groups: ColorGroup[] = [
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
    {
      label: 'transparent',
      tokens: flattenTokens(bg.transparent),
    },
  ];
  return (
    <Storybook.ColorReference
      scale="background"
      groups={groups}
      fill
      renderToken={({value}) => (
        <Container
          as="div"
          style={{
            boxSizing: 'border-box',
            width: '100%',
            height: '48px',
            background: value,
          }}
          border="muted"
          radius="sm"
        />
      )}
    />
  );
}

export function ContentColors() {
  const theme = useTheme();
  const ct = theme.tokens.content;
  const groups: ColorGroup[] = [
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
  return (
    <Storybook.ColorReference
      scale="content"
      groups={groups}
      renderToken={({value}) => (
        <Text size="xl" style={{color: value}}>
          Aa
        </Text>
      )}
    />
  );
}

export function BorderColors() {
  const theme = useTheme();
  const bd = theme.tokens.border;
  const groups: ColorGroup[] = [
    {
      label: 'base',
      tokens: {
        primary: bd.primary,
        secondary: bd.secondary,
      },
    },
    {label: 'neutral', tokens: flattenTokens(bd.neutral)},
    {label: 'accent', tokens: flattenTokens(bd.accent)},
    {label: 'promotion', tokens: flattenTokens(bd.promotion)},
    {label: 'danger', tokens: flattenTokens(bd.danger)},
    {label: 'warning', tokens: flattenTokens(bd.warning)},
    {label: 'success', tokens: flattenTokens(bd.success)},
    {label: 'onVibrant', tokens: flattenTokens(bd.onVibrant)},
  ];
  return (
    <Storybook.ColorReference
      scale="border"
      list
      groups={groups}
      renderToken={({value}) => (
        <Container
          as="div"
          background="primary"
          style={{
            boxSizing: 'border-box',
            width: '24px',
            height: '24px',
            borderRadius: '4px',
            marginLeft: '-8px',
            border: `2px solid ${value}`,
          }}
          radius="sm"
        />
      )}
    />
  );
}

export function GraphicsColors() {
  const theme = useTheme();
  const gx = theme.tokens.graphics;
  const groups: ColorGroup[] = [
    {label: 'neutral', tokens: flattenTokens(gx.neutral)},
    {label: 'accent', tokens: flattenTokens(gx.accent)},
    {label: 'promotion', tokens: flattenTokens(gx.promotion)},
    {label: 'danger', tokens: flattenTokens(gx.danger)},
    {label: 'warning', tokens: flattenTokens(gx.warning)},
    {label: 'success', tokens: flattenTokens(gx.success)},
  ];
  return (
    <Storybook.ColorReference
      scale="graphics"
      list
      groups={groups}
      renderToken={({value}) => (
        <Container
          as="div"
          style={{
            boxSizing: 'border-box',
            width: '24px',
            height: '24px',
            background: value,
            borderRadius: '50%',
          }}
        />
      )}
    />
  );
}

export function ShadowColors() {
  const theme = useTheme();
  const groups: ColorGroup[] = [
    {
      label: 'elevation',
      tokens: {
        low: theme.shadow.low,
        medium: theme.shadow.medium,
        high: theme.shadow.high,
      },
    },
  ];
  return (
    <Storybook.ColorReference
      scale="shadow"
      groups={groups}
      renderToken={({value}) => (
        <Container
          as="div"
          style={{
            boxSizing: 'border-box',
            width: '40px',
            height: '40px',
            background: theme.tokens.background.overlay,
            boxShadow: value,
          }}
          border="primary"
          radius="md"
        />
      )}
    />
  );
}

export function FocusColors() {
  const theme = useTheme();
  const fc = theme.tokens.focus;
  const groups: ColorGroup[] = [
    {
      label: 'states',
      tokens: {
        default: fc.default,
        invalid: fc.invalid,
      },
    },
    {
      label: 'onVibrant',
      tokens: {
        'onVibrant.light': fc.onVibrant.light,
        'onVibrant.dark': fc.onVibrant.dark,
      },
    },
  ];
  return (
    <Storybook.ColorReference
      scale="focus"
      groups={groups}
      renderToken={({value}) => (
        <Container
          as="div"
          style={{
            boxSizing: 'border-box',
            width: '40px',
            height: '40px',
            background: theme.tokens.background.primary,
            outline: `2px solid ${value}`,
            outlineOffset: '2px',
          }}
          radius="sm"
        />
      )}
    />
  );
}

export function DatavizCategoricalColors() {
  const theme = useTheme();
  const categorical = theme.tokens.dataviz.categorical;
  const fullPalette = categorical[categorical.length - 1] ?? [];
  const tokens = Object.fromEntries(fullPalette.map((value, i) => [String(i), value]));
  const groups: ColorGroup[] = [{tokens}];
  return (
    <Storybook.ColorReference
      scale="dataviz.categorical"
      groups={groups}
      renderToken={({value}) => (
        <Container
          as="div"
          style={{
            boxSizing: 'border-box',
            width: '24px',
            height: '24px',
            background: value,
            borderRadius: '50%',
          }}
        />
      )}
    />
  );
}

export function DatavizSemanticColors() {
  const theme = useTheme();
  const semantic = theme.tokens.dataviz.semantic;
  const groups: ColorGroup[] = [
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
  return (
    <Storybook.ColorReference
      scale="dataviz.semantic"
      groups={groups}
      renderToken={({value}) => (
        <Container
          as="div"
          style={{
            boxSizing: 'border-box',
            width: '24px',
            height: '24px',
            background: value,
            borderRadius: '50%',
          }}
        />
      )}
    />
  );
}
