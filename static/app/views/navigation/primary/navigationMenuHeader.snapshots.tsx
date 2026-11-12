import type {ReactNode} from 'react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {Container} from '@sentry/scraps/layout';

import type {Organization} from 'sentry/types/organization';
import {OrganizationContext} from 'sentry/utils/organizationContext';

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

function Frame({
  children,
  organization = null,
  sampledColor,
}: {
  children: ReactNode;
  /** The current organization, which the header takes its gradient from. */
  organization?: Organization | null;
  sampledColor?: string;
}) {
  return (
    <QueryClientProvider client={sampledQueryClient(sampledColor)}>
      <OrganizationContext value={organization}>
        <Container width="258px" padding="sm lg">
          {children}
        </Container>
      </OrganizationContext>
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

const LETTER_ORGANIZATION = OrganizationFixture({name: 'Acme', slug: 'acme'});

describe('NavigationMenuHeader', () => {
  for (const {kind, color} of LOGOS) {
    it.snapshot(
      `organization-logo-${kind}`,
      () => {
        const organization = logoOrganization(color);
        return (
          <Frame organization={organization} sampledColor={color}>
            <NavigationMenuHeader organization={organization} projectCount={12} />
          </Frame>
        );
      },
      {tags: {avatar: 'image', logo: kind, area: 'core'}}
    );
  }

  // Before an image avatar has been sampled, the header uses its default gradient.
  it.snapshot(
    'organization-logo-unsampled',
    () => {
      const organization = logoOrganization('#ffd744');
      return (
        <Frame organization={organization}>
          <NavigationMenuHeader organization={organization} projectCount={12} />
        </Frame>
      );
    },
    {tags: {avatar: 'image', logo: 'unsampled', area: 'core'}}
  );

  it.snapshot(
    'organization-letter-avatar',
    () => (
      <Frame organization={LETTER_ORGANIZATION}>
        <NavigationMenuHeader organization={LETTER_ORGANIZATION} projectCount={1} />
      </Frame>
    ),
    {tags: {avatar: 'letter', area: 'core'}}
  );

  // The user menu takes its gradient from the organization's avatar.
  it.snapshot(
    'user-with-organization-logo',
    () => (
      <Frame organization={logoOrganization('#ffd744')} sampledColor="#ffd744">
        <NavigationMenuHeader
          user={UserFixture({name: 'Jane Doe', email: 'jane@example.com'})}
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
