import {Fragment} from 'react';

import {FeatureBadge} from '@sentry/scraps/badge';
import {Container, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {ImpactBadge} from 'sentry/components/issues/impact/impactBadge';
import {ImpactCitations} from 'sentry/components/issues/impact/impactCitations';
import {hasImpactCitations} from 'sentry/components/issues/impact/utils';
import {TimeSince} from 'sentry/components/timeSince';
import {t, tct} from 'sentry/locale';
import {
  GroupActivityType,
  type Group,
  type GroupActivity,
  type GroupActivityImpactAssessment,
} from 'sentry/types/group';
import {useOrganization} from 'sentry/utils/useOrganization';
import {Timeline} from 'sentry/views/issueDetails/activitySection/timeline';

import {ActivityLineHeadline} from './layout';
import {ActivityLineMarker} from './marker';

export function isImpactActivity(
  activity: GroupActivity
): activity is GroupActivityImpactAssessment {
  return activity.type === GroupActivityType.IMPACT_ASSESSMENT;
}

export function ActivityLineImpact({
  activity,
  group,
  timestampUnitStyle,
}: {
  activity: GroupActivityImpactAssessment;
  group: Group;
  timestampUnitStyle?: React.ComponentProps<typeof TimeSince>['unitStyle'];
}) {
  const {level, score} = activity.data;
  const assessed = level !== null && score !== null;

  return (
    <Timeline.Item
      marker={<ActivityLineMarker item={activity} />}
      headline={
        <ActivityLineHeadline
          title={assessed ? t('Impact assessed') : t("Impact wasn't assessed")}
          details={
            assessed
              ? tct('as [impact]', {impact: <ImpactBadge impact={{level, score}} />})
              : undefined
          }
          timestamp={
            <TimeSince date={activity.dateCreated} unitStyle={timestampUnitStyle} />
          }
          leadingItems={<FeatureBadge type="alpha" />}
        />
      }
    >
      <Container paddingTop="sm">
        <Container width="100%" padding="sm md" border="secondary" radius="md">
          <ImpactActivityDetails activity={activity} group={group} />
        </Container>
      </Container>
    </Timeline.Item>
  );
}

function ImpactActivityDetails({
  activity,
  group,
}: {
  activity: GroupActivityImpactAssessment;
  group: Group;
}) {
  const organization = useOrganization();
  return (
    <Stack gap="md" data-test-id="impact-activity-details">
      <Text as="p" density="comfortable">
        {activity.data.description}
      </Text>
      {hasImpactCitations(organization) && (
        <Fragment>
          <Stack.Separator border="secondary" />
          <ImpactCitations impact={activity.data} group={group} />
        </Fragment>
      )}
    </Stack>
  );
}
