import {Button} from 'sentry/components/button';
import {EventDataSection} from 'sentry/components/events/eventDataSection';
import KeyValueList from 'sentry/components/events/interfaces/keyValueList';
import {IconProfiling} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {
  generateEventSlug,
  generateLinkToEventInTraceView,
} from 'sentry/utils/discover/urls';
import {generateProfileFlamechartRouteWithHighlightFrame} from 'sentry/utils/profiling/routes';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

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
            actionButton: (
              <Button
                size="xs"
                to={generateLinkToEventInTraceView({
                  dataRow: {
                    id: evidenceData.transactionId,
                    trace: traceSlug,
                    timestamp: evidenceData.timestamp,
                  },
                  eventSlug: generateEventSlug({
                    id: evidenceData.transactionId,
                    project: projectSlug,
                  }),
                  eventView: EventView.fromLocation(location),
                  location: {...location, query: {...location.query, referrer: 'issue'}},
                  organization,
                })}
              >
                {t('View Transaction')}
              </Button>
            ),
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
              <Button
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
              </Button>
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
    <EventDataSection title="Function Evidence" type="evidence">
      <KeyValueList data={keyValueListData} shouldSort={false} />
    </EventDataSection>
  );
}
