import {useCallback} from 'react';
import styled from '@emotion/styled';

import {SegmentedControl} from 'sentry/components/segmentedControl';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useRouter from 'sentry/utils/useRouter';
import {TimeWindow} from 'sentry/views/monitors/components/overviewTimeline/types';

interface Props {
  className?: string;
}

export function ResolutionSelector({className}: Props) {
  const {replace, location} = useRouter();
  const handleResolutionChange = useCallback(
    (value: TimeWindow) => {
      replace({...location, query: {...location.query, timeWindow: value}});
    },
    [location, replace]
  );

  const timeWindow: TimeWindow = location.query?.timeWindow ?? '24h';

  return (
    <ListFilters className={className}>
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
    </ListFilters>
  );
}

const ListFilters = styled('div')`
  display: flex;
  gap: ${space(1)};
`;
