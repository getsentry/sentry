import styled from '@emotion/styled';

import SentryAppAvatar from 'sentry/components/avatar/sentryAppAvatar';
import ConfigStore from 'sentry/stores/configStore';
import type {SentryAppComponent} from 'sentry/types/integrations';

type Props = {
  sentryAppComponent: SentryAppComponent;
  size?: number;
};

/**
 * Icon Renderer for SentryAppComponents with UI
 * (e.g. Issue Linking, Stacktrace Linking)
 */
function SentryAppComponentIcon({sentryAppComponent, size = 20}: Props) {
  const selectedAvatar = sentryAppComponent.sentryApp?.avatars?.find(
    ({color}) => color === false
  );
  const isDefault = selectedAvatar?.avatarType !== 'upload';
  const isDisabled = sentryAppComponentIsDisabled(sentryAppComponent);

  return (
    <SentryAppAvatarWrapper
      isDark={ConfigStore.get('theme') === 'dark'}
      isDefault={isDefault}
      isDisabled={isDisabled}
    >
      <SentryAppAvatar
        sentryApp={sentryAppComponent.sentryApp}
        size={size}
        isColor={false}
      />
    </SentryAppAvatarWrapper>
  );
}

// Patch for backwards compatibility as the change's truth table is inverse to the previous'
export const sentryAppComponentIsDisabled = (component: SentryAppComponent) => {
  return typeof component.error === 'boolean' ? component.error : !component.error;
};

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
