import {Fragment} from 'react';

import {FeatureBadge, Tag} from '@sentry/scraps/badge';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {TimeSince} from 'sentry/components/timeSince';
import {t, tct} from 'sentry/locale';
import {
  GroupActivityType,
  type Group,
  type GroupActivity,
  type GroupActivityImpactAssessment,
} from 'sentry/types/group';
import {getShortEventId} from 'sentry/utils/events';
import {useOrganization} from 'sentry/utils/useOrganization';

import {ActivityImpactChip} from './chips/impactChip';
import {ActivityLineContent, ActivityLineHeadline, ActivityLineRow} from './layout';
import {ActivityLineMarker} from './progressMarker';

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
  const organization = useOrganization();
  const showProgress = organization.features.includes('issue-activity-progress');
  const {level, score} = activity.data;
  const assessed = level !== null && score !== null;

  return (
    <ActivityLineRow>
      <ActivityLineMarker item={activity} showProgress={showProgress} />
      <ActivityLineHeadline
        title={assessed ? t('Impact assessed') : t("Impact wasn't assessed")}
        details={
          assessed
            ? tct('as [impact]', {
                impact: <ActivityImpactChip level={level} score={score} />,
              })
            : undefined
        }
        timestamp={
          <TimeSince date={activity.dateCreated} unitStyle={timestampUnitStyle} />
        }
        trailingItems={<FeatureBadge type="alpha" />}
      />
      <ActivityLineContent>
        <Container paddingTop="sm">
          <Container width="100%" padding="sm md" border="muted" radius="md">
            <ImpactActivityDetails activity={activity} group={group} />
          </Container>
        </Container>
      </ActivityLineContent>
    </ActivityLineRow>
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
  const {description, citations, sourceEventId} = activity.data;
  const eventUrl = `/organizations/${organization.slug}/issues/${group.id}/events/${sourceEventId}/`;
  return (
    <Stack gap="md" data-test-id="impact-activity-details">
      <Text as="p" density="comfortable">
        {description}
      </Text>
      <Flex gap="xs" wrap="wrap" borderTop="muted" paddingTop="md">
        <Container>
          <Text bold size="xs">
            {t('Citations:')}
          </Text>
        </Container>
        {citations.map((citation, index) => (
          <Tooltip
            key={`${citation.source}:${citation.reference}:${index}`}
            title={
              <Fragment>
                <Tooltip.Header
                  trailingItems={
                    <Link to={eventUrl}>{getShortEventId(sourceEventId)}</Link>
                  }
                >
                  <Text size="sm">{t('Source Event')}</Text>
                </Tooltip.Header>
                <Text size="sm" align="left">
                  {citation.claim}
                </Text>
              </Fragment>
            }
          >
            <Tag variant="muted">{citation.source}</Tag>
          </Tooltip>
        ))}
      </Flex>
    </Stack>
  );
}
