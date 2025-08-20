import {Fragment, useRef} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {DateNavigator} from 'sentry/components/checkInTimeline/dateNavigator';
import {
  GridLineLabels,
  GridLineOverlay,
} from 'sentry/components/checkInTimeline/gridLines';
import {useDateNavigation} from 'sentry/components/checkInTimeline/hooks/useDateNavigation';
import {getConfigFromTimeRange} from 'sentry/components/checkInTimeline/utils/getConfigFromTimeRange';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import Pagination from 'sentry/components/pagination';
import Panel from 'sentry/components/panels/panel';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {Sticky} from 'sentry/components/sticky';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {User} from 'sentry/types/user';
import {useDimensions} from 'sentry/utils/useDimensions';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';
import {ScheduleTimelineRow} from 'sentry/views/alerts/triageSchedules/ScheduleTimelineRow';
import {
  type RotationSchedule,
  useFetchRotationSchedules,
} from 'sentry/views/escalationPolicies/queries/useFetchRotationSchedules';
import {EscalationPolicyHeaderTabs} from 'sentry/views/settings/organizationEscalationPolicies/escalationPolicyHeaderTabs';

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
  const router = useRouter();
  const organization = useOrganization();
  const location = useLocation();
  const elementRef = useRef<HTMLDivElement>(null);
  const {width: timelineWidth} = useDimensions<HTMLDivElement>({elementRef});
  // const timeWindowConfig = useTimeWindowConfig({timelineWidth});
  const start = (
    location.query.start ? moment(location.query.start) : moment().startOf('day')
  ).toDate();
  const end = (
    location.query.end
      ? moment(location.query.end)
      : moment().startOf('day').add(7, 'days')
  ).toDate();
  const timeWindowConfig = getConfigFromTimeRange(start, end, timelineWidth);
  const dateNavigation = useDateNavigation();

  const {
    data: rotationSchedules = [],
    // refetch,
    getResponseHeader,
    isLoading,
    // isError,
  } = useFetchRotationSchedules({orgSlug: organization.slug, timeWindowConfig}, {});
  const rotationSchedulesPageLinks = getResponseHeader?.('Link');
  const {cursor: _cursor, page: _page, ...currentQuery} = location.query;

  return (
    <Fragment>
      <SentryDocumentTitle title={t('Escalation Policies')} orgSlug={organization.slug} />
      <PageFiltersContainer>
        <EscalationPolicyHeaderTabs activeTab="schedules" />
        <Layout.Body>
          <Layout.Main fullWidth>
            <MonitorListPanel role="region">
              <TimelineWidthTracker ref={elementRef} />
              <Header>
                <HeaderControlsLeft>
                  <DateNavigator
                    dateNavigation={dateNavigation}
                    direction="back"
                    size="xs"
                    borderless
                  />
                </HeaderControlsLeft>
                <AlignedGridLineLabels timeWindowConfig={timeWindowConfig} />
                <HeaderControlsRight>
                  <DateNavigator
                    dateNavigation={dateNavigation}
                    direction="forward"
                    size="xs"
                    borderless
                  />
                </HeaderControlsRight>
              </Header>
              <AlignedGridLineOverlay
                stickyCursor
                allowZoom
                showCursor={!isLoading}
                timeWindowConfig={timeWindowConfig}
              />

              <MonitorRows>
                {rotationSchedules.map((rotationSchedule: RotationSchedule) => (
                  <ScheduleTimelineRow
                    key={rotationSchedule.id}
                    schedule={rotationSchedule}
                    timeWindowConfig={timeWindowConfig}
                    totalWidth={timelineWidth}
                  />
                ))}
              </MonitorRows>
            </MonitorListPanel>

            <Pagination
              pageLinks={rotationSchedulesPageLinks}
              onCursor={(cursor, path, _direction) => {
                router.push({
                  pathname: path,
                  query: {...currentQuery, cursor},
                });
              }}
            />
          </Layout.Main>
        </Layout.Body>
      </PageFiltersContainer>
    </Fragment>
  );
}

/* COPIED FROM app/views/monitors/components/overviewTimeline/index.tsx */
const Header = styled(Sticky)`
  display: grid;
  grid-column: 1/-1;
  grid-template-columns: subgrid;

  z-index: 1;
  background: ${p => p.theme.background};
  border-top-left-radius: ${p => p.theme.borderRadius};
  border-top-right-radius: ${p => p.theme.borderRadius};
  box-shadow: 0 1px ${p => p.theme.translucentBorder};

  &[data-stuck] {
    border-radius: 0;
    border-left: 1px solid ${p => p.theme.border};
    border-right: 1px solid ${p => p.theme.border};
    margin: 0 -1px;
  }
`;

const TimelineWidthTracker = styled('div')`
  position: absolute;
  width: 100%;
  grid-row: 1;
  grid-column: 3/-1;
`;
const AlignedGridLineOverlay = styled(GridLineOverlay)`
  grid-row: 1;
  grid-column: 3/-1;
`;

const AlignedGridLineLabels = styled(GridLineLabels)`
  grid-row: 1;
  grid-column: 3/-1;
`;

const MonitorListPanel = styled(Panel)`
  display: grid;
  grid-template-columns: 350px 135px 1fr max-content;
`;

const MonitorRows = styled('ul')`
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
  justify-content: space-between;
  gap: ${space(0.5)};
  padding: ${space(1.5)} ${space(2)};
`;

const HeaderControlsRight = styled('div')`
  grid-row: 1;
  grid-column: -1;
  padding: ${space(1.5)} ${space(2)};
`;

/* END COPY */

export default ScheduleList;
