import {useEffect, useMemo} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import {getSampleEventQuery} from 'sentry/components/events/eventStatisticalDetector/eventComparison/eventDisplay';
import * as Layout from 'sentry/components/layouts/thirds';
import {type Event, type Group, IssueType, type Organization} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import EventView from 'sentry/utils/discover/eventView';
import useReplayList from 'sentry/utils/replays/hooks/useReplayList';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useReplaysFromIssue from 'sentry/views/issueDetails/groupReplays/useReplaysFromIssue';
import ReplayTable from 'sentry/views/replays/replayTable';
import {ReplayColumn} from 'sentry/views/replays/replayTable/types';
import type {ReplayListLocationQuery} from 'sentry/views/replays/types';

type Props = {
  group: Group;
  event?: Event;
};

const VISIBLE_COLUMNS = [
  ReplayColumn.REPLAY,
  ReplayColumn.OS,
  ReplayColumn.BROWSER,
  ReplayColumn.DURATION,
  ReplayColumn.COUNT_ERRORS,
  ReplayColumn.ACTIVITY,
];

function GroupReplays({group, event}: Props) {
  const now = useMemo(() => Date.now(), []);
  const organization = useOrganization();
  const location = useLocation<ReplayListLocationQuery>();

  const durationRegressionPayload = useMemo(
    () =>
      organization.features.includes('performance-duration-regression-visible') &&
      group.issueType === IssueType.PERFORMANCE_DURATION_REGRESSION &&
      event?.occurrence
        ? {
            customIdKey: event?.occurrence?.evidenceData?.transaction,
            customIdQuery: getSampleEventQuery({
              transaction: event.occurrence.evidenceData.transaction,
              durationBaseline: event.occurrence.evidenceData.aggregateRange2,
              addUpperBound: false,
            }),
            datetime: {
              statsPeriod: undefined,
              start: new Date(
                event?.occurrence?.evidenceData?.breakpoint * 1000
              ).toISOString(),
              end: new Date(now).toISOString(),
            },
          }
        : undefined,
    [now, event?.occurrence, group.issueType, organization.features]
  );

  const {eventView, fetchError, pageLinks} = useReplaysFromIssue({
    group,
    location,
    organization,
    ...durationRegressionPayload,
  });

  useEffect(() => {
    trackAnalytics('replay.render-issues-group-list', {
      project_id: group.project.id,
      platform: group.project.platform,
      organization,
    });
    // we only want to fire this event once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!eventView) {
    return (
      <StyledLayoutPage withPadding>
        <ReplayTable
          fetchError={fetchError}
          isFetching
          replays={[]}
          sort={undefined}
          visibleColumns={VISIBLE_COLUMNS}
          showDropdownFilters={false}
        />
      </StyledLayoutPage>
    );
  }
  return (
    <GroupReplaysTable
      eventView={eventView}
      organization={organization}
      pageLinks={pageLinks}
      visibleColumns={VISIBLE_COLUMNS}
    />
  );
}

function GroupReplaysTable({
  eventView,
  organization,
  visibleColumns,
}: {
  eventView: EventView;
  organization: Organization;
  pageLinks: string | null;
  visibleColumns: ReplayColumn[];
}) {
  const location = useMemo(() => ({query: {}}) as Location<ReplayListLocationQuery>, []);

  const {replays, isFetching, fetchError} = useReplayList({
    eventView,
    location,
    organization,
    queryReferrer: 'issueReplays',
  });

  return (
    <StyledLayoutPage withPadding>
      <ReplayTable
        fetchError={fetchError}
        isFetching={isFetching}
        replays={replays}
        sort={undefined}
        visibleColumns={visibleColumns}
        showDropdownFilters={false}
      />
    </StyledLayoutPage>
  );
}

const StyledLayoutPage = styled(Layout.Page)`
  box-shadow: 0px 0px 1px ${p => p.theme.gray200};
  background-color: ${p => p.theme.background};
`;

export default GroupReplays;
