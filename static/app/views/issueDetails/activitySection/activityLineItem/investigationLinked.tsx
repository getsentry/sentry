import {Container, Stack} from '@sentry/scraps/layout';
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
  variant,
  timestampUnitStyle,
}: {
  activity: GroupActivityInvestigationLinked;
  /**
   * The compact sidebar feed leaves out the hypothesis and evidence.
   */
  variant: 'compact' | 'full';
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
      {investigation && variant === 'full' ? (
        <Container paddingTop="sm">
          <Container width="100%" padding="sm md" border="muted" radius="md">
            <Stack gap="sm">
              <Text as="p" density="comfortable" wordBreak="break-word">
                {hypothesisStatement}
              </Text>
              {reason ? (
                <Container borderTop="muted" paddingTop="sm">
                  <Text as="p" size="xs" variant="muted" wordBreak="break-word">
                    <Text bold>{t('Evidence:')}</Text> {reason}
                  </Text>
                </Container>
              ) : null}
            </Stack>
          </Container>
        </Container>
      ) : null}
    </Timeline.Item>
  );
}
