import {useEffect, useState} from 'react';
import {useTheme} from '@emotion/react';

import critterImage from 'sentry-images/brandPageLayout/animated/critter.avif';
import nebulaImage from 'sentry-images/brandPageLayout/animated/nebula.svg';

import {useMedia} from '@sentry/scraps/useMedia';

import {ARTWORK_LAYERS} from 'sentry/components/brandPageLayout/artworkLayers';

const MOBILE_ASSETS = [critterImage];
const DESKTOP_ASSETS = [...MOBILE_ASSETS, nebulaImage, ...ARTWORK_LAYERS.map(l => l.src)];

/**
 * Async so a missing or throwing `decode` (e.g. stubbed browser runtimes)
 * becomes a rejection that `Promise.allSettled` absorbs instead of throwing
 * synchronously out of the effect.
 */
async function decodeImage(src: string) {
  const image = new Image();
  image.src = src;
  await image.decode();
}

/** Loads and decodes artwork while authentication data is still loading. */
export function useBrandedArtworkLoading() {
  const theme = useTheme();
  // Side artwork visibility follows the viewport breakpoint.
  // oxlint-disable-next-line @sentry/scraps/prefer-container-responsive-props
  const hasSideArtwork = useMedia(`(min-width: ${theme.breakpoints.md})`);
  const sources = hasSideArtwork ? DESKTOP_ASSETS : MOBILE_ASSETS;
  const [settledSources, setSettledSources] = useState<ReadonlySet<string>>(new Set());
  const isLoading = sources.some(src => !settledSources.has(src));

  useEffect(() => {
    const pendingSources = sources.filter(src => !settledSources.has(src));

    if (!pendingSources.length) {
      return;
    }

    let cancelled = false;
    const decoding = pendingSources.map(decodeImage);

    // Failed assets settle too, so a broken image cannot hold the auth loader.
    Promise.allSettled(decoding).then(() => {
      if (!cancelled) {
        setSettledSources(previous => new Set([...previous, ...pendingSources]));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [sources, settledSources]);

  return isLoading;
}
