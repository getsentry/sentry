import {EventDataSection} from 'sentry/components/events/eventDataSection';
import KeyValueList from 'sentry/components/events/interfaces/keyValueList';
import {ProfileEventEvidence} from 'sentry/components/events/profileEventEvidence';
import {Event, Group, IssueCategory} from 'sentry/types';
import {
  getConfigForIssueType,
  getIssueCategoryAndTypeFromOccurrenceType,
} from 'sentry/utils/issueTypeConfig';

type EvidenceProps = {event: Event; projectSlug: string; group?: Group};

/**
 * This component is rendered whenever an `event.occurrence.evidenceDisplay` is
 * present and the issue type config is set up to use evidenceDisplay.
 */
export function EventEvidence({event, group, projectSlug}: EvidenceProps) {
  if (!event.occurrence) {
    return null;
  }

  const {issueCategory, issueType} =
    group ?? getIssueCategoryAndTypeFromOccurrenceType(event.occurrence.type);

  if (issueCategory === IssueCategory.PROFILE) {
    return <ProfileEventEvidence event={event} projectSlug={projectSlug} />;
  }

  const config = getConfigForIssueType({issueCategory, issueType}).evidence;
  const evidenceDisplay = event.occurrence?.evidenceDisplay;

  if (!evidenceDisplay?.length || !config) {
    return null;
  }

  return (
    <EventDataSection title={config.title} type="evidence" help={config.helpText}>
      <KeyValueList
        data={evidenceDisplay.map(item => ({
          subject: item.name,
          key: item.name,
          value: item.value,
        }))}
        shouldSort={false}
      />
    </EventDataSection>
  );
}
