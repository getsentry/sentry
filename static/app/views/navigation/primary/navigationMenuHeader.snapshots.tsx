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

function uploadedAvatarOrganization(avatarUrl: string) {
  return OrganizationFixture({
    name: 'Acme',
    slug: 'acme',
    avatar: {avatarType: 'upload', avatarUuid: null, avatarUrl},
  });
}

/**
 * Image avatars are sampled on a canvas after load, which SSR never reaches.
 * Seed the sampled color so the header renders what it shows once sampling
 * finishes.
 */
function sampledQueryClient(avatarUrl?: string, sampledColor?: string): QueryClient {
  // No garbage collection timers, so Jest can exit once the snapshots are taken.
  const queryClient = new QueryClient({defaultOptions: {queries: {gcTime: Infinity}}});
  if (avatarUrl && sampledColor) {
    queryClient.setQueryData(['avatar-image-analysis', avatarUrl], {
      dominant: sampledColor,
      style: 'fill',
    });
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

const SAMPLED_AVATAR_COLORS = {
  // Dark and saturated: the menu header used to wash this out to grey-purple.
  purple: '#6513a6',
  yellow: '#ffd000',
  // Already darker than the default gradient, so the header keeps it.
  'near-black': '#1a1a1a',
};

describe('NavigationMenuHeader', () => {
  it.snapshot.each<keyof typeof SAMPLED_AVATAR_COLORS>([
    'purple',
    'yellow',
    'near-black',
  ])(
    'organization-image-avatar-%s',
    colorName => {
      const sampledColor = SAMPLED_AVATAR_COLORS[colorName];
      const avatarUrl = solidImage(sampledColor);
      return (
        <MenuHeaderFrame queryClient={sampledQueryClient(avatarUrl, sampledColor)}>
          <NavigationMenuHeader
            organization={uploadedAvatarOrganization(avatarUrl)}
            projectCount={12}
          />
        </MenuHeaderFrame>
      );
    },
    colorName => ({tags: {avatar: 'image', color: colorName, area: 'core'}})
  );

  // Before an image avatar has been sampled, the header uses its default gradient.
  it.snapshot(
    'organization-image-avatar-unsampled',
    () => (
      <MenuHeaderFrame queryClient={sampledQueryClient()}>
        <NavigationMenuHeader
          organization={uploadedAvatarOrganization(
            solidImage(SAMPLED_AVATAR_COLORS.purple)
          )}
          projectCount={12}
        />
      </MenuHeaderFrame>
    ),
    {tags: {avatar: 'image', color: 'unsampled', area: 'core'}}
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

  it.snapshot(
    'user-letter-avatar',
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
