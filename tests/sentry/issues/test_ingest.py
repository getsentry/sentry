from dataclasses import replace
from hashlib import md5
from unittest import mock

from sentry.constants import LOG_LEVELS_MAP
from sentry.event_manager import GroupInfo
from sentry.issues.ingest import (
    _create_issue_kwargs,
    materialize_metadata,
    process_occurrence_data,
    save_issue_from_occurrence,
    save_issue_occurrence,
    send_issue_occurrence_to_eventstream,
)
from sentry.models import Group
from sentry.ratelimits.sliding_windows import Quota
from sentry.testutils import TestCase
from sentry.testutils.silo import region_silo_test
from sentry.types.issues import GroupType
from tests.sentry.issues.test_utils import OccurrenceTestMixin


@region_silo_test
class SaveIssueOccurrenceTest(OccurrenceTestMixin, TestCase):  # type: ignore
    def test(self) -> None:
        # TODO: We should make this a platform event once we have one
        event = self.store_event(data={}, project_id=self.project.id)
        occurrence = self.build_occurrence(event_id=event.event_id)
        saved_occurrence = save_issue_occurrence(occurrence.to_dict(), event)[0]
        occurrence = replace(
            occurrence,
            fingerprint=[md5(fp.encode("utf-8")).hexdigest() for fp in occurrence.fingerprint],
        )
        self.assert_occurrences_identical(occurrence, saved_occurrence)
        assert Group.objects.filter(grouphash__hash=saved_occurrence.fingerprint[0]).exists()
        # TODO: Query this data and make sure it's present once we have a corresponding dataset in
        # snuba
        # result = snuba.raw_query(
        #     dataset=snuba.Dataset.IssuePlatform,
        #     start=now - timedelta(days=1),
        #     end=now + timedelta(days=1),
        #     selected_columns=["event_id", "group_id", "occurrence_id"],
        #     groupby=None,
        #     filter_keys={"project_id": [self.project.id], "event_id": [event.event_id]},
        # )
        # assert len(result["data"]) == 1
        # assert result["data"][0]["group_ids"] == [self.group.id]

    def test_different_ids(self) -> None:
        # TODO: We should make this a platform event once we have one
        event = self.store_event(data={}, project_id=self.project.id)
        occurrence = self.build_occurrence()
        with self.assertRaisesMessage(
            ValueError, "IssueOccurrence must have the same event_id as the passed Event"
        ):
            save_issue_occurrence(occurrence.to_dict(), event)


@region_silo_test
class ProcessOccurrenceDataTest(OccurrenceTestMixin, TestCase):  # type: ignore
    def test(self) -> None:
        data = self.build_occurrence_data(fingerprint=["hi", "bye"])
        process_occurrence_data(data)
        assert data["fingerprint"] == [
            md5(b"hi").hexdigest(),
            md5(b"bye").hexdigest(),
        ]


