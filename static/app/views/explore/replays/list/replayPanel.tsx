import {useTheme} from '@emotion/react';

import {Container, Flex, useResponsivePropValue} from '@sentry/scraps/layout';

import {Panel} from 'sentry/components/panels/panel';

interface Props extends React.ComponentProps<typeof Panel> {
  children: React.ReactNode;
  image?: React.ReactNode;
  noCenter?: boolean;
}

export function ReplayPanel({image, noCenter, children, ...props}: Props) {
  const theme = useTheme();
  const illustrationMargin = useResponsivePropValue({
    zero: `${theme.space.xl} auto`,
    xl: `120px ${theme.space['2xl']} ${theme.space['2xl']}`,
  });
  const isCentered = !image && !noCenter;

  return (
    <Panel {...props}>
      <Flex
        align={{zero: 'stretch', xl: 'start'}}
        direction={{zero: 'column', xl: 'row'}}
        justify={{zero: 'start', xl: 'center'}}
        margin={{xl: '0 auto'}}
        maxWidth={{xl: 1000}}
        minHeight={{xl: 300, '3xl': 350}}
        padding="2xl"
        position="relative"
        wrap="wrap"
      >
        {image ? (
          <Container
            flex={{xl: 1}}
            maxWidth={300}
            minHeight={100}
            minWidth={150}
            position="relative"
          >
            {imageProps => (
              <Container {...imageProps} style={{margin: illustrationMargin}}>
                {image}
              </Container>
            )}
          </Container>
        ) : null}
        <Container flex={{xl: 2}} minWidth="0">
          {contentProps => (
            <Container
              {...contentProps}
              maxWidth={isCentered ? 600 : undefined}
              style={{textAlign: isCentered ? 'center' : undefined, zIndex: 1}}
            >
              {children}
            </Container>
          )}
        </Container>
      </Flex>
    </Panel>
  );
}
