from dataclasses import dataclass, replace
from datetime import datetime, timedelta
from hashlib import md5
from unittest import mock
from unittest.mock import patch

from sentry.constants import LOG_LEVELS_MAP
from sentry.issues.grouptype import (
    GroupCategory,
    GroupType,
    GroupTypeRegistry,
    MonitorCheckInFailure,
    NoiseConfig,
)
from sentry.issues.ingest import (
    _create_issue_kwargs,
    materialize_metadata,
    process_occurrence_data,
    save_issue_from_occurrence,
    save_issue_occurrence,
    send_issue_occurrence_to_eventstream,
)
from sentry.models import (
    Environment,
    Group,
    GroupEnvironment,
    GroupRelease,
    Release,
    ReleaseProject,
    ReleaseProjectEnvironment,
)
from sentry.ratelimits.sliding_windows import Quota
from sentry.receivers import create_default_projects
from sentry.snuba.dataset import Dataset
from sentry.testutils import TestCase
from sentry.testutils.silo import region_silo_test
from sentry.utils import json
from sentry.utils.samples import load_data
from sentry.utils.snuba import raw_query
from tests.sentry.issues.test_utils import OccurrenceTestMixin


@region_silo_test
class SaveIssueOccurrenceTest(OccurrenceTestMixin, TestCase):
    def test(self) -> None:
        event = self.store_event(data={}, project_id=self.project.id)
        occurrence = self.build_occurrence(event_id=event.event_id)
        saved_occurrence, group_info = save_issue_occurrence(occurrence.to_dict(), event)
        assert group_info is not None
        occurrence = replace(
            occurrence,
            fingerprint=[md5(fp.encode("utf-8")).hexdigest() for fp in occurrence.fingerprint],
        )
        self.assert_occurrences_identical(occurrence, saved_occurrence)
        assert Group.objects.filter(grouphash__hash=saved_occurrence.fingerprint[0]).exists()
        now = datetime.now()
        result = raw_query(
            dataset=Dataset.IssuePlatform,
            start=now - timedelta(days=1),
            end=now + timedelta(days=1),
            selected_columns=["event_id", "group_id", "occurrence_id"],
            groupby=None,
            filter_keys={"project_id": [self.project.id], "event_id": [event.event_id]},
            tenant_ids={"referrer": "r", "organization_id": 1},
        )
        assert len(result["data"]) == 1
        assert result["data"][0]["group_id"] == group_info.group.id
        assert result["data"][0]["event_id"] == occurrence.event_id
        assert result["data"][0]["occurrence_id"] == occurrence.id

    def test_new_group_release_env(self) -> None:
        version = "test"
        env_name = "some_env"
        event = self.store_event(
            data={"release": version, "environment": env_name}, project_id=self.project.id
        )
        release = Release.objects.get(organization_id=self.organization.id, version=version)
        environment = Environment.objects.get(organization_id=self.organization.id, name=env_name)
        release_project = ReleaseProject.objects.get(project=self.project, release=release)
        assert release_project.new_groups == 0
        release_project_env = ReleaseProjectEnvironment.objects.get(
            project=self.project, release=release, environment=environment
        )
        assert release_project_env.new_issues_count == 0
        occurrence_data = self.build_occurrence_data(event_id=event.event_id)
        with self.tasks():
            occurrence, group_info = save_issue_occurrence(occurrence_data, event)
        assert group_info is not None
        group = group_info.group
        assert group_info is not None
        assert group_info.is_new
        assert group_info.is_new_group_environment
        assert group_info.group.first_release == release
        assert GroupEnvironment.objects.filter(group=group, environment=environment)
        release_project.refresh_from_db()
        assert release_project.new_groups == 1
        release_project_env.refresh_from_db()
        assert release_project_env.new_issues_count == 1
        assert GroupRelease.objects.filter(group_id=group.id, release_id=release.id).exists()

    def test_different_ids(self) -> None:
        create_default_projects()
        event_data = load_data("generic-event-profiling").data
        project_id = event_data["event"].pop("project_id", self.project.id)
        event_data["event"]["timestamp"] = datetime.utcnow().isoformat()
        event = self.store_event(data=event_data["event"], project_id=project_id)
        occurrence = self.build_occurrence()
        with self.assertRaisesMessage(
            ValueError, "IssueOccurrence must have the same event_id as the passed Event"
        ):
            save_issue_occurrence(occurrence.to_dict(), event)


