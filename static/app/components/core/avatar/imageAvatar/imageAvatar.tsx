import styled from '@emotion/styled';

import {Image, type ImageProps} from '@sentry/scraps/image';

// eslint-disable-next-line no-relative-import-paths/no-relative-import-paths
import {baseAvatarStyles, type BaseAvatarStyleProps} from '../avatarComponentStyles';

export interface ImageAvatarProps
  extends BaseAvatarStyleProps, Omit<ImageProps, 'alt' | 'ref' | 'src'> {
  configuration: {
    alt: string & {__avatar: boolean};
    ref: React.Ref<HTMLImageElement>;
    src: string & {__avatar: boolean};
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
