import {useTheme} from '@emotion/react';

import {ScoreBar} from 'sentry/components/scoreBar';

/**
 * A replay's activity score as the ten-segment bar the replays table uses.
 * Shared so the Seer `replaysQuery` embed reads the same at a glance.
 */
export function ReplayActivityScore({score}: {score: null | number}) {
  const theme = useTheme();
  const colors = theme.chart.getColorPalette(0);
  const palette = Array.from<string[]>({length: 10}).fill([colors[0]]);

  return (
    <ScoreBar
      size={20}
      score={score ?? 1}
      // @ts-expect-error -- TODO: Resolve this mismatch
      palette={palette}
      radius={0}
    />
  );
}
