import {useTheme} from '@emotion/react';

import {Container, type ContainerProps} from '@sentry/scraps/layout';

export interface ContentProps extends Omit<
  ContainerProps<'main'>,
  'as' | 'containerType' | 'margin' | 'marginLeft' | 'marginRight' | 'maxWidth'
> {
  variant: 'center' | 'full';
}

export function Content({variant, ...props}: ContentProps) {
  const theme = useTheme();

  return (
    <Container
      as="main"
      containerType="inline-size"
      margin={variant === 'center' ? '0 auto' : undefined}
      padding={{zero: '0 md', xl: '0'}}
      width="100%"
      maxWidth={
        variant === 'center'
          ? {
              zero: '100%',
              xl: theme.size['2xl'],
              '2xl': theme.size['3xl'],
              '3xl': theme.size['4xl'],
            }
          : undefined
      }
      {...props}
    />
  );
}
