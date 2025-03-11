import {forwardRef} from 'react';

import {BaseAvatar, type BaseAvatarProps} from 'sentry/components/core/avatar/baseAvatar';
import PluginIcon from 'sentry/plugins/components/pluginIcon';
import type {DocIntegration} from 'sentry/types/integrations';

export interface DocIntegrationAvatarProps extends BaseAvatarProps {
  docIntegration?: DocIntegration;
}

export const DocIntegrationAvatar = forwardRef<
  HTMLSpanElement,
  DocIntegrationAvatarProps
>(({docIntegration, ...props}, ref) => {
  if (!docIntegration?.avatar) {
    // @TODO(jonasbadalic): This is not passing a ref!
    return <PluginIcon size={props.size} pluginId={docIntegration?.slug} />;
  }

  return (
    <BaseAvatar
      {...props}
      ref={ref}
      type="upload"
      uploadUrl={docIntegration.avatar.avatarUrl}
      title={docIntegration.name}
    />
  );
});
