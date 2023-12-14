import {Button} from 'sentry/components/button';
import {EventDataSection} from 'sentry/components/events/eventDataSection';
import KeyValueList from 'sentry/components/events/interfaces/keyValueList';
import {IconProfiling} from 'sentry/icons';
import {t} from 'sentry/locale';
import {Event} from 'sentry/types';
import {generateEventSlug} from 'sentry/utils/discover/urls';
import {getTransactionDetailsUrl} from 'sentry/utils/performance/urls';
import {generateProfileFlamechartRouteWithHighlightFrame} from 'sentry/utils/profiling/routes';
import useOrganization from 'sentry/utils/useOrganization';

type ProfileEvidenceProps = {event: Event; projectSlug: string};

export function ProfileEventEvidence({event, projectSlug}: ProfileEvidenceProps) {
  const organization = useOrganization();
  const evidenceData = event.occurrence?.evidenceData ?? {};
  const evidenceDisplay = event.occurrence?.evidenceDisplay ?? [];

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
                to={getTransactionDetailsUrl(
                  organization.slug,
                  generateEventSlug({
                    id: evidenceData.transactionId,
                    project: projectSlug,
                  }),
                  undefined,
                  {referrer: 'issue'}
                )}
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
