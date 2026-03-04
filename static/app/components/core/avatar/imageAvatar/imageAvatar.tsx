import type React from 'react';
import styled from '@emotion/styled';

import {Image} from '@sentry/scraps/image';

// eslint-disable-next-line no-relative-import-paths/no-relative-import-paths
import {baseAvatarStyles, type BaseAvatarStyleProps} from '../avatarComponentStyles';

interface ImageAvatarProps extends BaseAvatarStyleProps {
  alt: string;
  ref: React.Ref<HTMLImageElement>;
  src: string;
}

export function ImageAvatar({src, ref, alt, ...props}: ImageAvatarProps) {
  return <StyledImage ref={ref} src={src} alt={alt} {...props} />;
}

const StyledImage = styled(Image)<BaseAvatarStyleProps>`
  ${baseAvatarStyles};
`;
