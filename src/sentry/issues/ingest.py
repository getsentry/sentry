from __future__ import annotations

from typing import Optional

from sentry.eventstore.models import Event
from sentry.issues.issue_occurrence import IssueOccurrence, IssueOccurrenceData


def save_issue_occurrence(
    occurrence_data: IssueOccurrenceData, event: Optional[Event] = None
) -> None:
    # Convert occurrence data to `IssueOccurrence`
    occurrence = IssueOccurrence.from_dict(occurrence_data)
    occurrence.save()

    # TODO: Create/update issue
    # TODO: Write occurrence and event eventstream
