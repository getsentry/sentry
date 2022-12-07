from __future__ import annotations

from typing import Any, Optional

from sentry.issues.issue_occurrence import IssueOccurrence, IssueOccurrenceData


def save_issue_occurrence(
    occurrence_data: IssueOccurrenceData, event_data: Optional[dict[str, Any]] = None
) -> None:
    event_id = occurrence_data.get("event_id")
    if event_id is None:
        if event_data is None:
            raise ValueError("At least one of `event_id` or `event_data` must be passed")

        occurrence_data["event_id"] = event_data["id"]

    # Convert occurrence data to `IssueOccurrence`
    occurrence = IssueOccurrence.from_dict(occurrence_data)
    occurrence.save()

    if event_data:
        # TODO: Save event via EventManager
        pass

    # TODO: Create/update issue
    # TODO: Write occurrence and event eventstream
