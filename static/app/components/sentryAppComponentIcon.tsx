import styled from '@emotion/styled';

import SentryAppAvatar from 'sentry/components/avatar/sentryAppAvatar';
import ConfigStore from 'sentry/stores/configStore';
import {SentryAppComponent} from 'sentry/types';

type Props = {
  sentryAppComponent: SentryAppComponent;
};

/**
 * Icon Renderer for SentryAppComponents with UI
 * (e.g. Issue Linking, Stacktrace Linking)
 */
const SentryAppComponentIcon = ({sentryAppComponent: {sentryApp}}: Props) => {
  const selectedAvatar = sentryApp?.avatars?.find(({color}) => color === false);
  const isDefault = selectedAvatar?.avatarType !== 'upload';
  return (
    <SentryAppAvatarWrapper
      isDark={ConfigStore.get('theme') === 'dark'}
      isDefault={isDefault}
    >
      <SentryAppAvatar sentryApp={sentryApp} size={20} isColor={false} />
    </SentryAppAvatarWrapper>
  );
};

export default SentryAppComponentIcon;

const SentryAppAvatarWrapper = styled('span')<{isDark: boolean; isDefault: boolean}>`
  color: ${({isDark}) => (isDark ? 'white' : 'black')};
  filter: ${p => (p.isDark && !p.isDefault ? 'invert(1)' : 'invert(0)')};
  line-height: 0;
  flex-shrink: 0;
`;
