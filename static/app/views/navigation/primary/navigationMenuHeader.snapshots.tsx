// oxlint-disable-next-line import/no-nodejs-modules -- Inline real logo files; snapshot tests mock image imports.
import {readFileSync} from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the logo directory.
import path from 'node:path';

import type {ReactNode} from 'react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {Container} from '@sentry/scraps/layout';

import {NavigationMenuHeader} from './navigationMenuHeader';

const LOGOS_DIR = path.resolve(
  import.meta.dirname,
  '../../../../../src/sentry/static/sentry/images/logos'
);

/**
 * Real logos from `sentry-logos`, with the color `dominantColor` samples from
 * each in Chromium. SSR never runs the canvas sampler, so the sampled color is
 * seeded into the query cache instead.
 */
const LOGOS = {
  // Full-bleed brand tile.
  sentry: {name: 'Sentry', file: 'sentry-avatar.png', sampledColor: '#e3442a'},
  // Bright yellow, where the gradient used to start near black.
  firefox: {name: 'Firefox', file: 'logo-firefox.svg', sampledColor: '#ffd744'},
  gitlab: {name: 'GitLab', file: 'logo-gitlab.svg', sampledColor: '#fc7125'},
  slack: {name: 'Slack', file: 'logo-slack.svg', sampledColor: '#e01e5a'},
  discord: {name: 'Discord', file: 'logo-discord.svg', sampledColor: '#5865f2'},
  datadog: {name: 'Datadog', file: 'logo-datadog.svg', sampledColor: '#632ca6'},
  // Already darker than the default gradient.
  segment: {name: 'Segment', file: 'logo-segment.svg', sampledColor: '#12424a'},
  // Neutral: no colored pixels, so the sampler returns black and the header
  // keeps its default gradient.
  github: {name: 'GitHub', file: 'logo-github.svg', sampledColor: '#000000'},
};

type LogoName = keyof typeof LOGOS;

function logoDataUrl(file: string): string {
  const mime = file.endsWith('.svg') ? 'image/svg+xml' : 'image/png';
  return `data:${mime};base64,${readFileSync(path.join(LOGOS_DIR, file)).toString('base64')}`;
}

function uploadedAvatarOrganization(name: string, avatarUrl: string) {
  return OrganizationFixture({
    name,
    slug: name.toLowerCase(),
    avatar: {avatarType: 'upload', avatarUuid: null, avatarUrl},
  });
}

function sampledQueryClient(avatarUrl?: string, sampledColor?: string): QueryClient {
  // No garbage collection timers, so Jest can exit once the snapshots are taken.
  const queryClient = new QueryClient({defaultOptions: {queries: {gcTime: Infinity}}});
  if (avatarUrl && sampledColor) {
    for (const themeType of ['light', 'dark']) {
      queryClient.setQueryData(['avatar-button-chonk', avatarUrl, themeType], {
        chonk: sampledColor,
        dominant: sampledColor,
        style: 'fill',
      });
    }
  }
  return queryClient;
}

function MenuHeaderFrame({
  children,
  queryClient,
}: {
  children: ReactNode;
  queryClient: QueryClient;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <Container width="258px" padding="sm lg">
        {children}
      </Container>
    </QueryClientProvider>
  );
}

describe('NavigationMenuHeader', () => {
  it.snapshot.each<LogoName>(Object.keys(LOGOS) as LogoName[])(
    'organization-logo-%s',
    logoName => {
      const {name, file, sampledColor} = LOGOS[logoName];
      const avatarUrl = logoDataUrl(file);
      return (
        <MenuHeaderFrame queryClient={sampledQueryClient(avatarUrl, sampledColor)}>
          <NavigationMenuHeader
            organization={uploadedAvatarOrganization(name, avatarUrl)}
            projectCount={12}
          />
        </MenuHeaderFrame>
      );
    },
    logoName => ({tags: {avatar: 'image', logo: logoName, area: 'core'}})
  );

  // Before an image avatar has been sampled, the header uses its default gradient.
  it.snapshot(
    'organization-logo-unsampled',
    () => (
      <MenuHeaderFrame queryClient={sampledQueryClient()}>
        <NavigationMenuHeader
          organization={uploadedAvatarOrganization(
            'Sentry',
            logoDataUrl(LOGOS.sentry.file)
          )}
          projectCount={12}
        />
      </MenuHeaderFrame>
    ),
    {tags: {avatar: 'image', logo: 'unsampled', area: 'core'}}
  );

  it.snapshot(
    'organization-letter-avatar',
    () => (
      <MenuHeaderFrame queryClient={sampledQueryClient()}>
        <NavigationMenuHeader
          organization={OrganizationFixture({name: 'Acme', slug: 'acme'})}
          projectCount={1}
        />
      </MenuHeaderFrame>
    ),
    {tags: {avatar: 'letter', area: 'core'}}
  );

  // The user menu takes its gradient from the organization's avatar.
  it.snapshot(
    'user-with-organization-logo',
    () => {
      const avatarUrl = logoDataUrl(LOGOS.firefox.file);
      return (
        <MenuHeaderFrame
          queryClient={sampledQueryClient(avatarUrl, LOGOS.firefox.sampledColor)}
        >
          <NavigationMenuHeader
            user={UserFixture({name: 'Jane Doe', email: 'jane@example.com'})}
            organization={uploadedAvatarOrganization('Firefox', avatarUrl)}
          />
        </MenuHeaderFrame>
      );
    },
    {tags: {avatar: 'image', logo: 'firefox', area: 'core'}}
  );

  // Without an organization, the user menu uses the default gradient.
  it.snapshot(
    'user-without-organization',
    () => (
      <MenuHeaderFrame queryClient={sampledQueryClient()}>
        <NavigationMenuHeader
          user={UserFixture({name: 'Jane Doe', email: 'jane@example.com'})}
        />
      </MenuHeaderFrame>
    ),
    {tags: {avatar: 'letter', area: 'core'}}
  );
});
