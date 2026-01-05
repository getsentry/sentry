import * as Sentry from '@sentry/react';

import {IconBitbucket} from 'sentry/icons/iconBitbucket';
import {IconGithub} from 'sentry/icons/iconGithub';
import {IconGitlab} from 'sentry/icons/iconGitlab';
import {IconOpen} from 'sentry/icons/iconOpen';
import {IconVsts} from 'sentry/icons/iconVsts';
import type {SVGIconProps} from 'sentry/icons/svgIcon';

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
};

interface Props extends SVGIconProps {
  provider: keyof typeof PROVIDER_ICONS | (string & {});
}

export default function RepoProviderIcon({provider, ...props}: Props) {
  if (provider in PROVIDER_ICONS) {
    const Icon = PROVIDER_ICONS[provider as keyof typeof PROVIDER_ICONS];
    return <Icon {...props} />;
  }
  Sentry.logger.error(`Unknown provider in RepoProviderIcon`, {provider});
  return <IconOpen {...props} />;
}
