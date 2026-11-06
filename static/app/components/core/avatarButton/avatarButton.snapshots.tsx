import type {ReactNode} from 'react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

import type {BaseAvatarProps} from '@sentry/scraps/avatar';
import {Container} from '@sentry/scraps/layout';

import {AvatarButton} from './avatarButton';

function solidImage(hex: string): string {
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="${hex}"/></svg>`
  )}`;
}

// A skin-toned "photo" and a yellow organization logo.
const PHOTO = {url: solidImage('#d9a88c'), chonk: '#7a4a33'};
const LOGO = {url: solidImage('#ffd744'), chonk: '#8a6d00'};

const photoAvatar: BaseAvatarProps = {
  type: 'upload',
  identifier: 'jane',
  name: 'Jane Doe',
  uploadUrl: PHOTO.url,
};

const logoAvatar: BaseAvatarProps = {
  type: 'upload',
  identifier: 'acme',
  name: 'Acme',
  uploadUrl: LOGO.url,
};

/**
 * Image avatars are sampled on a canvas after load, which SSR never reaches.
 * Seed the sampled colors so the button renders what it shows once sampling
 * finishes.
 */
function sampledQueryClient(): QueryClient {
  // No garbage collection timers, so Jest can exit once the snapshots are taken.
  const queryClient = new QueryClient({defaultOptions: {queries: {gcTime: Infinity}}});
  for (const {url, chonk} of [PHOTO, LOGO]) {
    for (const themeType of ['light', 'dark']) {
      queryClient.setQueryData(['avatar-button-chonk', url, themeType], {
        chonk,
        dominant: chonk,
        style: 'fill',
      });
    }
  }
  return queryClient;
}

function Frame({children}: {children: ReactNode}) {
  return (
    <QueryClientProvider client={sampledQueryClient()}>
      <Container padding="md">{children}</Container>
    </QueryClientProvider>
  );
}

describe('AvatarButton', () => {
  it.snapshot(
    'image-avatar',
    () => (
      <Frame>
        <AvatarButton aria-label="Jane Doe" avatar={photoAvatar} />
      </Frame>
    ),
    {tags: {avatar: 'image', area: 'core'}}
  );

  // Shows the photo, with the border color taken from the logo.
  it.snapshot(
    'image-avatar-with-color-avatar',
    () => (
      <Frame>
        <AvatarButton
          aria-label="Jane Doe"
          avatar={photoAvatar}
          colorAvatar={logoAvatar}
        />
      </Frame>
    ),
    {tags: {avatar: 'image', area: 'core'}}
  );
});
