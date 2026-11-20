import {Fragment, useMemo, useState} from 'react';

import {FeatureBadge, Tag} from '@sentry/scraps/badge';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {CitationChip, CitationDetail} from 'sentry/components/seer/citations/citation';
import {parseCitation, type Citation} from 'sentry/components/seer/citations/schemas';
import {TimeSince} from 'sentry/components/timeSince';
import {t, tct} from 'sentry/locale';
import {
  GroupActivityType,
  type Group,
  type GroupActivity,
  type GroupActivityImpactAssessment,
} from 'sentry/types/group';
import {defined} from 'sentry/utils/defined';
import {getShortEventId} from 'sentry/utils/events';
import {useOrganization} from 'sentry/utils/useOrganization';
import {Timeline} from 'sentry/views/issueDetails/activitySection/timeline';

import {ImpactChip} from './chips/impactChip';
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
              ? tct('as [impact]', {impact: <ImpactChip level={level} score={score} />})
              : undefined
          }
          timestamp={
            <TimeSince date={activity.dateCreated} unitStyle={timestampUnitStyle} />
          }
          trailingItems={<FeatureBadge type="alpha" />}
        />
      }
    >
      <Container paddingTop="sm">
        <Container width="100%" padding="sm md" border="muted" radius="md">
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
  const {description, claims, evidence} = activity.data;
  const citationsById = useMemo(() => {
    const byId = new Map<string, Citation>();
    for (const raw of evidence ?? []) {
      const citation = parseCitation(raw);
      if (citation) {
        byId.set(citation.id, citation);
      }
    }
    return byId;
  }, [evidence]);

  return (
    <Stack gap="md" data-test-id="impact-activity-details">
      <Text as="p" density="comfortable">
        {description}
      </Text>
      {claims?.length && citationsById.size ? (
        <ImpactClaims claims={claims} citationsById={citationsById} />
      ) : (
        <LegacyImpactCitations activity={activity} group={group} />
      )}
    </Stack>
  );
}

function ImpactClaims({
  claims,
  citationsById,
}: {
  citationsById: Map<string, Citation>;
  claims: NonNullable<GroupActivityImpactAssessment['data']['claims']>;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <Stack gap="sm" borderTop="muted" paddingTop="md" data-test-id="impact-claims">
      <Text bold size="xs">
        {t('Evidence')}
      </Text>
      {claims.map((claim, index) => {
        const citations = claim.citationIds
          .map(id => citationsById.get(id))
          .filter(defined);
        if (!citations.length) {
          return null;
        }
        const expandedHere = citations.find(
          citation => `${index}:${citation.id}` === expanded
        );
        return (
          <Stack key={index} gap="xs">
            <Text size="sm">{claim.claim}</Text>
            <Flex gap="xs" align="center" wrap="wrap">
              {citations.map(citation => {
                const key = `${index}:${citation.id}`;
                return (
                  <CitationChip
                    key={citation.id}
                    citation={citation}
                    expanded={expanded === key}
                    onToggle={() => setExpanded(expanded === key ? null : key)}
                  />
                );
              })}
            </Flex>
            {expandedHere && <CitationDetail citation={expandedHere} />}
          </Stack>
        );
      })}
    </Stack>
  );
}

function LegacyImpactCitations({
  activity,
  group,
}: {
  activity: GroupActivityImpactAssessment;
  group: Group;
}) {
  const organization = useOrganization();
  const {citations, sourceEventId} = activity.data;
  const eventUrl = `/organizations/${organization.slug}/issues/${group.id}/events/${sourceEventId}/`;
  return (
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
  );
}
