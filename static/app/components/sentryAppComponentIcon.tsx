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
function SentryAppComponentIcon({sentryAppComponent}: Props) {
  const selectedAvatar = sentryAppComponent.sentryApp?.avatars?.find(
    ({color}) => color === false
  );
  const isDefault = selectedAvatar?.avatarType !== 'upload';
  const isDisabled = sentryAppComponent.error;
  return (
    <SentryAppAvatarWrapper
      isDark={ConfigStore.get('theme') === 'dark'}
      isDefault={isDefault}
      isDisabled={isDisabled}
    >
      <SentryAppAvatar
        sentryApp={sentryAppComponent.sentryApp}
        size={20}
        isColor={false}
      />
    </SentryAppAvatarWrapper>
  );
}

export default SentryAppComponentIcon;

const SentryAppAvatarWrapper = styled('span')<{
  isDark: boolean;
  isDefault: boolean;
  isDisabled?: boolean;
}>`
  color: ${({isDark, isDisabled, theme}) =>
    isDisabled ? theme.disabled : isDark ? 'white' : 'black'};
  filter: ${p => (p.isDark && !p.isDefault ? 'invert(1)' : 'invert(0)')};
  line-height: 0;
  flex-shrink: 0;
`;
