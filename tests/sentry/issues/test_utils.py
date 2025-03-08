from __future__ import annotations

import uuid
from collections.abc import Sequence
from datetime import datetime, timedelta
from typing import Any

from django.utils import timezone

from sentry.event_manager import GroupInfo
from sentry.eventstore.models import Event
from sentry.issues.escalating import GroupsCountResponse
from sentry.issues.grouptype import ProfileFileIOGroupType
from sentry.issues.ingest import hash_fingerprint_parts, save_issue_occurrence
from sentry.issues.issue_occurrence import IssueEvidence, IssueOccurrence, IssueOccurrenceData
from sentry.issues.occurrence_consumer import process_event_and_issue_occurrence
from sentry.issues.status_change_message import StatusChangeMessage, StatusChangeMessageData
from sentry.models.group import Group
from sentry.snuba.dataset import Dataset


class OccurrenceTestMixin:
    def assert_occurrences_identical(
        self, o1: IssueOccurrence | None, o2: IssueOccurrence | None
    ) -> None:
        assert o1 is not None
        assert o2 is not None
        assert o1.id == o2.id
        assert o1.event_id == o2.event_id
        assert o1.fingerprint == o2.fingerprint
        assert o1.issue_title == o2.issue_title
        assert o1.subtitle == o2.subtitle
        assert o1.resource_id == o2.resource_id
        assert o1.evidence_data == o2.evidence_data
        assert o1.evidence_display == o2.evidence_display
        assert o1.type == o2.type
        assert o1.detection_time == o2.detection_time
        assert o1.initial_issue_priority == o2.initial_issue_priority

    def build_occurrence_data(self, **overrides: Any) -> IssueOccurrenceData:
        kwargs: IssueOccurrenceData = {
            "id": uuid.uuid4().hex,
            "project_id": 1,
            "event_id": uuid.uuid4().hex,
            "fingerprint": hash_fingerprint_parts(["some-fingerprint"]),
            "issue_title": "something bad happened",
            "subtitle": "it was bad",
            "culprit": "api/123",
            "resource_id": "1234",
            "evidence_data": {"Test": 123},
            "evidence_display": [
                {"name": "hi", "value": "bye", "important": True},
                {"name": "what", "value": "where", "important": False},
            ],
            "type": ProfileFileIOGroupType.type_id,
            "detection_time": datetime.now().timestamp(),
            "level": "warning",
        }
        kwargs.update(overrides)  # type: ignore[typeddict-item]

        return kwargs

    def build_occurrence(self, **overrides: Any) -> IssueOccurrence:
        if "evidence_display" in overrides:
            evidence_display = overrides["evidence_display"]
            overrides["evidence_display"] = [
                item.to_dict() if isinstance(item, IssueEvidence) else item
                for item in evidence_display
            ]

        return IssueOccurrence.from_dict(self.build_occurrence_data(**overrides))

    def process_occurrence(
        self, event_data: dict[str, Any], **overrides: Any
    ) -> tuple[IssueOccurrence, GroupInfo | None]:
        """
        Testutil to build and process occurrence data instead of going through Kafka.
        This ensures the occurrence data is well-formed.
        """
        occurrence_data = self.build_occurrence_data(**overrides)
        if "event_id" not in event_data:
            event_data["event_id"] = occurrence_data["event_id"]
        if "project_id" not in event_data:
            event_data["project_id"] = occurrence_data["project_id"]
        return process_event_and_issue_occurrence(occurrence_data, event_data)


class StatusChangeTestMixin:
    def build_statuschange_data(self, **overrides: Any) -> StatusChangeMessageData:
        kwargs: StatusChangeMessageData = {
            "id": uuid.uuid4().hex,
            "project_id": 1,
            "fingerprint": hash_fingerprint_parts(["some-fingerprint"]),
            "new_status": 1,
            "new_substatus": 1,
        }
        kwargs.update(overrides)  # type: ignore[typeddict-item]

        return kwargs

    def build_statuschange(self, **overrides: Any) -> StatusChangeMessage:

        return StatusChangeMessage(**self.build_statuschange_data(**overrides))


