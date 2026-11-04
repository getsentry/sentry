import type * as React from 'react';
import styled from '@emotion/styled';

// eslint-disable-next-line @sentry/no-relative-import-paths
import {
  baseAvatarStyles,
  type BaseAvatarStyleProps,
} from '@sentry/scraps/avatar/avatarComponentStyles';
import {Image, type ImageProps} from '@sentry/scraps/image';

export interface ImageAvatarProps
  extends BaseAvatarStyleProps, Omit<ImageProps, 'alt' | 'ref' | 'src'> {
  configuration: {
    alt: string;
    ref: React.Ref<HTMLImageElement>;
    src: string;
  };
}

export const ImageAvatar = styled(({configuration, ...props}: ImageAvatarProps) => (
  <Image
    ref={configuration.ref}
    src={configuration.src}
    alt={configuration.alt}
    {...props}
  />
))<BaseAvatarStyleProps>`
  ${baseAvatarStyles};
`;
