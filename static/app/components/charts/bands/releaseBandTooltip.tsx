import {Container, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {formatVersion} from 'sentry/utils/versions/formatVersion';

import type {BucketableRelease, ReleaseBucket} from './bucketReleases';
import {ChartBandTooltipHeading} from './chartBandTooltip';

const MAX_VERSIONS = 3;

export interface BandRelease extends BucketableRelease {
  version: string;
}

interface ReleaseBandTooltipSectionProps {
  bucket: ReleaseBucket<BandRelease>;
}

export function ReleaseBandTooltipSection({bucket}: ReleaseBandTooltipSectionProps) {
  const {releases} = bucket;
  const hiddenCount = releases.length - MAX_VERSIONS;

  return (
    <Container as="section">
      <ChartBandTooltipHeading label={t('Releases')} value={releases.length} />
      <Stack gap="md" padding="0 xl lg">
        {releases.slice(0, MAX_VERSIONS).map(release => (
          <Text key={release.version}>{formatVersion(release.version)}</Text>
        ))}
        {hiddenCount > 0 && <Text variant="muted">{t('+%s more', hiddenCount)}</Text>}
      </Stack>
    </Container>
  );
}
