import {useCallback, useEffect, useState} from 'react';

import type {Feature} from 'getsentry/components/upsellModal/types';

interface Options {
  features: Feature[];
  /**
   * Time before the first rotate. Longer than `intervalMs` so the user has
   * time to read the first page.
   */
  firstDelayMs: number;
  initialFeatureId: string | null;
  intervalMs: number;
}

/**
 * Rotates through `features` on a timer until the user selects one.
 */
export function useFeatureRotation({
  features,
  firstDelayMs,
  initialFeatureId,
  intervalMs,
}: Options) {
  const [highlightedFeatureId, setHighlightedFeatureId] = useState(initialFeatureId);
  const [hasClickedFeature, setHasClickedFeature] = useState(false);

  useEffect(() => {
    if (hasClickedFeature) {
      return;
    }

    const showNextFeature = () =>
      setHighlightedFeatureId(currentId => {
        const featureIds = features.map(f => f.id);
        const nextIndex = currentId ? featureIds.indexOf(currentId) + 1 : 0;
        return featureIds[nextIndex % featureIds.length]!;
      });

    let intervalId: number | undefined;
    const timeoutId = window.setTimeout(() => {
      showNextFeature();
      intervalId = window.setInterval(showNextFeature, intervalMs);
    }, firstDelayMs);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [hasClickedFeature, features, firstDelayMs, intervalMs]);

  const selectFeature = useCallback((feature: Feature) => {
    setHighlightedFeatureId(currentId => (feature.id === currentId ? null : feature.id));
    setHasClickedFeature(true);
  }, []);

  return {highlightedFeatureId, hasClickedFeature, selectFeature};
}