class SearchIssueTestMixin(OccurrenceTestMixin):
    def store_search_issue(
        self,
        project_id: int,
        user_id: int,
        fingerprints: Sequence[str],
        environment: str | None = None,
        insert_time: datetime | None = None,
        tags: Sequence[tuple[str, Any]] | None = None,
        release: str | None = None,
        user: dict[str, Any] | None = None,
        event_data: dict[str, Any] | None = None,
        override_occurrence_data: dict[str, Any] | None = None,
    ) -> tuple[Event, IssueOccurrence, GroupInfo | None]:
        from sentry.utils import snuba

        insert_timestamp = (insert_time if insert_time else timezone.now()).replace(microsecond=0)
        user_id_val = f"user_{user_id}"

        event_data = {
            "tags": [("sentry:user", user_id_val)],
            "timestamp": insert_timestamp.isoformat(),
            **(event_data or {}),
        }
        if tags:
            event_data["tags"].extend(tags)

        if user:
            event_data["user"] = user

        if environment:
            event_data["environment"] = environment
            event_data["tags"].extend([("environment", environment)])

        if release:
            event_data["release"] = release
            event_data["tags"].extend([("release", release)])

        event = self.store_event(
            data=event_data,
            project_id=project_id,
        )
        occurrence = self.build_occurrence(
            event_id=event.event_id, fingerprint=fingerprints, **(override_occurrence_data or {})
        )
        saved_occurrence, group_info = save_issue_occurrence(occurrence.to_dict(), event)
        self.assert_occurrences_identical(occurrence, saved_occurrence)

        assert Group.objects.filter(grouphash__hash=saved_occurrence.fingerprint[0]).exists()

        result = snuba.raw_query(
            dataset=Dataset.IssuePlatform,
            start=insert_timestamp - timedelta(days=1),
            end=insert_timestamp + timedelta(days=1),
            selected_columns=[
                "event_id",
                "project_id",
                "environment",
                "group_id",
                "tags[sentry:user]",
                "timestamp",
            ],
            groupby=None,
            filter_keys={"project_id": [project_id], "event_id": [event.event_id]},
            referrer="test_utils.store_search_issue",
            tenant_ids={"referrer": "test_utils.store_search_issue", "organization_id": 1},
        )
        assert len(result["data"]) == 1
        assert result["data"][0]["project_id"] == project_id
        assert result["data"][0]["group_id"] == group_info.group.id if group_info else None
        assert (
            result["data"][0]["tags[sentry:user]"] == user_id_val if not user else f"id:{user_id}"
        )
        assert result["data"][0]["environment"] == environment
        assert result["data"][0]["timestamp"] == insert_timestamp.isoformat()

        return event, saved_occurrence, group_info


def get_mock_groups_past_counts_response(
    num_days: int,
    num_hours: int,
    groups: list[Group],
) -> list[GroupsCountResponse]:
    """
    Returns a mocked response of type `GroupsCountResponse` from `query_groups_past_counts`.
    Creates event count data for each group in `groups` for `num_days`, for `num_hours`.

    `groups`: The groups that data will be generated for
    `num_days`: The number of days that data will be generated for
    `num_hours`: The number of hours per day that data will be generated for
    """
    data = []
    now = datetime.now()

    for group in groups:
        for day in range(num_days, 0, -1):
            time = now - timedelta(days=day)

            for hour in range(num_hours, 0, -1):
                hourly_time = time - timedelta(hours=hour)
                data.append(
                    GroupsCountResponse(
                        {
                            "group_id": group.id,
                            "hourBucket": hourly_time.strftime("%Y-%m-%dT%H:%M:%S%f") + "+00:00",
                            "count()": 10,
                            "project_id": group.project.id,
                        }
                    )
                )
    return data
