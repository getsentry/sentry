import {useTheme} from '@emotion/react';

import {Container, type ContainerProps} from '@sentry/scraps/layout';

export interface SingleColumnPageProps extends Omit<
  ContainerProps<'main'>,
  'as' | 'containerType' | 'margin' | 'marginLeft' | 'marginRight' | 'maxWidth' | 'width'
> {
  width: 'narrow' | 'wide' | 'full';
}

export function SingleColumnPage({width, ...props}: SingleColumnPageProps) {
  const theme = useTheme();
  const isConstrained = width !== 'full';

  return (
    <Container
      as="main"
      containerType="inline-size"
      flexGrow={1}
      background="primary"
      margin={isConstrained ? '0 auto' : undefined}
      padding={{zero: '0 md', xl: '0'}}
      width="100%"
      maxWidth={
        width === 'narrow'
          ? {
              zero: '100%',
              xl: theme.size['2xl'],
              '2xl': theme.size['3xl'],
              '3xl': theme.size['4xl'],
            }
          : width === 'wide'
            ? theme.size['7xl']
            : undefined
      }
      {...props}
    />
  );
}
