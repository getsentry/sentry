import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {TimeSince} from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import {
  GroupActivityType,
  type GroupActivity,
  type GroupActivityInvestigationLinked,
} from 'sentry/types/group';
import {Timeline} from 'sentry/views/issueDetails/activitySection/timeline';

import {InvestigationChip} from './chips/investigationChip';
import {ActivityLineHeadline} from './layout';
import {ActivityLineMarker} from './marker';

export function isInvestigationLinkedActivity(
  activity: GroupActivity
): activity is GroupActivityInvestigationLinked {
  return activity.type === GroupActivityType.INVESTIGATION_LINKED;
}

export function ActivityLineInvestigationLinked({
  activity,
  timestampUnitStyle,
}: {
  activity: GroupActivityInvestigationLinked;
  timestampUnitStyle?: React.ComponentProps<typeof TimeSince>['unitStyle'];
}) {
  const {investigation, reason, hypothesisStatement} = activity.data;

  return (
    <Timeline.Item
      marker={<ActivityLineMarker item={activity} />}
      headline={
        <ActivityLineHeadline
          title={t('Mentioned in')}
          details={
            investigation ? (
              <InvestigationChip investigation={investigation} />
            ) : (
              t('a deleted investigation')
            )
          }
          timestamp={
            <TimeSince date={activity.dateCreated} unitStyle={timestampUnitStyle} />
          }
        />
      }
    >
      {investigation ? (
        <Container paddingTop="sm">
          <Container width="100%" padding="sm md" border="muted" radius="md">
            <Stack gap="sm">
              <Text as="p" density="comfortable">
                {hypothesisStatement}
              </Text>
              {reason ? (
                <Flex gap="xs" borderTop="muted" paddingTop="sm">
                  <Text bold size="xs" variant="muted">
                    {t('Evidence:')}
                  </Text>
                  <Text size="xs" variant="muted">
                    {reason}
                  </Text>
                </Flex>
              ) : null}
            </Stack>
          </Container>
        </Container>
      ) : null}
    </Timeline.Item>
  );
}
