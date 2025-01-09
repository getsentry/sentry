import {SegmentedControl} from 'sentry/components/segmentedControl';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import type {ProjectionSamplePeriod} from 'sentry/views/settings/dynamicSampling/utils/useProjectSampleCounts';

interface Props {
  onChange: (period: ProjectionSamplePeriod) => void;
  period: ProjectionSamplePeriod;
}

export function ProjectionPeriodControl({period, onChange}: Props) {
  return (
    <Tooltip
      title={t('The time period for which the estimated sample rates are calculated.')}
    >
      <SegmentedControl
        label={t('Stats period')}
        value={period}
        onChange={onChange}
        size="xs"
      >
        <SegmentedControl.Item key="24h">{t('24h')}</SegmentedControl.Item>
        <SegmentedControl.Item key="30d">{t('30d')}</SegmentedControl.Item>
      </SegmentedControl>
    </Tooltip>
  );
}
