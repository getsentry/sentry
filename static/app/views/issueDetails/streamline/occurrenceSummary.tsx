import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {Flex} from 'sentry/components/core/layout';
import {Link} from 'sentry/components/core/link';
import {DowntimeDuration} from 'sentry/components/events/interfaces/uptime/uptimeDataSection';
import {ScrollCarousel} from 'sentry/components/scrollCarousel';
import TimeSince from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import type {Event, EventEvidenceDisplay} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import useOrganization from 'sentry/utils/useOrganization';
import {getDetectorDetails} from 'sentry/views/issueDetails/streamline/sidebar/detectorSection';

enum KnownEvidence {
  ENVIRONMENT = 'Environment',
  STATUS_CODE = 'Status Code',
  FAILURE_REASON = 'Failure reason',
  LAST_SUCCESSFUL_CHECK_IN = 'Last successful check-in',
}

const KnownEvidenceKeys = new Set<string>(Object.values(KnownEvidence));

interface OccurrenceSummaryProps {
  group: Group;
  className?: string;
  event?: Event;
}

function getEvidenceItem({
  evidence,
  evidenceKey,
}: {
  evidence: EventEvidenceDisplay;
  evidenceKey: KnownEvidence;
}) {
  switch (evidenceKey) {
    case KnownEvidence.ENVIRONMENT:
      return (
        <Flex direction="column">
          <ItemTitle>{t('Environment')}</ItemTitle>
          <ItemValue>{evidence.value}</ItemValue>
        </Flex>
      );
    case KnownEvidence.STATUS_CODE:
      return (
        <Flex direction="column">
          <ItemTitle>{t('Status Code')}</ItemTitle>
          <ItemValue>{evidence.value}</ItemValue>
        </Flex>
      );
    case KnownEvidence.FAILURE_REASON:
      return (
        <Flex direction="column">
          <ItemTitle>{t('Reason')}</ItemTitle>
          <ItemValue>{evidence.value}</ItemValue>
        </Flex>
      );
    case KnownEvidence.LAST_SUCCESSFUL_CHECK_IN:
      return (
        <Flex direction="column">
          <ItemTitle>{t('Last Successful Check-In')}</ItemTitle>
          {moment(evidence.value).isValid() ? (
            <ItemTimeSince date={evidence.value} />
          ) : (
            <ItemValue>{evidence.value}</ItemValue>
          )}
        </Flex>
      );
    default:
      return null;
  }
}

/**
 * This component summarizes the occurance of an issue when the event unit we display below is NOT
 * the occurence. For example, we display 'check-ins' in uptime issues, but the occrurence is a
 * status change from success to failure.
 */
export function OccurrenceSummary({group, event, className}: OccurrenceSummaryProps) {
  const organization = useOrganization();
  const issueTypeConfig = getConfigForIssueType(group, group.project);

  if (!issueTypeConfig.header.occurrenceSummary.enabled) {
    return null;
  }

  const items: React.ReactNode[] = [];

  if (issueTypeConfig.header.occurrenceSummary.downtime) {
    items.push(
      <Flex direction="column">
        <ItemTitle>{t('Downtime')}</ItemTitle>
        <ItemValue>
          <DowntimeDuration group={group} />
        </ItemValue>
      </Flex>
    );
  }

  if (event) {
    const {detectorPath, detectorType, detectorId} = getDetectorDetails({
      event,
      organization,
      project: group.project,
    });

    if (detectorType === 'metric_alert' && detectorPath) {
      items.push(
        <Flex direction="column">
          <ItemTitle>{t('Alert ID')}</ItemTitle>
          <ItemLink to={detectorPath}>{detectorId}</ItemLink>
        </Flex>
      );
    }

    if (['cron_monitor', 'uptime_monitor'].includes(detectorType ?? '') && detectorPath) {
      items.push(
        <Flex direction="column">
          <ItemTitle>{t('Monitor ID')}</ItemTitle>
          <ItemLink to={detectorPath}>{detectorId}</ItemLink>
        </Flex>
      );
    }
  }

  const knownEvidence =
    event?.occurrence?.evidenceDisplay?.reduce(
      (map, eed) => {
        if (KnownEvidenceKeys.has(eed.name)) {
          map[eed.name as KnownEvidence] = eed;
        }
        return map;
      },
      {} as Record<KnownEvidence, EventEvidenceDisplay>
    ) ?? ({} as Record<KnownEvidence, EventEvidenceDisplay>);

  (Object.entries(knownEvidence) as Array<[KnownEvidence, EventEvidenceDisplay]>).forEach(
    ([evidenceKey, evidence]) => {
      items.push(getEvidenceItem({evidence, evidenceKey}));
    }
  );

  return items.length > 0 ? (
    <div>
      <ScrollCarousel gap={3} aria-label={t('Occurrence summary')} className={className}>
        {items.map((item, i) => (
          <div key={i}>{item}</div>
        ))}
      </ScrollCarousel>
    </div>
  ) : null;
}

const ItemTitle = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.tokens.content.secondary};
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const ItemValue = styled('div')`
  font-size: ${p => p.theme.fontSize.lg};
  font-weight: ${p => p.theme.fontWeight.normal};
  max-width: 400px;
`;

const ItemTimeSince = styled(TimeSince)`
  font-size: ${p => p.theme.fontSize.lg};
`;

const ItemLink = styled(Link)`
  color: ${p => p.theme.tokens.content.primary};
  font-size: ${p => p.theme.fontSize.lg};
  text-decoration: underline;
  text-decoration-style: dotted;
  text-decoration-color: ${p => p.theme.tokens.content.secondary};
`;
