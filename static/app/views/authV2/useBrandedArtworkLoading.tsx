import {useEffect, useState} from 'react';
import {useTheme} from '@emotion/react';

import critterImage from 'sentry-images/brandPageLayout/animated/critter.avif';
import nebulaImage from 'sentry-images/brandPageLayout/animated/nebula.svg';

import {ARTWORK_LAYERS} from 'sentry/components/brandPageLayout/artworkLayers';
import {useMedia} from 'sentry/utils/useMedia';

const MOBILE_ASSETS = [critterImage];
const DESKTOP_ASSETS = [...MOBILE_ASSETS, nebulaImage, ...ARTWORK_LAYERS.map(l => l.src)];

/** Loads and decodes artwork while authentication data is still loading. */
export function useBrandedArtworkLoading() {
  const theme = useTheme();
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
    const decoding = pendingSources.map(src => {
      const image = new Image();
      image.src = src;
      return image.decode();
    });

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
