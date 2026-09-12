import styled from '@emotion/styled';
import discord from 'sentry-logos/logo-discord.svg';
import msteams from 'sentry-logos/logo-msteams.svg';
import slack from 'sentry-logos/logo-slack.svg';

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
  return <Logo role="img" aria-hidden src={LOGOS[providerKey]} size={size} />;
}

const Logo = styled('div')<{size: number; src: string}>`
  width: ${p => p.size}px;
  height: ${p => p.size}px;
  flex-shrink: 0;
  background-image: url(${p => p.src});
  background-size: contain;
  background-position: center;
  background-repeat: no-repeat;
`;
