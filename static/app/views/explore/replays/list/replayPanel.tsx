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
        justify="center"
        margin={{zero: '0', xl: '0 auto'}}
        maxWidth={{xl: '1000px'}}
        minHeight={{xl: '300px', '3xl': '350px'}}
        padding="2xl"
        position="relative"
        wrap="wrap"
      >
        {image ? (
          <Container
            flex={{xl: 1}}
            margin={{zero: 'xl auto', xl: '2xl'}}
            maxWidth="300px"
            minHeight="100px"
            minWidth="150px"
          >
            {image}
          </Container>
        ) : null}
        <Container
          flex={{xl: 2}}
          minWidth="0"
          style={
            !image && !noCenter
              ? {zIndex: 1, textAlign: 'center', maxWidth: '600px'}
              : {zIndex: 1}
          }
        >
          {children}
        </Container>
      </Flex>
    </Panel>
  );
}
