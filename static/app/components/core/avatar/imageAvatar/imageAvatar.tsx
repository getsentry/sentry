import {useLayoutEffect, useState} from 'react';
import styled from '@emotion/styled';
import {mergeProps} from '@react-aria/utils';

import {Image} from '@sentry/scraps/image';

// eslint-disable-next-line no-relative-import-paths/no-relative-import-paths
import {baseAvatarStyles, type BaseAvatarStyleProps} from '../avatarComponentStyles';
// eslint-disable-next-line no-relative-import-paths/no-relative-import-paths
import {LetterAvatar} from '../letterAvatar/letterAvatar';

/**
 * Note that avatars currently do not support refs. This is because they are only exposed
 * through the main Avatar component, which wraps the avatar in a container element, and has
 * histrically hijacked the ref and attached it to the container element, and we would need
 * to eliminate the wrapper before we can enable ref support.
 */
export interface ImageAvatarProps extends BaseAvatarStyleProps {
  identifier: string;
  name: string;
  src: string;
}

export function ImageAvatar({src, identifier, name, ...props}: ImageAvatarProps) {
  const [error, setError] = useState(false);

  useLayoutEffect(() => {
    setError(false);
  }, [src]);

  // If we do not have a src, or if we failed to load the image, show a letter avatar.
  if (!src || error) {
    return <LetterAvatar identifier={identifier} name={name} {...props} />;
  }

  return (
    <StyledImage
      src={src}
      alt={name}
      {...mergeProps(props, {onError: () => setError(true)})}
    />
  );
}

const StyledImage = styled(Image)<BaseAvatarStyleProps>`
  ${baseAvatarStyles};
`;
