import {Fragment, useCallback, useRef} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import Link from 'sentry/components/links/link';
import Panel from 'sentry/components/panels/panel';
import Placeholder from 'sentry/components/placeholder';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import {IconSort} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useDimensions} from 'sentry/utils/useDimensions';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';
import {CheckInTimeline} from 'sentry/views/monitors/components/checkInTimeline';
import {
  GridLineOverlay,
  GridLineTimeLabels,
} from 'sentry/views/monitors/components/overviewTimeline/timelineScrubber';
import {MonitorBucketData} from 'sentry/views/monitors/components/overviewTimeline/types';
import {
  getStartFromTimeWindow,
  timeWindowData,
} from 'sentry/views/monitors/components/overviewTimeline/utils';

import {Monitor} from '../../types';
import {scheduleAsText} from '../../utils';

interface Props {
  monitorList: Monitor[];
  monitorListPageLinks?: string | null;
}

const DEFAULT_WIDTH = 800;

export function OverviewTimeline({monitorList}: Props) {
  const {replace, location} = useRouter();
  const organization = useOrganization();

  const resolution = location.query?.resolution ?? '24h';
  const nowRef = useRef<Date>(new Date());
  const start = getStartFromTimeWindow(nowRef.current, resolution);
  const {elementRef, width} = useDimensions<HTMLDivElement>();

  const handleResolutionChange = useCallback(
    (value: string) => {
      replace({...location, query: {...location.query, resolution: value}});
    },
    [location, replace]
  );

  const rollup = Math.floor(
    (timeWindowData[resolution].elapsedMinutes * 60) / (width > 0 ? width : DEFAULT_WIDTH)
  );
  const monitorStatsQueryKey = `/organizations/${organization.slug}/monitors-stats/`;
  const {data: monitorStats, isLoading} = useApiQuery<Record<string, MonitorBucketData>>(
    [
      monitorStatsQueryKey,
      {
        query: {
          until: Math.floor(nowRef.current.getTime() / 1000),
          since: Math.floor(start.getTime() / 1000),
          monitor: monitorList.map(m => m.slug),
          resolution: `${rollup}s`,
          ...location.query,
        },
      },
    ],
    {
      staleTime: 0,
    }
  );

  return (
    <MonitorListPanel>
      <ListFilters>
        <Button size="xs" icon={<IconSort size="xs" />} aria-label={t('Reverse sort')} />
        <SegmentedControl
          value={resolution}
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
      <GridLineTimeLabels
        timeWindow={resolution}
        end={nowRef.current}
        width={width}
        ref={elementRef}
      />
      <GridLineOverlay timeWindow={resolution} end={nowRef.current} width={width} />

      {monitorList.map(monitor => (
        <Fragment key={monitor.id}>
          <MonitorDetails monitor={monitor} />
          {isLoading || !monitorStats ? (
            <Placeholder />
          ) : (
            <CheckInTimeline
              bucketedData={monitorStats[monitor.slug]}
              end={nowRef.current}
              start={start}
              width={width}
            />
          )}
        </Fragment>
      ))}
    </MonitorListPanel>
  );
}

function MonitorDetails({monitor}: {monitor: Monitor}) {
  const organization = useOrganization();
  const schedule = scheduleAsText(monitor.config);

  const monitorDetailUrl = `/organizations/${organization.slug}/crons/${monitor.slug}/`;

  return (
    <DetailsContainer to={monitorDetailUrl}>
      <Name>{monitor.name}</Name>
      <Schedule>{schedule}</Schedule>
    </DetailsContainer>
  );
}

const MonitorListPanel = styled(Panel)`
  display: grid;
  grid-template-columns: 350px 1fr;
`;

const DetailsContainer = styled(Link)`
  color: ${p => p.theme.textColor};
  padding: ${space(2)};
  border-right: 1px solid ${p => p.theme.border};
  border-radius: 0;

  &:hover {
    color: unset;
  }
`;

const Name = styled('h3')`
  font-size: ${p => p.theme.fontSizeLarge};
  margin-bottom: ${space(0.25)};
`;

const Schedule = styled('small')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const ListFilters = styled('div')`
  display: flex;
  gap: ${space(1)};
  padding: ${space(1.5)} ${space(2)};
  border-bottom: 1px solid ${p => p.theme.border};
`;
