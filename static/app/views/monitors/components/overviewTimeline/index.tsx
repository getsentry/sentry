import {Fragment, useCallback, useRef} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import Link from 'sentry/components/links/link';
import Panel from 'sentry/components/panels/panel';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import {IconSort} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';
import {
  GridLineOverlay,
  GridLineTimeLabels,
} from 'sentry/views/monitors/components/overviewTimeline/timelineScrubber';

import {Monitor} from '../../types';
import {scheduleAsText} from '../../utils';

interface Props {
  monitorList: Monitor[];
  monitorListPageLinks?: string | null;
}

export function OverviewTimeline({monitorList}: Props) {
  const {replace, location} = useRouter();

  const resolution = location.query?.resolution ?? '24h';
  const nowRef = useRef<Date>(new Date());

  const handleResolutionChange = useCallback(
    (value: string) => {
      replace({...location, query: {...location.query, resolution: value}});
    },
    [location, replace]
  );

  return (
    <MonitorListPanel monitorCount={monitorList.length}>
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
      <GridLineTimeLabels timeWindow={resolution} end={nowRef.current} />
      <GridLineOverlay timeWindow={resolution} end={nowRef.current} />

      {monitorList.map(monitor => (
        <Fragment key={monitor.id}>
          <MonitorDetails monitor={monitor} />
          <TimelineContainer />
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

const MonitorListPanel = styled(Panel)<{monitorCount: number}>`
  display: grid;
  grid-template-columns: 350px 1fr;
  grid-template-rows: repeat(${p => p.monitorCount + 1}, auto);
`;

const TimelineContainer = styled('div')``;

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
