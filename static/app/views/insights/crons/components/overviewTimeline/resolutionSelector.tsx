import {useCallback} from 'react';

import {Flex} from '@sentry/scraps/layout';

import type {TimeWindow} from 'sentry/components/checkInTimeline/types';
import {SegmentedControl} from 'sentry/components/core/segmentedControl';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

interface Props {
  className?: string;
}

export function ResolutionSelector({className}: Props) {
  const location = useLocation();
  const navigate = useNavigate();

  const handleResolutionChange = useCallback(
    (value: TimeWindow) =>
      navigate(
        {...location, query: {...location.query, timeWindow: value}},
        {replace: true}
      ),
    [location, navigate]
  );

  const timeWindow = (location.query?.timeWindow as TimeWindow) ?? '24h';

  return (
    <Flex gap="md" className={className}>
      <SegmentedControl<TimeWindow>
        value={timeWindow}
        onChange={handleResolutionChange}
        size="xs"
        aria-label={t('Time Scale')}
      >
        <SegmentedControl.Item key="1h">{t('Hour')}</SegmentedControl.Item>
        <SegmentedControl.Item key="24h">{t('Day')}</SegmentedControl.Item>
        <SegmentedControl.Item key="7d">{t('Week')}</SegmentedControl.Item>
        <SegmentedControl.Item key="30d">{t('Month')}</SegmentedControl.Item>
      </SegmentedControl>
    </Flex>
  );
}
