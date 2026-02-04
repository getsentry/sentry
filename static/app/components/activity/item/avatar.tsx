import {ThemeProvider} from '@emotion/react';
import styled from '@emotion/styled';

import {UserAvatar} from '@sentry/scraps/avatar';
import {Flex} from '@sentry/scraps/layout';

import Placeholder from 'sentry/components/placeholder';
import {IconSentry} from 'sentry/icons';
import type {AvatarUser} from 'sentry/types/user';
import {useInvertedTheme} from 'sentry/utils/theme/useInvertedTheme';

type Props = {
  type: 'system' | 'user';
  className?: string;
  size?: number;
  user?: AvatarUser;
};

export function ActivityAvatar({className, type, user, size = 38}: Props) {
  const invertedTheme = useInvertedTheme();
  if (user) {
    return <UserAvatar user={user} size={size} className={className} />;
  }

  if (type === 'system') {
    return (
      <ThemeProvider theme={invertedTheme}>
        <Flex
          className={className}
          align="center"
          justify="center"
          width={`${size}px`}
          height={`${size}px`}
          color="primary"
          background="primary"
          radius="full"
        >
          <StyledIconSentry size="md" />
        </Flex>
      </ThemeProvider>
    );
  }

  return (
    <Placeholder
      className={className}
      width={`${size}px`}
      height={`${size}px`}
      shape="circle"
    />
  );
}

const StyledIconSentry = styled(IconSentry)`
  padding-bottom: 3px;
`;