@region_silo_test
class ProcessOccurrenceDataTest(OccurrenceTestMixin, TestCase):
    def test(self) -> None:
        data = self.build_occurrence_data(fingerprint=["hi", "bye"])
        process_occurrence_data(data)
        assert data["fingerprint"] == [
            md5(b"hi").hexdigest(),
            md5(b"bye").hexdigest(),
        ]


@region_silo_test
class SaveIssueFromOccurrenceTest(OccurrenceTestMixin, TestCase):
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
        assert group.level == LOG_LEVELS_MAP.get(occurrence.level)
        assert group.last_seen == event.datetime
        assert group.first_seen == event.datetime
        assert group.active_at == event.datetime
        assert group.issue_type == occurrence.type
        assert group.first_release is None
        assert group.title == occurrence.issue_title
        assert group.data["metadata"]["value"] == occurrence.subtitle
        assert group.culprit == occurrence.culprit
        assert group.message == "<unlabeled event> something bad happened it was bad api/123"
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
        assert updated_group.title == new_occurrence.issue_title
        assert updated_group.data["metadata"]["value"] == new_occurrence.subtitle
        assert updated_group.culprit == new_occurrence.culprit
        assert updated_group.location() == event.location
        assert updated_group.times_seen == 2
        assert updated_group.message == "<unlabeled event> new title new subtitle api/123"

    def test_existing_group_different_category(self) -> None:
        event = self.store_event(data={}, project_id=self.project.id)
        occurrence = self.build_occurrence()
        group_info = save_issue_from_occurrence(occurrence, event, None)
        assert group_info is not None

        new_event = self.store_event(data={}, project_id=self.project.id)
        new_occurrence = self.build_occurrence(
            fingerprint=occurrence.fingerprint, type=MonitorCheckInFailure.type_id
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
            metrics.incr.assert_called_once_with("issues.issue.dropped.rate_limiting")

    def test_noise_reduction(self) -> None:
        with patch("sentry.issues.grouptype.registry", new=GroupTypeRegistry()):

            @dataclass(frozen=True)
            class TestGroupType(GroupType):
                type_id = 1
                slug = "test"
                description = "Test"
                category = GroupCategory.PROFILE.value
                noise_config = NoiseConfig(ignore_limit=2)

            event = self.store_event(data={}, project_id=self.project.id)
            occurrence = self.build_occurrence(type=TestGroupType.type_id)
            with mock.patch("sentry.issues.ingest.metrics") as metrics:
                assert save_issue_from_occurrence(occurrence, event, None) is None
                metrics.incr.assert_called_once_with("issues.issue.dropped.noise_reduction")

            new_event = self.store_event(data={}, project_id=self.project.id)
            new_occurrence = self.build_occurrence(type=TestGroupType.type_id)
            group_info = save_issue_from_occurrence(new_occurrence, new_event, None)
            assert group_info is not None


class CreateIssueKwargsTest(OccurrenceTestMixin, TestCase):
    def test(self) -> None:
        occurrence = self.build_occurrence()
        event = self.store_event(data={}, project_id=self.project.id)
        assert _create_issue_kwargs(occurrence, event, None) == {
            "platform": event.platform,
            "message": event.search_message,
            "level": LOG_LEVELS_MAP.get(occurrence.level),
            "culprit": occurrence.culprit,
            "last_seen": event.datetime,
            "first_seen": event.datetime,
            "active_at": event.datetime,
            "type": occurrence.type.type_id,
            "first_release": None,
            "data": materialize_metadata(occurrence, event),
        }


class MaterializeMetadataTest(OccurrenceTestMixin, TestCase):
    def test(self) -> None:
        occurrence = self.build_occurrence()
        event = self.store_event(data={}, project_id=self.project.id)
        assert materialize_metadata(occurrence, event) == {
            "type": "default",
            "culprit": occurrence.culprit,
            "metadata": {"title": occurrence.issue_title, "value": occurrence.subtitle},
            "title": occurrence.issue_title,
            "location": event.location,
            "last_received": json.datetime_to_str(event.datetime),
        }


@region_silo_test
class SaveIssueOccurrenceToEventstreamTest(OccurrenceTestMixin, TestCase):
    def test(self) -> None:
        create_default_projects()
        event_data = load_data("generic-event-profiling").data
        project_id = event_data["event"].pop("project_id")
        event_data["event"]["timestamp"] = datetime.utcnow().isoformat()
        event = self.store_event(data=event_data["event"], project_id=project_id)
        occurrence = self.build_occurrence(event_id=event.event_id)
        group_info = save_issue_from_occurrence(occurrence, event, None)
        assert group_info is not None

        group_event = event.for_group(group_info.group)
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
