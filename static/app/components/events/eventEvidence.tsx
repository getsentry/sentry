import KeyValueList from 'sentry/components/events/interfaces/keyValueList';
import {ProfileEventEvidence} from 'sentry/components/events/profileEventEvidence';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {eventIsProfilingIssue} from 'sentry/utils/events';
import {
  getConfigForIssueType,
  getIssueCategoryAndTypeFromOccurrenceType,
} from 'sentry/utils/issueTypeConfig';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';

type EvidenceProps = {event: Event; project: Project; group?: Group};

/**
 * This component is rendered whenever an `event.occurrence.evidenceDisplay` is
 * present and the issue type config is set up to use evidenceDisplay.
 */
export function EventEvidence({event, group, project}: EvidenceProps) {
  if (!event.occurrence) {
    return null;
  }
  if (eventIsProfilingIssue(event)) {
    return <ProfileEventEvidence event={event} projectSlug={project.slug} />;
  }

  const {issueCategory, issueType} =
    group ?? getIssueCategoryAndTypeFromOccurrenceType(event.occurrence.type);

  const config = getConfigForIssueType({issueCategory, issueType}, project).evidence;
  const evidenceDisplay = event.occurrence?.evidenceDisplay;

  if (!evidenceDisplay?.length || !config) {
    return null;
  }

  return (
    <InterimSection
      type={SectionKey.EVIDENCE}
      title={config.title}
      help={config.helpText}
    >
      <KeyValueList
        data={evidenceDisplay.map(item => ({
          subject: item.name,
          key: item.name,
          value: item.value,
        }))}
        shouldSort={false}
      />
    </InterimSection>
  );
}
