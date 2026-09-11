import styled from '@emotion/styled';

import type {CSS} from '@sentry/scraps/cssTypes';
import type {Responsive} from '@sentry/scraps/layout';
import {getRadius, rc} from '@sentry/scraps/layout';

import type {RadiusSize} from 'sentry/utils/theme';

export interface ImageProps extends Omit<
  React.ImgHTMLAttributes<HTMLImageElement>,
  'height' | 'width'
> {
  alt: string;
  src: string;
  aspectRatio?: CSS['aspectRatio'];
  height?: Responsive<CSS['height']>;
  /**
   * Determines if the image should be loaded eagerly or lazily.
   * @default 'lazy'
   */
  loading?: 'eager' | 'lazy';
  objectFit?: 'contain' | 'cover';
  objectPosition?: 'center' | 'top' | 'bottom' | 'left' | 'right' | (string & {});
  radius?: Responsive<RadiusSize>;
  ref?: React.Ref<HTMLImageElement>;
  width?: Responsive<CSS['width']>;
}

export function Image({loading, width, height, ...props}: ImageProps) {
  return <Img loading={loading ?? 'lazy'} w={width} h={height} {...props} />;
}

const Img = styled('img')<
  Omit<ImageProps, 'width' | 'height'> & {
    h?: Responsive<CSS['height']>;
    w?: Responsive<CSS['width']>;
  }
>`
  ${p => rc('width', p.w ?? '100%', p.theme)};
  ${p => rc('height', p.h ?? 'auto', p.theme)};
  object-fit: ${p => p.objectFit};
  object-position: ${p => p.objectPosition};
  aspect-ratio: ${p => p.aspectRatio};
  ${p => rc('border-radius', p.radius, p.theme, getRadius)};
`;
