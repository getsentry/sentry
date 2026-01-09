import type {CSSProperties} from 'react';
import styled from '@emotion/styled';

interface ImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  alt: string;
  src: string;
  aspectRatio?: CSSProperties['aspectRatio'];
  height?: string;
  /**
   * Determines if the image should be loaded eagerly or lazily.
   * @default 'lazy'
   */
  loading?: 'eager' | 'lazy';
  objectFit?: 'contain' | 'cover';
  objectPosition?: 'center' | 'top' | 'bottom' | 'left' | 'right' | (string & {});
  ref?: React.Ref<HTMLImageElement>;
  width?: string;
}

export function Image({loading, ...props}: ImageProps) {
  return <Img loading={loading ?? 'lazy'} {...props} />;
}

const Img = styled('img')<ImageProps>`
  width: ${p => p.width ?? '100%'};
  height: ${p => p.height ?? 'auto'};
  object-fit: ${p => p.objectFit};
  object-position: ${p => p.objectPosition};
  ${p => p.aspectRatio && `aspect-ratio: ${p.aspectRatio}`};
`;
