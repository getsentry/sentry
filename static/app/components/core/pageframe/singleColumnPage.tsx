import {useTheme} from '@emotion/react';

import {Container, type ContainerProps} from '@sentry/scraps/layout';

import {unreachable} from 'sentry/utils/unreachable';

export interface SingleColumnPageProps extends Omit<
  ContainerProps<'main'>,
  'as' | 'containerType' | 'margin' | 'marginLeft' | 'marginRight' | 'maxWidth' | 'width'
> {
  width: 'narrow' | 'wide' | 'full';
}

const defaultProps: ContainerProps<'main'> = {
  as: 'main',
  containerType: 'inline-size',
  flexGrow: 1,
  padding: {zero: '0 md', xl: '0'},
  width: '100%',
};

const useVariantProps = ({width}: SingleColumnPageProps): ContainerProps<'main'> => {
  const theme = useTheme();

  switch (width) {
    case 'narrow':
      return {
        margin: '0 auto',
        maxWidth: theme.size['4xl'],
      };
    case 'wide':
      return {
        margin: '0 auto',
        maxWidth: theme.size['7xl'],
      };
    case 'full':
      return {};
    default:
      return unreachable(width);
  }
};

export function SingleColumnPage({width, ...props}: SingleColumnPageProps) {
  const variantProps = useVariantProps({width});

  return <Container {...defaultProps} {...variantProps} {...props} />;
}
