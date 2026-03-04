import type React from 'react';
import styled from '@emotion/styled';

import {Image} from '@sentry/scraps/image';

// eslint-disable-next-line no-relative-import-paths/no-relative-import-paths
import {baseAvatarStyles, type BaseAvatarStyleProps} from '../avatarComponentStyles';

/**
 * Note that avatars currently do not support refs. This is because they are only exposed
 * through the main Avatar component, which wraps the avatar in a container element, and has
 * histrically hijacked the ref and attached it to the container element, and we would need
 * to eliminate the wrapper before we can enable ref support.
 */
interface ImageAvatarProps extends BaseAvatarStyleProps {
  alt: string;
  ref: React.RefCallback<HTMLImageElement>;
  src: string;
}

export function ImageAvatar({src, ref, alt, ...props}: ImageAvatarProps) {
  return <StyledImage ref={ref} src={src} alt={alt} {...props} />;
}

const StyledImage = styled(Image)<BaseAvatarStyleProps>`
  ${baseAvatarStyles};
`;
