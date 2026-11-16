import type {ReactNode} from 'react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {Container} from '@sentry/scraps/layout';

import {NavigationMenuHeader} from './navigationMenuHeader';

function solidImage(hex: string): string {
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="${hex}"/></svg>`
  )}`;
}

function logoOrganization(hex: string) {
  return OrganizationFixture({
    name: 'Acme',
    slug: 'acme',
    avatar: {avatarType: 'upload', avatarUuid: null, avatarUrl: solidImage(hex)},
  });
}

/**
 * Image avatars are sampled on a canvas after load, which SSR never reaches.
 * Seed the sampled color so the header renders what it shows once sampling
 * finishes.
 */
function sampledQueryClient(hex?: string): QueryClient {
  // No garbage collection timers, so Jest can exit once the snapshots are taken.
  const queryClient = new QueryClient({defaultOptions: {queries: {gcTime: Infinity}}});
  if (hex) {
    for (const themeType of ['light', 'dark']) {
      queryClient.setQueryData(['avatar-button-chonk', solidImage(hex), themeType], {
        chonk: hex,
        dominant: hex,
        style: 'fill',
      });
    }
  }
  return queryClient;
}

function Frame({children, sampledColor}: {children: ReactNode; sampledColor?: string}) {
  return (
    <QueryClientProvider client={sampledQueryClient(sampledColor)}>
      <Container width="258px" padding="sm lg">
        {children}
      </Container>
    </QueryClientProvider>
  );
}

const LOGOS = [
  // Bright, where the gradient used to start near black.
  {kind: 'bright', color: '#ffd744'},
  {kind: 'saturated', color: '#e3442a'},
  // Already darker than the default gradient.
  {kind: 'dark', color: '#12424a'},
  // No colored pixels, so the header keeps its default gradient.
  {kind: 'neutral', color: '#000000'},
];

describe('NavigationMenuHeader', () => {
  for (const {kind, color} of LOGOS) {
    it.snapshot(
      `organization-logo-${kind}`,
      () => (
        <Frame sampledColor={color}>
          <NavigationMenuHeader
            organization={logoOrganization(color)}
            projectCount={12}
          />
        </Frame>
      ),
      {tags: {avatar: 'image', logo: kind, area: 'core'}}
    );
  }

  // Before an image avatar has been sampled, the header uses its default gradient.
  it.snapshot(
    'organization-logo-unsampled',
    () => (
      <Frame>
        <NavigationMenuHeader
          organization={logoOrganization('#ffd744')}
          projectCount={12}
        />
      </Frame>
    ),
    {tags: {avatar: 'image', logo: 'unsampled', area: 'core'}}
  );

  it.snapshot(
    'organization-letter-avatar',
    () => (
      <Frame>
        <NavigationMenuHeader
          organization={OrganizationFixture({name: 'Acme', slug: 'acme'})}
          projectCount={1}
        />
      </Frame>
    ),
    {tags: {avatar: 'letter', area: 'core'}}
  );

  // The user menu takes its gradient from the organization's avatar.
  it.snapshot(
    'user-with-organization-logo',
    () => (
      <Frame sampledColor="#ffd744">
        <NavigationMenuHeader
          user={UserFixture({name: 'Jane Doe', email: 'jane@example.com'})}
          organization={logoOrganization('#ffd744')}
        />
      </Frame>
    ),
    {tags: {avatar: 'image', logo: 'bright', area: 'core'}}
  );

  // Without an organization, the user menu uses the default gradient.
  it.snapshot(
    'user-without-organization',
    () => (
      <Frame>
        <NavigationMenuHeader
          user={UserFixture({name: 'Jane Doe', email: 'jane@example.com'})}
        />
      </Frame>
    ),
    {tags: {avatar: 'letter', area: 'core'}}
  );
});
