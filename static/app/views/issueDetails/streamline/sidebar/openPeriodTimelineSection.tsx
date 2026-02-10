import {Fragment, type ReactNode} from 'react';
import orderBy from 'lodash/orderBy';

import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {IconCellSignal} from 'sentry/components/badge/iconCellSignal';
import {DateTime} from 'sentry/components/dateTime';
import LoadingError from 'sentry/components/loadingError';
import Placeholder from 'sentry/components/placeholder';
import {Timeline} from 'sentry/components/timeline';
import {IconCheckmark, IconFire} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {GroupOpenPeriod} from 'sentry/types/group';
import {unreachable} from 'sentry/utils/unreachable';
import {useEventOpenPeriod} from 'sentry/views/detectors/hooks/useOpenPeriods';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';

type OpenPeriodTimelineSectionProps = {
  eventId: string;
  groupId: string;
};

function getOpenPeriodActivityLabel(
  activity: GroupOpenPeriod['activities'][number]
): string {
  switch (activity.type) {
    case 'opened':
      return t('Opened');
    case 'closed':
      return t('Resolved');
    case 'status_change':
      return t('Status Changed');
    default:
      unreachable(activity.type);
      return t('Updated');
  }
}

function getOpenPeriodActivitySubtext(
  activity: GroupOpenPeriod['activities'][number]
): ReactNode {
  const priority = activity.value;

  if (!priority) {
    return null;
  }

  return (
    <Fragment>
      <Timeline.Text>{t('Priority: %s', priority)}</Timeline.Text>
    </Fragment>
  );
}

function getOpenPeriodActivityIcon(activity: GroupOpenPeriod['activities'][number]) {
  switch (activity.type) {
    case 'opened':
      return <IconFire size="xs" />;
    case 'closed':
      return <IconCheckmark size="xs" />;
    case 'status_change':
      return <IconCellSignal size="xs" bars={activity.value === 'high' ? 3 : 2} />;
    default:
      return null;
  }
}

function TimelineSection({children}: {children: ReactNode}) {
  return (
    <InterimSection title={t('Timeline')} type="timeline">
      {children}
    </InterimSection>
  );
}

export function OpenPeriodTimelineSection({
  groupId,
  eventId,
}: OpenPeriodTimelineSectionProps) {
  const {openPeriod, isPending, isError} = useEventOpenPeriod({
    groupId,
    eventId,
  });

  if (isPending) {
    return (
      <TimelineSection>
        <Placeholder height="110px" />
      </TimelineSection>
    );
  }

  if (isError || !openPeriod?.activities.length) {
    return (
      <TimelineSection>
        <LoadingError message={t('Error loading open period timeline')} />
      </TimelineSection>
    );
  }

  const sortedActivities = orderBy(openPeriod.activities, 'dateCreated', 'desc');

  return (
    <TimelineSection>
      <Timeline.Container>
        {sortedActivities.map(activity => {
          const isCurrentEvent = activity.eventId === eventId;
          const activityLabel = getOpenPeriodActivityLabel(activity);
          const title = isCurrentEvent ? (
            <Flex align="center" gap="xs">
              {activityLabel}
              <Text variant="muted" bold={false}>
                {' - ' + t('This event')}
              </Text>
            </Flex>
          ) : (
            activityLabel
          );

          return (
            <Timeline.Item
              key={activity.id}
              data-test-id="open-period-timeline-row"
              title={title}
              timestamp={<DateTime date={activity.dateCreated} />}
              icon={getOpenPeriodActivityIcon(activity)}
            >
              {getOpenPeriodActivitySubtext(activity)}
            </Timeline.Item>
          );
        })}
      </Timeline.Container>
    </TimelineSection>
  );
}
