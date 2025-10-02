import styled from '@emotion/styled';

interface ImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  alt: string;
  src: string;
  fit?: 'contain' | 'cover';
  height?: string;
  /**
   * Determines if the image should be loaded eagerly or lazily.
   * @default 'lazy'
   */
  loading?: 'eager' | 'lazy';
  ref?: React.Ref<HTMLImageElement>;
  width?: string;
}

export function Image({loading, ...props}: ImageProps) {
  return <Img loading={loading ?? 'lazy'} {...props} />;
}

const Img = styled('img')<ImageProps>`
  object-fit: ${p => p.fit ?? 'contain'};
  width: ${p => p.width ?? '100%'};
  height: ${p => p.height ?? '100%'};
`;
