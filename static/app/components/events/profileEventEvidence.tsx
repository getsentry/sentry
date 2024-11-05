import {LinkButton} from 'sentry/components/button';
import KeyValueList from 'sentry/components/events/interfaces/keyValueList';
import {IconProfiling} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import {generateLinkToEventInTraceView} from 'sentry/utils/discover/urls';
import {generateProfileFlamechartRouteWithHighlightFrame} from 'sentry/utils/profiling/routes';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';

type ProfileEvidenceProps = {event: Event; projectSlug: string};

export function ProfileEventEvidence({event, projectSlug}: ProfileEvidenceProps) {
  const organization = useOrganization();
  const location = useLocation();
  const evidenceData = event.occurrence?.evidenceData ?? {};
  const evidenceDisplay = event.occurrence?.evidenceDisplay ?? [];
  const traceSlug = event.contexts?.trace?.trace_id ?? '';

  const keyValueListData = [
    ...(evidenceData.transactionId && evidenceData.transactionName
      ? [
          {
            subject: 'Transaction Name',
            key: 'Transaction Name',
            value: evidenceData.transactionName,
            actionButton: traceSlug ? (
              <LinkButton
                size="xs"
                to={generateLinkToEventInTraceView({
                  traceSlug,
                  timestamp: evidenceData.timestamp,
                  eventId: evidenceData.transactionId,
                  projectSlug,
                  location: {...location, query: {...location.query, referrer: 'issue'}},
                  organization,
                })}
              >
                {t('View Transaction')}
              </LinkButton>
            ) : null,
          },
        ]
      : []),
    ...(evidenceData.profileId
      ? [
          {
            subject: 'Profile ID',
            key: 'Profile ID',
            value: evidenceData.profileId,
            actionButton: (
              <LinkButton
                size="xs"
                to={generateProfileFlamechartRouteWithHighlightFrame({
                  profileId: evidenceData.profileId,
                  projectSlug,
                  orgSlug: organization.slug,
                  frameName: evidenceData.frameName,
                  framePackage: evidenceData.framePackage,
                  query: {
                    referrer: 'issue',
                  },
                })}
                icon={<IconProfiling />}
              >
                {t('View Profile')}
              </LinkButton>
            ),
          },
        ]
      : []),
    ...evidenceDisplay.map(item => ({
      subject: item.name,
      key: item.name,
      value: item.value,
    })),
  ];

  return (
    <InterimSection title={t('Function Evidence')} type={SectionKey.EVIDENCE}>
      <KeyValueList data={keyValueListData} shouldSort={false} />
    </InterimSection>
  );
}
