import styled from '@emotion/styled';

import {Container, Flex} from '@sentry/scraps/layout';

import {Panel} from 'sentry/components/panels/panel';

interface Props extends React.ComponentProps<typeof Panel> {
  children: React.ReactNode;
  image?: React.ReactNode;
  noCenter?: boolean;
}

export function ReplayPanel({image, noCenter, children, ...props}: Props) {
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
            {imageProps => <IlloBox {...imageProps}>{image}</IlloBox>}
          </Container>
        ) : null}
        <Container flex={{xl: 2}} minWidth="0">
          {contentProps => (
            <StyledBox {...contentProps} centered={!image && !noCenter}>
              {children}
            </StyledBox>
          )}
        </Container>
      </Flex>
    </Panel>
  );
}

const StyledBox = styled('div')<{centered?: boolean}>`
  z-index: 1;

  ${p => (p.centered ? 'text-align: center;' : '')}
  ${p => (p.centered ? 'max-width: 600px;' : '')}
`;

const IlloBox = styled(StyledBox)`
  margin: ${p => p.theme.space.xl} auto;

  @container (min-width: ${p => p.theme.container.xl}) {
    margin: 120px ${p => p.theme.space['2xl']} ${p => p.theme.space['2xl']}
      ${p => p.theme.space['2xl']};
  }
`;
