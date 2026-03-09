import styled from '@emotion/styled';
import type {Tagged} from 'type-fest';

import {Image, type ImageProps} from '@sentry/scraps/image';

// eslint-disable-next-line no-relative-import-paths/no-relative-import-paths
import {baseAvatarStyles, type BaseAvatarStyleProps} from '../avatarComponentStyles';

export interface ImageAvatarProps
  extends BaseAvatarStyleProps, Omit<ImageProps, 'alt' | 'ref' | 'src'> {
  configuration: {
    alt: Tagged<string, '__avatar'>;
    ref: React.Ref<HTMLImageElement>;
    src: Tagged<string, '__avatar'>;
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
