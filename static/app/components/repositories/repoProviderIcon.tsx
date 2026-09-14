import * as Sentry from '@sentry/react';

import {IconBitbucket} from 'sentry/icons/iconBitbucket';
import {IconGithub} from 'sentry/icons/iconGithub';
import {IconGitlab} from 'sentry/icons/iconGitlab';
import {IconOpen} from 'sentry/icons/iconOpen';
import {IconVsts} from 'sentry/icons/iconVsts';
import {PluginIcon} from 'sentry/icons/pluginIcon';
import type {SVGIconProps} from 'sentry/icons/svgIcon';

/**
 * sentry/icons has no monochrome brand glyph for Cursor, so the real logo asset is
 * used instead. `PluginIcon` sizes in pixels while the icon map speaks `IconSize`
 * tokens, so the two are bridged here rather than at every call site.
 * `getIntegrationIcon` does the same thing for the same reason.
 */
function IconCursor({size = 'md'}: SVGIconProps) {
  return <PluginIcon pluginId="cursor" size={size === 'sm' || size === 'xs' ? 14 : 20} />;
}

const PROVIDER_ICONS = {
  github: IconGithub,
  'integrations:github': IconGithub,
  'integrations:github_enterprise': IconGithub,
  bitbucket: IconBitbucket,
  'integrations:bitbucket': IconBitbucket,
  visualstudio: IconVsts,
  'integrations:vsts': IconVsts,
  gitlab: IconGitlab,
  'integrations:gitlab': IconGitlab,
  cursor_origin: IconCursor,
  'integrations:cursor_origin': IconCursor,
};

interface Props extends SVGIconProps {
  provider: keyof typeof PROVIDER_ICONS | (string & {});
}

export function RepoProviderIcon({provider, ...props}: Props) {
  if (provider in PROVIDER_ICONS) {
    const Icon = PROVIDER_ICONS[provider as keyof typeof PROVIDER_ICONS];
    return <Icon {...props} />;
  }
  Sentry.logger.error('Unknown provider in RepoProviderIcon', {provider});
  return <IconOpen {...props} />;
}
