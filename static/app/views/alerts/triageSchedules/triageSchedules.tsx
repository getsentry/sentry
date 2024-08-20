import {Fragment, useRef} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import Panel from 'sentry/components/panels/panel';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {User} from 'sentry/types';
import {useDimensions} from 'sentry/utils/useDimensions';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';
import {useUser} from 'sentry/utils/useUser';
import AlertHeader from 'sentry/views/alerts/list/header';
import {ScheduleTimelineRow} from 'sentry/views/alerts/triageSchedules/ScheduleTimelineRow';
import {
  GridLineLabels,
  GridLineOverlay,
} from 'sentry/views/monitors/components/timeline/gridLines';
import {useTimeWindowConfig} from 'sentry/views/monitors/components/timeline/hooks/useTimeWindowConfig';

export interface UserSchedulePeriod {
  backgroundColor: string;
  /**
   * Number between 1 and 100 representing the percentage of the timeline this user should take up
   * Leave user undefined if you want to represent a gap in the schedule
   */
  percentage: number;
  user?: User;
}

function ScheduleList() {
  const elementRef = useRef<HTMLDivElement>(null);
  const {width: timelineWidth} = useDimensions<HTMLDivElement>({elementRef});
  const timeWindowConfig = useTimeWindowConfig({timelineWidth});

  const user = useUser();
  const theme = useTheme();

  const schedulePeriods: UserSchedulePeriod[] = [
    {
      backgroundColor: theme.green100,
      percentage: 33,
      user,
    },
    {
      backgroundColor: theme.blue100,
      percentage: 33,
      user: undefined, // Represents a gap in the schedule
    },
    {
      backgroundColor: theme.yellow100,
      percentage: 34,
      user,
    },
  ];

  return (
    <MonitorListPanel role="region">
      <TimelineWidthTracker ref={elementRef} />
      <ScheduleHeader>
        <HeaderControlsLeft>
          {/* These buttons are purely cosmetic for now */}
          <Button
            icon={<IconChevron direction={'left'} />}
            title={'awefioawejfioaewjfio'}
            aria-label={'Previous week'}
            size="sm"
            borderless
          />
          <Button
            icon={<IconChevron direction={'right'} />}
            title={'right'}
            aria-label={'Next week'}
            size="sm"
            borderless
          />
        </HeaderControlsLeft>
        <AlignedGridLineLabels timeWindowConfig={timeWindowConfig} />
      </ScheduleHeader>
      <AlignedGridLineOverlay allowZoom timeWindowConfig={timeWindowConfig} />
      <ScheduleRows>
        <ScheduleTimelineRow
          schedulePeriods={schedulePeriods}
          totalWidth={timelineWidth}
          name="Schedule 1"
        />
      </ScheduleRows>
    </MonitorListPanel>
  );
}

function TriageSchedulePage() {
  const router = useRouter();
  const organization = useOrganization();

  return (
    <Fragment>
      <SentryDocumentTitle title={t('Escalation Policies')} orgSlug={organization.slug} />

      <PageFiltersContainer>
        <AlertHeader router={router} activeTab="schedules" />
        <Layout.Body>
          <Layout.Main fullWidth>
            <ScheduleList />
          </Layout.Main>
        </Layout.Body>
      </PageFiltersContainer>
    </Fragment>
  );
}

const ScheduleHeader = styled('div')`
  display: grid;
  grid-column: 1/-1;
  grid-template-columns: subgrid;

  z-index: 1;
  background: ${p => p.theme.background};
  border-top-left-radius: ${p => p.theme.panelBorderRadius};
  border-top-right-radius: ${p => p.theme.panelBorderRadius};
  box-shadow: 0 1px ${p => p.theme.translucentBorder};

  &[data-stuck] {
    border-radius: 0;
    border-left: 1px solid ${p => p.theme.border};
    border-right: 1px solid ${p => p.theme.border};
    margin: 0 -1px;
  }
`;

const MonitorListPanel = styled(Panel)`
  display: grid;
  grid-template-columns: 350px 135px 1fr max-content;
`;

const AlignedGridLineOverlay = styled(GridLineOverlay)`
  grid-row: 1;
  grid-column: 3/-1;
`;

const ScheduleRows = styled('ul')`
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1 / -1;
  list-style: none;
  padding: 0;
  margin: 0;
`;

const HeaderControlsLeft = styled('div')`
  grid-column: 1/3;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${space(0.5)};
  padding: ${space(1.5)} ${space(2)};
`;

const TimelineWidthTracker = styled('div')`
  position: absolute;
  width: 100%;
  grid-row: 1;
  grid-column: 3/-1;
`;

const AlignedGridLineLabels = styled(GridLineLabels)`
  grid-row: 1;
  grid-column: 3/-1;
`;

export default TriageSchedulePage;
