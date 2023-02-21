import {EventDataSection} from 'sentry/components/events/eventDataSection';
import KeyValueList from 'sentry/components/events/interfaces/keyValueList';
import Link from 'sentry/components/links/link';
import {Event} from 'sentry/types';
import {generateProfileFlamechartRouteWithHighlightFrame} from 'sentry/utils/profiling/routes';
import useOrganization from 'sentry/utils/useOrganization';

type ProfileEvidenceProps = {event: Event; projectSlug: string};

export const ProfileEventEvidence = ({event, projectSlug}: ProfileEvidenceProps) => {
  const organization = useOrganization();
  const evidenceData = event.occurrence?.evidenceData ?? {};
  const evidenceDisplay = event.occurrence?.evidenceDisplay ?? [];

  const frameName = evidenceData.frameName;
  const framePackage = evidenceData.framePackage;

  const keyValueListData = [
    {
      subject: 'Profile ID',
      key: 'Profile ID',
      value: (
        <pre>
          <Link
            to={generateProfileFlamechartRouteWithHighlightFrame({
              profileId: event.id,
              projectSlug,
              orgSlug: organization.slug,
              frameName,
              framePackage,
              query: {
                referrer: 'issue-details',
              },
            })}
          >
            {event.id}
          </Link>
        </pre>
      ),
    },
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
};
