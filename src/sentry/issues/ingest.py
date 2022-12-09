from __future__ import annotations

from sentry.eventstore.models import Event
from sentry.issues.issue_occurrence import IssueOccurrence, IssueOccurrenceData


def save_issue_occurrence(occurrence_data: IssueOccurrenceData, event: Event) -> IssueOccurrence:
    # Convert occurrence data to `IssueOccurrence`
    occurrence = IssueOccurrence.from_dict(occurrence_data)
    if occurrence.event_id != event.event_id:
        raise ValueError("IssueOccurrence must have the same event_id as the passed Event")
    # Note: For now we trust the project id passed along with the event. Later on we should make
    # sure that this is somehow validated.
    occurrence.save(event.project_id)

    # TODO: Create/update issue
    # TODO: Write occurrence and event eventstream
    return occurrence
