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

// A skin-toned "photo". `chonk` is what `darkenUntilContrasts` gives `dominant`.
const PHOTO = {url: solidImage('#d9a88c'), dominant: '#d9a88c', chonk: '#7d4829'};

const photoAvatar: BaseAvatarProps = {
  type: 'upload',
  identifier: 'jane',
  name: 'Jane Doe',
  uploadUrl: PHOTO.url,
};

/**
 * Image avatars are sampled on a canvas after load, which SSR never reaches.
 * Seed the sampled colors so the button renders what it shows once sampling
 * finishes.
 */
function sampledQueryClient(): QueryClient {
  // No garbage collection timers, so Jest can exit once the snapshots are taken.
  const queryClient = new QueryClient({defaultOptions: {queries: {gcTime: Infinity}}});
  for (const themeType of ['light', 'dark']) {
    queryClient.setQueryData(['avatar-button-chonk', PHOTO.url, themeType], {
      chonk: PHOTO.chonk,
      dominant: PHOTO.dominant,
      style: 'fill',
    });
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

  // A caller-picked frame color, used as is.
  it.snapshot(
    'image-avatar-with-frame-color',
    () => (
      <Frame>
        <AvatarButton aria-label="Jane Doe" avatar={photoAvatar} frameColor="#8a6d00" />
      </Frame>
    ),
    {tags: {avatar: 'image', area: 'core'}}
  );
});