@region_silo_test
class SaveIssueFromOccurrenceTest(OccurrenceTestMixin, TestCase):  # type: ignore
    def test_new_group(self) -> None:
        occurrence = self.build_occurrence()
        event = self.store_event(data={}, project_id=self.project.id)
        group_info = save_issue_from_occurrence(occurrence, event, None)
        assert group_info is not None
        assert group_info.is_new
        assert not group_info.is_regression
        group = group_info.group
        assert group.title == occurrence.issue_title
        assert group.platform == event.platform
        assert group.level == LOG_LEVELS_MAP.get(event.data["level"])
        assert group.last_seen == event.datetime
        assert group.first_seen == event.datetime
        assert group.active_at == event.datetime
        assert group.issue_type == occurrence.type
        assert group.first_release is None
        assert group.data["culprit"] == occurrence.subtitle
        assert group.data["title"] == occurrence.issue_title
        assert group.location() == event.location

    def test_existing_group(self) -> None:
        event = self.store_event(data={}, project_id=self.project.id)
        occurrence = self.build_occurrence()
        save_issue_from_occurrence(occurrence, event, None)

        new_event = self.store_event(data={}, project_id=self.project.id)
        new_occurrence = self.build_occurrence(
            fingerprint=occurrence.fingerprint, subtitle="new subtitle", issue_title="new title"
        )
        with self.tasks():
            updated_group_info = save_issue_from_occurrence(new_occurrence, new_event, None)
        assert updated_group_info is not None
        updated_group = updated_group_info.group
        updated_group.refresh_from_db()
        assert updated_group_info.group.id == updated_group.id
        assert not updated_group_info.is_new
        assert not updated_group_info.is_regression
        assert updated_group.culprit == new_occurrence.subtitle
        assert updated_group.title == new_occurrence.issue_title
        assert updated_group.location() == event.location
        assert updated_group.times_seen == 2

    def test_existing_group_different_category(self) -> None:
        event = self.store_event(data={}, project_id=self.project.id)
        occurrence = self.build_occurrence()
        group_info = save_issue_from_occurrence(occurrence, event, None)
        assert group_info is not None

        new_event = self.store_event(data={}, project_id=self.project.id)
        new_occurrence = self.build_occurrence(
            fingerprint=occurrence.fingerprint, type=GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES
        )
        with mock.patch("sentry.issues.ingest.logger") as logger:
            assert save_issue_from_occurrence(new_occurrence, new_event, None) is None
            logger.error.assert_called_once_with(
                "save_issue_from_occurrence.category_mismatch",
                extra={
                    "issue_category": group_info.group.issue_category,
                    "event_type": "platform",
                    "group_id": group_info.group.id,
                },
            )

    def test_rate_limited(self) -> None:
        event = self.store_event(data={}, project_id=self.project.id)
        occurrence = self.build_occurrence()
        group_info = save_issue_from_occurrence(occurrence, event, None)
        assert group_info is not None

        new_event = self.store_event(data={}, project_id=self.project.id)
        new_occurrence = self.build_occurrence(fingerprint=["another-fingerprint"])
        with mock.patch("sentry.issues.ingest.metrics") as metrics, mock.patch(
            "sentry.issues.ingest.ISSUE_QUOTA", Quota(3600, 60, 1)
        ):
            assert save_issue_from_occurrence(new_occurrence, new_event, None) is None
            metrics.incr.assert_called_once_with("issues.issue.dropped")


class CreateIssueKwargsTest(OccurrenceTestMixin, TestCase):  # type: ignore
    def test(self) -> None:
        occurrence = self.build_occurrence()
        event = self.store_event(data={}, project_id=self.project.id)
        assert _create_issue_kwargs(occurrence, event, None) == {
            "platform": event.platform,
            "message": event.search_message,
            "level": LOG_LEVELS_MAP.get(event.data["level"]),
            "culprit": occurrence.subtitle,
            "last_seen": event.datetime,
            "first_seen": event.datetime,
            "active_at": event.datetime,
            "type": occurrence.type.value,
            "first_release": None,
            "data": materialize_metadata(occurrence, event),
        }


class MaterializeMetadataTest(OccurrenceTestMixin, TestCase):  # type: ignore
    def test(self) -> None:
        occurrence = self.build_occurrence()
        event = self.store_event(data={}, project_id=self.project.id)
        assert materialize_metadata(occurrence, event) == {
            "type": "default",
            # Not totally sure if this makes sense?
            "culprit": occurrence.subtitle,
            "metadata": {"title": occurrence.issue_title},
            "title": occurrence.issue_title,
            "location": event.location,
            "last_received": event.datetime,
        }


@region_silo_test
class SaveIssueOccurrenceToEventstreamTest(OccurrenceTestMixin, TestCase):  # type: ignore
    def test(self) -> None:
        # TODO: We should make this a platform event once we have one
        event = self.store_event(data={}, project_id=self.project.id)
        group_event = event.for_group(self.group)
        occurrence = self.build_occurrence(event_id=event.event_id)
        group_info = GroupInfo(event.group, True, False, None, False)
        with mock.patch("sentry.issues.ingest.eventstream") as eventstream, mock.patch.object(
            event, "for_group", return_value=group_event
        ):
            send_issue_occurrence_to_eventstream(event, occurrence, group_info)
            eventstream.insert.assert_called_once_with(
                event=group_event,
                is_new=group_info.is_new,
                is_regression=group_info.is_regression,
                is_new_group_environment=group_info.is_new_group_environment,
                primary_hash=occurrence.fingerprint[0],
                received_timestamp=group_event.data.get("received")
                or group_event.datetime.timestamp(),
                skip_consume=False,
                group_states=[
                    {
                        "id": group_info.group.id,
                        "is_new": group_info.is_new,
                        "is_regression": group_info.is_regression,
                        "is_new_group_environment": group_info.is_new_group_environment,
                    }
                ],
            )
