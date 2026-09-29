/* eslint-disable @sentry/scraps/use-semantic-token */
import {useTheme} from '@emotion/react';

import {Container, Flex} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import * as Storybook from 'sentry/stories';
import {BORDER_WIDTHS, TOKEN_REFERENCES} from 'sentry/stories/tokenDefinitions';

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
          radius={token}
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
            <Heading as="h4" size={token} variant="accent">
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
          style={{fontWeight: value}}
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
          <Text size="md" density={token} variant="accent">
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
      tokens={BORDER_WIDTHS}
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
            boxShadow: value,
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
  const reference = TOKEN_REFERENCES.background;
  return (
    <Storybook.ColorReference
      scale={reference.scale}
      groups={reference.groups(theme)}
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
  const reference = TOKEN_REFERENCES.content;
  return (
    <Storybook.ColorReference
      scale={reference.scale}
      groups={reference.groups(theme)}
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
  const reference = TOKEN_REFERENCES.border;
  return (
    <Storybook.ColorReference
      scale={reference.scale}
      list
      groups={reference.groups(theme)}
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
  const reference = TOKEN_REFERENCES.graphics;
  return (
    <Storybook.ColorReference
      scale={reference.scale}
      list
      groups={reference.groups(theme)}
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
  const reference = TOKEN_REFERENCES.shadow;
  return (
    <Storybook.ColorReference
      scale={reference.scale}
      groups={reference.groups(theme)}
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
  const reference = TOKEN_REFERENCES.focus;
  return (
    <Storybook.ColorReference
      scale={reference.scale}
      groups={reference.groups(theme)}
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
  const reference = TOKEN_REFERENCES.categorical;
  return (
    <Storybook.ColorReference
      scale={reference.scale}
      groups={reference.groups(theme)}
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
  const reference = TOKEN_REFERENCES.semantic;
  return (
    <Storybook.ColorReference
      scale={reference.scale}
      groups={reference.groups(theme)}
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
