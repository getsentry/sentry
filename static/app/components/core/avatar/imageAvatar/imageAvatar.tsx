import styled from '@emotion/styled';

import {Image} from '@sentry/scraps/image';

// eslint-disable-next-line no-relative-import-paths/no-relative-import-paths
import {baseAvatarStyles, type BaseAvatarStyleProps} from '../avatarComponentStyles';

export const ImageAvatar = styled(Image)<BaseAvatarStyleProps>`
  ${baseAvatarStyles};
`;
