import discord from 'sentry-logos/logo-discord.svg';
import msteams from 'sentry-logos/logo-msteams.svg';
import slack from 'sentry-logos/logo-slack.svg';

import {Image} from '@sentry/scraps/image';

import type {ScmMessagingProviderKey} from 'sentry/components/onboarding/scm/messagingProviders';

const LOGOS: Record<ScmMessagingProviderKey, string> = {
  slack,
  discord,
  msteams,
};

interface ProviderLogoProps {
  providerKey: ScmMessagingProviderKey;
  size?: number;
}

/**
 * The provider's logo on a transparent background. `PluginIcon` paints a white
 * square behind every logo, which stands out against dark surfaces; these
 * SVGs carry their own colors and need no backdrop.
 */
export function ProviderLogo({providerKey, size = 28}: ProviderLogoProps) {
  return (
    <Image
      src={LOGOS[providerKey]}
      alt=""
      width={`${size}px`}
      height={`${size}px`}
      objectFit="contain"
    />
  );
}
