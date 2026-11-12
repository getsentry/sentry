import type {ReactNode} from 'react';
import {css, useTheme, type Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {Container} from '@sentry/scraps/layout';
// eslint-disable-next-line @sentry/scraps/no-token-import -- the brand stack uses named categorical colors the theme does not expose
import {color} from '@sentry/scraps/tokens';

interface SetupCardFrameProps {
  children: ReactNode;
  /** Tilts the card and adds the stacked brand drop shadow. */
  layered: boolean;
}

export function SetupCardFrame({children, layered}: SetupCardFrameProps) {
  const theme = useTheme();

  return (
    <Container width="100%" style={layered ? {transform: 'rotate(-1deg)'} : undefined}>
      <Container
        background={theme.type === 'dark' ? 'secondary' : 'primary'}
        border={layered ? undefined : 'primary'}
        radius="xl"
        padding="2xl"
        position="relative"
        width="100%"
        overflow="hidden"
      >
        {surfaceProps =>
          layered ? (
            <LayeredSurface {...surfaceProps}>{children}</LayeredSurface>
          ) : (
            <div {...surfaceProps}>{children}</div>
          )
        }
      </Container>
    </Container>
  );
}

function getLayerColors(theme: Theme) {
  if (theme.type === 'dark') {
    return {
      accent: color.categorical.dark.blurple,
      middle: color.categorical.dark.magenta,
      bottom: color.categorical.dark.salmon,
    };
  }

  return {
    accent: color.blue.light.opaque1100,
    middle: color.categorical.light.magenta,
    bottom: color.categorical.light.salmon,
  };
}

const LayeredSurface = styled('div')`
  ${p => {
    const layers = getLayerColors(p.theme);
    return css`
      border: 1px solid ${layers.accent};
      box-shadow:
        0 2px 0 ${layers.accent},
        0 6px 0 ${layers.middle},
        0 10px 0 ${layers.bottom};
    `;
  }}
`;
