from collections import namedtuple
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from hashlib import md5
from unittest import mock
from unittest.mock import patch

from django.utils import timezone

from sentry.api.helpers.group_index.update import handle_priority
from sentry.constants import LOG_LEVELS_MAP, MAX_CULPRIT_LENGTH
from sentry.grouping.grouptype import ErrorGroupType
from sentry.incidents.grouptype import MetricIssue, MetricIssueDetectorHandler
from sentry.incidents.utils.types import AnomalyDetectionUpdate, ProcessedSubscriptionUpdate
from sentry.issues.grouptype import (
    FeedbackGroup,
    GroupCategory,
    GroupType,
    GroupTypeRegistry,
    NoiseConfig,
)
from sentry.issues.ingest import (
    _create_issue_kwargs,
    hash_fingerprint,
    materialize_metadata,
    save_issue_from_occurrence,
    save_issue_occurrence,
    send_issue_occurrence_to_eventstream,
)
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.models.environment import Environment
from sentry.models.group import Group
from sentry.models.groupassignee import GroupAssignee
from sentry.models.groupenvironment import GroupEnvironment
from sentry.models.grouphash import GroupHash
from sentry.models.groupopenperiod import get_latest_open_period
from sentry.models.groupopenperiodactivity import GroupOpenPeriodActivity, OpenPeriodActivityType
from sentry.models.grouprelease import GroupRelease
from sentry.models.release import Release
from sentry.models.releaseprojectenvironment import ReleaseProjectEnvironment
from sentry.models.releases.release_project import ReleaseProject
from sentry.monitors.grouptype import MonitorIncidentType
from sentry.ratelimits.sliding_windows import RequestedQuota
from sentry.receivers import create_default_projects
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import QuerySubscription, SnubaQuery
from sentry.testutils.cases import TestCase
from sentry.testutils.skips import requires_snuba
from sentry.types.group import PriorityLevel
from sentry.utils import json
from sentry.utils.samples import load_data
from sentry.utils.snuba import raw_query
from sentry.workflow_engine.models import DataCondition, DataConditionGroup, DataPacket
from sentry.workflow_engine.models.alertrule_detector import AlertRuleDetector
from sentry.workflow_engine.models.detector_group import DetectorGroup
from sentry.workflow_engine.types import DetectorPriorityLevel
from tests.sentry.issues.test_utils import OccurrenceTestMixin

pytestmark = [requires_snuba]


class SaveIssueOccurrenceTest(OccurrenceTestMixin, TestCase):
    def test(self) -> None:
        event = self.store_event(data={}, project_id=self.project.id)
        occurrence = self.build_occurrence(event_id=event.event_id)
        saved_occurrence, group_info = save_issue_occurrence(occurrence.to_dict(), event)
        assert group_info is not None
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
        with self.tasks(), mock.patch("sentry.issues.ingest.eventstream") as eventstream:
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
        eventstream.backend.insert.assert_called_once_with(
            event=event.for_group(group_info.group),
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            primary_hash=occurrence.fingerprint[0],
            received_timestamp=event.data.get("received") or event.datetime,
            skip_consume=False,
            group_states=[
                {
                    "id": group_info.group.id,
                    "is_new": True,
                    "is_regression": False,
                    "is_new_group_environment": True,
                }
            ],
        )

    def test_different_ids(self) -> None:
        create_default_projects()
        event_data = load_data("generic-event-profiling")
        project_id = event_data["event"].pop("project_id", self.project.id)
        event_data["event"]["timestamp"] = timezone.now().isoformat()
        event = self.store_event(data=event_data["event"], project_id=project_id)
        occurrence = self.build_occurrence()
        with self.assertRaisesMessage(
            ValueError, "IssueOccurrence must have the same event_id as the passed Event"
        ):
            save_issue_occurrence(occurrence.to_dict(), event)

    def test_new_group_with_default_priority(self) -> None:
        event = self.store_event(data={}, project_id=self.project.id)
        occurrence = self.build_occurrence(event_id=event.event_id)
        _, group_info = save_issue_occurrence(occurrence.to_dict(), event)
        assert group_info is not None
        assert group_info.group.priority == PriorityLevel.LOW

    def test_new_group_with_priority(self) -> None:
        event = self.store_event(data={}, project_id=self.project.id)
        occurrence = self.build_occurrence(
            event_id=event.event_id,
            priority=PriorityLevel.HIGH,
        )
        _, group_info = save_issue_occurrence(occurrence.to_dict(), event)
        assert group_info is not None
        assert group_info.group.priority == PriorityLevel.HIGH

    def test_new_group_with_user_assignee(self) -> None:
        event = self.store_event(data={}, project_id=self.project.id)
        occurrence = self.build_occurrence(event_id=event.event_id, assignee=f"user:{self.user.id}")
        _, group_info = save_issue_occurrence(occurrence.to_dict(), event)
        assert group_info is not None
        assert group_info.group.priority == PriorityLevel.LOW
        assignee = GroupAssignee.objects.get(group=group_info.group)
        assert assignee.user_id == self.user.id

    def test_new_group_with_team_assignee(self) -> None:
        event = self.store_event(data={}, project_id=self.project.id)
        occurrence = self.build_occurrence(event_id=event.event_id, assignee=f"team:{self.team.id}")
        _, group_info = save_issue_occurrence(occurrence.to_dict(), event)
        assert group_info is not None
        assignee = GroupAssignee.objects.get(group=group_info.group)
        assert assignee.team_id == self.team.id

    def test_issue_platform_handles_deprecated_initial_priority(self) -> None:
        # test initial_issue_priority is handled
        event = self.store_event(data={}, project_id=self.project.id)
        occurrence = self.build_occurrence(
            event_id=event.event_id,
            assignee=f"team:{self.team.id}",
            initial_issue_priority=PriorityLevel.MEDIUM,
        )
        _, group_info = save_issue_occurrence(occurrence.to_dict(), event)
        assert group_info is not None
        group = group_info.group
        assert group.priority == PriorityLevel.MEDIUM

        # test that the priority overrides the initial_issue_priority
        Group.objects.all().delete()
        occurrence = self.build_occurrence(
            event_id=event.event_id,
            assignee=f"team:{self.team.id}",
            initial_issue_priority=PriorityLevel.MEDIUM,
            priority=PriorityLevel.HIGH,
        )
        _, group_info = save_issue_occurrence(occurrence.to_dict(), event)
        assert group_info is not None
        group = group_info.group
        assert group.priority == PriorityLevel.HIGH

    def test_creates_detector_group(self) -> None:
        detector = self.create_detector(
            project=self.project,
            name="Test Detector",
            type="error",
            enabled=True,
            config={},
        )
        event = self.store_event(data={}, project_id=self.project.id)
        occurrence = self.build_occurrence(
            event_id=event.event_id,
            evidence_data={"detector_id": detector.id},
            type=ErrorGroupType.type_id,
        )

        saved_occurrence, group_info = save_issue_occurrence(occurrence.to_dict(), event)
        assert group_info is not None

        detector_group = DetectorGroup.objects.get(group_id=group_info.group.id)
        assert detector_group.detector_id == detector.id

    def test_metric_issue_creates_detector_group(self) -> None:
        from datetime import timedelta

        # Create models for the detector
        snuba_query = SnubaQuery.objects.create(
            type=SnubaQuery.Type.ERROR.value,
            dataset="events",
            query="",
            aggregate="count()",
            time_window=int(timedelta(minutes=5).total_seconds()),
            resolution=int(timedelta(minutes=1).total_seconds()),
        )
        query_subscription = QuerySubscription.objects.create(
            project=self.project,
            snuba_query=snuba_query,
            type="test_subscription",
            status=QuerySubscription.Status.ACTIVE.value,
        )
        condition_group = DataConditionGroup.objects.create(
            organization_id=self.project.organization_id
        )
        _ = DataCondition.objects.create(
            type="gt",
            comparison=10,
            condition_result=DetectorPriorityLevel.HIGH,
            condition_group=condition_group,
        )
        detector = self.create_detector(
            project=self.project,
            name="Test Metric Detector",
            type="metric_issue",
            enabled=True,
            config={"threshold_period": 1, "detection_type": "static"},
            workflow_condition_group=condition_group,
        )
        _ = AlertRuleDetector.objects.create(
            detector=detector,
            alert_rule_id=123,
        )

        # Create event
        event = self.store_event(data={}, project_id=self.project.id)

        query_subscription_update: ProcessedSubscriptionUpdate = ProcessedSubscriptionUpdate(
            entity="events",
            subscription_id=str(query_subscription.id),
            values={"value": 15},
            timestamp=datetime.now(UTC),
        )

        handler = MetricIssueDetectorHandler(detector)
        data_packet: DataPacket[ProcessedSubscriptionUpdate | AnomalyDetectionUpdate] = DataPacket(
            str(query_subscription.id), query_subscription_update
        )
        eval_result = handler.evaluate(data_packet)

        occurrence = None
        for result in eval_result.values():
            if result.result is None:
                continue

            if (
                isinstance(result.result, IssueOccurrence)
                and result.result.evidence_data
                and "detector_id" in result.result.evidence_data
            ):
                occurrence = result.result
                break

        assert occurrence is not None, "No occurrence was created by the handler"

        # Update the occurrence dict to have the correct event_id
        occurrence_dict = occurrence.to_dict()
        occurrence_dict["event_id"] = event.event_id

        with self.tasks(), mock.patch("sentry.issues.ingest.eventstream") as _:
            saved_occurrence, group_info = save_issue_occurrence(occurrence_dict, event)
            assert group_info is not None

            detector_group = DetectorGroup.objects.get(detector_id=detector.id)
            assert detector_group.group_id == group_info.group.id

    def test_no_detector_group_without_detector_id(self) -> None:
        event = self.store_event(data={}, project_id=self.project.id)
        occurrence = self.build_occurrence(
            event_id=event.event_id,
            evidence_data={},
            type=ErrorGroupType.type_id,
        )

        saved_occurrence, group_info = save_issue_occurrence(occurrence.to_dict(), event)
        assert group_info is not None

        assert not DetectorGroup.objects.filter().exists()

    def test_detector_group_not_created_for_existing_group(self) -> None:
        detector = self.create_detector(
            project=self.project,
            name="Test Detector",
            type="error",
            enabled=True,
            config={},
        )

        event = self.store_event(data={}, project_id=self.project.id)
        occurrence = self.build_occurrence(
            event_id=event.event_id,
            evidence_data={"detector_id": detector.id},
            type=ErrorGroupType.type_id,
        )

        # First call - creates group and DetectorGroup
        saved_occurrence1, group_info1 = save_issue_occurrence(occurrence.to_dict(), event)
        assert group_info1 is not None

        # Verify DetectorGroup was created
        detector_group1 = DetectorGroup.objects.get(detector_id=detector.id)
        assert detector_group1.group_id == group_info1.group.id

        # Second call - should not create new group or DetectorGroup
        saved_occurrence2, group_info2 = save_issue_occurrence(occurrence.to_dict(), event)
        assert group_info2 is not None
        assert group_info1.group.id == group_info2.group.id

        # Verify only one DetectorGroup exists (no duplicate created)
        detector_groups = DetectorGroup.objects.filter(detector_id=detector.id)
        assert detector_groups.count() == 1
        item = detector_groups.first()
        assert item is not None
        assert item.group_id == group_info1.group.id


class ProcessOccurrenceDataTest(OccurrenceTestMixin, TestCase):
    def test(self) -> None:
        data = self.build_occurrence_data(fingerprint=["hi", "bye"])
        assert data["fingerprint"] == [
            md5(b"hi").hexdigest(),
            md5(b"bye").hexdigest(),
        ]


class SaveIssueFromOccurrenceTest(OccurrenceTestMixin, TestCase):
    def test_new_group(self) -> None:
        occurrence = self.build_occurrence(type=ErrorGroupType.type_id)
        event = self.store_event(
            data={
                "platform": "javascript",
                "sdk": {"name": "sentry.javascript.nextjs", "version": "1.2.3"},
            },
            project_id=self.project.id,
        )

        with patch("sentry.issues.ingest.metrics.incr") as mock_metrics_incr:
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
            mock_metrics_incr.assert_any_call(
                "group.created",
                skip_internal=True,
                tags={
                    "platform": "javascript",
                    "type": ErrorGroupType.type_id,
                    "sdk": "sentry.javascript.nextjs",
                },
            )

    def test_new_group_multiple_fingerprint(self) -> None:
        fingerprint = ["hi", "bye"]
        occurrence = self.build_occurrence(type=ErrorGroupType.type_id, fingerprint=fingerprint)
        event = self.store_event(project_id=self.project.id, data={})

        group_info = save_issue_from_occurrence(occurrence, event, None)
        assert group_info is not None
        assert group_info.is_new
        assert not group_info.is_regression

        group = group_info.group
        assert group.title == occurrence.issue_title
        grouphashes = set(GroupHash.objects.filter(group=group).values_list("hash", flat=True))
        assert set(hash_fingerprint(fingerprint)) == grouphashes

    def test_existing_group(self) -> None:
        event = self.store_event(data={}, project_id=self.project.id)
        occurrence = self.build_occurrence(fingerprint=["some-fingerprint"])
        save_issue_from_occurrence(occurrence, event, None)

        new_event = self.store_event(data={}, project_id=self.project.id)
        new_occurrence = self.build_occurrence(
            fingerprint=["some-fingerprint"], subtitle="new subtitle", issue_title="new title"
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

    def test_existing_group_multiple_fingerprints(self) -> None:
        fingerprint = ["some-fingerprint"]
        event = self.store_event(data={}, project_id=self.project.id)
        occurrence = self.build_occurrence(fingerprint=fingerprint)
        group_info = save_issue_from_occurrence(occurrence, event, None)
        assert group_info is not None
        assert group_info.is_new
        grouphashes = set(
            GroupHash.objects.filter(group=group_info.group).values_list("hash", flat=True)
        )
        assert set(hash_fingerprint(fingerprint)) == grouphashes

        fingerprint = ["some-fingerprint", "another-fingerprint"]
        new_event = self.store_event(data={}, project_id=self.project.id)
        new_occurrence = self.build_occurrence(fingerprint=fingerprint)
        with self.tasks():
            updated_group_info = save_issue_from_occurrence(new_occurrence, new_event, None)
        assert updated_group_info is not None
        assert group_info.group.id == updated_group_info.group.id
        assert not updated_group_info.is_new
        assert not updated_group_info.is_regression
        grouphashes = set(
            GroupHash.objects.filter(group=group_info.group).values_list("hash", flat=True)
        )
        assert set(hash_fingerprint(fingerprint)) == grouphashes

    def test_existing_group_multiple_fingerprints_overlap(self) -> None:
        fingerprint = ["some-fingerprint"]
        group_info = save_issue_from_occurrence(
            self.build_occurrence(fingerprint=fingerprint),
            self.store_event(data={}, project_id=self.project.id),
            None,
        )
        assert group_info is not None
        assert group_info.is_new
        grouphashes = set(
            GroupHash.objects.filter(group=group_info.group).values_list("hash", flat=True)
        )
        assert set(hash_fingerprint(fingerprint)) == grouphashes
        other_fingerprint = ["another-fingerprint"]
        other_group_info = save_issue_from_occurrence(
            self.build_occurrence(fingerprint=other_fingerprint),
            self.store_event(data={}, project_id=self.project.id),
            None,
        )
        assert other_group_info is not None
        assert other_group_info.is_new
        grouphashes = set(
            GroupHash.objects.filter(group=other_group_info.group).values_list("hash", flat=True)
        )
        assert set(hash_fingerprint(other_fingerprint)) == grouphashes

        # Should process the in order, and not join an already used fingerprint
        overlapping_fingerprint = ["another-fingerprint", "some-fingerprint"]
        new_event = self.store_event(data={}, project_id=self.project.id)
        new_occurrence = self.build_occurrence(fingerprint=overlapping_fingerprint)
        with self.tasks():
            overlapping_group_info = save_issue_from_occurrence(new_occurrence, new_event, None)
        assert overlapping_group_info is not None
        assert other_group_info.group.id == overlapping_group_info.group.id
        assert not overlapping_group_info.is_new
        assert not overlapping_group_info.is_regression
        grouphashes = set(
            GroupHash.objects.filter(group=group_info.group).values_list("hash", flat=True)
        )
        assert set(hash_fingerprint(fingerprint)) == grouphashes
        other_grouphashes = set(
            GroupHash.objects.filter(group=other_group_info.group).values_list("hash", flat=True)
        )
        assert set(hash_fingerprint(other_fingerprint)) == other_grouphashes

    def test_existing_group_different_type(self) -> None:
        event = self.store_event(data={}, project_id=self.project.id)
        occurrence = self.build_occurrence(fingerprint=["some-fingerprint"])
        group_info = save_issue_from_occurrence(occurrence, event, None)
        assert group_info is not None

        new_event = self.store_event(data={}, project_id=self.project.id)
        new_occurrence = self.build_occurrence(
            fingerprint=["some-fingerprint"], type=MonitorIncidentType.type_id
        )
        with mock.patch("sentry.issues.ingest.logger") as logger:
            assert save_issue_from_occurrence(new_occurrence, new_event, None) is None
            logger.error.assert_called_once_with(
                "save_issue_from_occurrence.type_mismatch",
                extra={
                    "issue_type": group_info.group.issue_type.slug,
                    "occurrence_type": MonitorIncidentType.slug,
                    "event_type": "platform",
                    "group_id": group_info.group.id,
                },
            )

    def test_rate_limited(self) -> None:
        MockGranted = namedtuple("MockGranted", ["granted"])
        event = self.store_event(data={}, project_id=self.project.id)
        occurrence = self.build_occurrence()
        group_info = save_issue_from_occurrence(occurrence, event, None)
        assert group_info is not None

        new_event = self.store_event(data={}, project_id=self.project.id)
        new_occurrence = self.build_occurrence(fingerprint=["another-fingerprint"])
        with (
            mock.patch("sentry.issues.ingest.metrics") as metrics,
            mock.patch(
                "sentry.issues.ingest.issue_rate_limiter.check_and_use_quotas",
                return_value=[MockGranted(granted=False)],
            ) as check_and_use_quotas,
        ):
            assert save_issue_from_occurrence(new_occurrence, new_event, None) is None
            metrics.incr.assert_called_once_with("issues.issue.dropped.rate_limiting")
            assert check_and_use_quotas.call_count == 1
            assert check_and_use_quotas.call_args[0][0] == [
                RequestedQuota(
                    f"issue-platform-issues:{self.project.id}:{occurrence.type.slug}",
                    1,
                    [occurrence.type.creation_quota],
                )
            ]

    def test_noise_reduction(self) -> None:
        # Access project before patching registry to ensure it's created with grouptypes registered
        project_id = self.project.id

        with patch("sentry.issues.grouptype.registry", new=GroupTypeRegistry()):

            @dataclass(frozen=True)
            class TestGroupType(GroupType):
                type_id = 1
                slug = "test"
                description = "Test"
                category = GroupCategory.PROFILE.value
                category_v2 = GroupCategory.MOBILE.value
                noise_config = NoiseConfig(ignore_limit=2)

            event = self.store_event(data={}, project_id=project_id)
            occurrence = self.build_occurrence(type=TestGroupType.type_id)
            with mock.patch("sentry.issues.ingest.metrics") as metrics:
                assert save_issue_from_occurrence(occurrence, event, None) is None
                metrics.incr.assert_called_once_with(
                    "issues.issue.dropped.noise_reduction", tags={"group_type": "test"}
                )

            new_event = self.store_event(data={}, project_id=project_id)
            new_occurrence = self.build_occurrence(type=TestGroupType.type_id)
            group_info = save_issue_from_occurrence(new_occurrence, new_event, None)
            assert group_info is not None

    def test_frame_mix_metric_logged(self) -> None:
        event = self.store_event(
            data={
                "platform": "javascript",
                "sdk": {"name": "sentry.javascript.nextjs", "version": "1.2.3"},
            },
            project_id=self.project.id,
        )

        # Normally this is done by `normalize_stacktraces_for_grouping`, but that can't be mocked
        # because it's imported inside its calling function to avoid circular imports
        event.data.setdefault("metadata", {})
        event.data["metadata"]["in_app_frame_mix"] = "in-app-only"

        with patch("sentry.issues.ingest.metrics.incr") as mock_metrics_incr:
            occurrence = self.build_occurrence()
            save_issue_from_occurrence(occurrence, event, None)

            mock_metrics_incr.assert_any_call(
                "grouping.in_app_frame_mix",
                sample_rate=1.0,
                tags={
                    "platform": "javascript",
                    "frame_mix": "in-app-only",
                    "sdk": "sentry.javascript.nextjs",
                },
            )

    def test_frame_mix_metric_not_logged(self) -> None:
        event = self.store_event(data={}, project_id=self.project.id)

        assert event.get_event_metadata().get("in_app_frame_mix") is None

        with patch("sentry.issues.ingest.metrics.incr") as mock_metrics_incr:
            occurrence = self.build_occurrence()
            save_issue_from_occurrence(occurrence, event, None)

            metrics_logged = [call.args[0] for call in mock_metrics_incr.mock_calls]
            assert "grouping.in_app_frame_mix" not in metrics_logged

    def test_new_group_with_default_priority(self) -> None:
        occurrence = self.build_occurrence()
        event = self.store_event(data={}, project_id=self.project.id)
        group_info = save_issue_from_occurrence(occurrence, event, None)
        assert group_info is not None
        assert group_info.group.priority == PriorityLevel.LOW

    def test_new_group_with_priority(self) -> None:
        occurrence = self.build_occurrence(priority=PriorityLevel.HIGH)
        event = self.store_event(data={}, project_id=self.project.id)
        group_info = save_issue_from_occurrence(occurrence, event, None)
        assert group_info is not None
        assert group_info.group.priority == PriorityLevel.HIGH

    def test_update_open_period(self) -> None:
        fingerprint = ["some-fingerprint"]
        occurrence = self.build_occurrence(
            initial_issue_priority=PriorityLevel.MEDIUM,
            fingerprint=fingerprint,
        )
        event = self.store_event(data={}, project_id=self.project.id)
        group_info = save_issue_from_occurrence(occurrence, event, None)
        assert group_info is not None
        group = group_info.group
        assert group.priority == PriorityLevel.MEDIUM
        open_period = get_latest_open_period(group)
        assert open_period is not None
        assert open_period.data["highest_seen_priority"] == PriorityLevel.MEDIUM

        new_event = self.store_event(data={}, project_id=self.project.id)
        new_occurrence = self.build_occurrence(
            fingerprint=["some-fingerprint"],
            initial_issue_priority=PriorityLevel.HIGH,
        )
        with self.tasks():
            updated_group_info = save_issue_from_occurrence(new_occurrence, new_event, None)
        assert updated_group_info is not None
        group.refresh_from_db()
        assert group.priority == PriorityLevel.HIGH
        open_period.refresh_from_db()
        assert open_period.data["highest_seen_priority"] == PriorityLevel.HIGH

    def test_group_with_priority_locked(self) -> None:
        occurrence = self.build_occurrence(priority=PriorityLevel.HIGH)
        event = self.store_event(data={}, project_id=self.project.id)
        group_info = save_issue_from_occurrence(occurrence, event, None)
        assert group_info is not None
        group = group_info.group
        assert group.priority == PriorityLevel.HIGH
        assert group.priority_locked_at is None

        handle_priority(
            priority=PriorityLevel.LOW.to_str(),
            group_list=[group],
            acting_user=None,
            project_lookup={self.project.id: self.project},
        )

        occurrence = self.build_occurrence(priority=PriorityLevel.HIGH)
        event = self.store_event(data={}, project_id=self.project.id)
        save_issue_from_occurrence(occurrence, event, None)
        group.refresh_from_db()
        assert group.priority == PriorityLevel.LOW
        assert group.priority_locked_at is not None

    def test_create_open_period_activity_entry(self) -> None:
        fingerprint = ["some-fingerprint"]
        occurrence = self.build_occurrence(
            initial_issue_priority=PriorityLevel.MEDIUM,
            fingerprint=fingerprint,
            type=MetricIssue.type_id,
        )
        event = self.store_event(data={}, project_id=self.project.id)
        group_info = save_issue_from_occurrence(occurrence, event, None)
        assert group_info is not None
        group = group_info.group

        open_period = get_latest_open_period(group)
        assert open_period is not None
        activity_updates = GroupOpenPeriodActivity.objects.filter(group_open_period=open_period)

        assert len(activity_updates) == 1
        assert activity_updates[0].type == OpenPeriodActivityType.OPENED
        assert activity_updates[0].value == PriorityLevel.MEDIUM

    def test_update_group_priority_open_period_activity_entry(self) -> None:
        fingerprint = ["some-fingerprint"]
        occurrence = self.build_occurrence(
            initial_issue_priority=PriorityLevel.MEDIUM,
            fingerprint=fingerprint,
            type=MetricIssue.type_id,
        )
        event = self.store_event(data={}, project_id=self.project.id)
        group_info = save_issue_from_occurrence(occurrence, event, None)
        assert group_info is not None
        group = group_info.group
        assert group.priority == PriorityLevel.MEDIUM

        new_event = self.store_event(data={}, project_id=self.project.id)
        new_occurrence = self.build_occurrence(
            fingerprint=["some-fingerprint"],
            type=MetricIssue.type_id,
            initial_issue_priority=PriorityLevel.HIGH,
        )
        with self.tasks():
            updated_group_info = save_issue_from_occurrence(new_occurrence, new_event, None)
        assert updated_group_info is not None
        group.refresh_from_db()
        assert group.priority == PriorityLevel.HIGH

        open_period = get_latest_open_period(group)
        assert open_period is not None
        activity_updates = GroupOpenPeriodActivity.objects.filter(group_open_period=open_period)

        assert len(activity_updates) == 2
        assert activity_updates[0].type == OpenPeriodActivityType.OPENED
        assert activity_updates[0].value == PriorityLevel.MEDIUM

        assert activity_updates[1].type == OpenPeriodActivityType.STATUS_CHANGE
        assert activity_updates[1].value == PriorityLevel.HIGH

    @mock.patch("sentry.issues.ingest._process_existing_aggregate")
    def test_update_group_priority_and_unresolve(self, mock_is_regression: mock.MagicMock) -> None:
        # set up the group opening entry
        fingerprint = ["some-fingerprint"]
        occurrence = self.build_occurrence(
            initial_issue_priority=PriorityLevel.MEDIUM,
            fingerprint=fingerprint,
            type=MetricIssue.type_id,
        )
        event = self.store_event(data={}, project_id=self.project.id)
        group_info = save_issue_from_occurrence(occurrence, event, None)
        assert group_info is not None
        group = group_info.group

        open_period = get_latest_open_period(group)
        assert open_period is not None
        activity_updates = GroupOpenPeriodActivity.objects.filter(group_open_period=open_period)

        assert len(activity_updates) == 1
        assert activity_updates[0].type == OpenPeriodActivityType.OPENED
        assert activity_updates[0].value == PriorityLevel.MEDIUM

        mock_is_regression.return_value = True

        # mock a regression with priority change
        new_event = self.store_event(data={}, project_id=self.project.id)
        new_occurrence = self.build_occurrence(
            fingerprint=["some-fingerprint"],
            type=MetricIssue.type_id,
            initial_issue_priority=PriorityLevel.HIGH,
        )
        with self.tasks():
            updated_group_info = save_issue_from_occurrence(new_occurrence, new_event, None)
        assert updated_group_info is not None
        group.refresh_from_db()
        assert group.priority == PriorityLevel.HIGH
        mock_is_regression.assert_called()

        activity_updates = GroupOpenPeriodActivity.objects.filter(group_open_period=open_period)

        assert len(activity_updates) == 1
        assert activity_updates[0].type == OpenPeriodActivityType.OPENED
        assert activity_updates[0].value == PriorityLevel.HIGH


class CreateIssueKwargsTest(OccurrenceTestMixin, TestCase):
    def test(self) -> None:
        culprit = "abcde" * 100
        occurrence = self.build_occurrence(culprit=culprit)
        event = self.store_event(data={}, project_id=self.project.id)
        assert _create_issue_kwargs(occurrence, event, None) == {
            "platform": event.platform,
            "message": event.search_message,
            "level": LOG_LEVELS_MAP.get(occurrence.level),
            # Should truncate the culprit to max allowable length
            "culprit": f"{culprit[:MAX_CULPRIT_LENGTH-3]}...",
            "last_seen": event.datetime,
            "first_seen": event.datetime,
            "active_at": event.datetime,
            "type": occurrence.type.type_id,
            "first_release": None,
            "data": materialize_metadata(occurrence, event),
            "priority": occurrence.type.default_priority,
        }


class MaterializeMetadataTest(OccurrenceTestMixin, TestCase):
    def test_simple(self) -> None:
        occurrence = self.build_occurrence()
        event = self.store_event(data={}, project_id=self.project.id)
        assert materialize_metadata(occurrence, event) == {
            "type": "default",
            "culprit": occurrence.culprit,
            "metadata": {
                "title": occurrence.issue_title,
                "value": occurrence.subtitle,
                "initial_priority": occurrence.priority,
            },
            "title": occurrence.issue_title,
            "location": event.location,
            "last_received": json.datetime_to_str(event.datetime),
        }

    def test_preserves_existing_metadata(self) -> None:
        occurrence = self.build_occurrence()
        event = self.store_event(data={}, project_id=self.project.id)
        event.data.setdefault("metadata", {})
        event.data["metadata"]["dogs"] = "are great"  # should not get clobbered

        materialized = materialize_metadata(occurrence, event)
        assert materialized["metadata"] == {
            "title": occurrence.issue_title,
            "value": occurrence.subtitle,
            "dogs": "are great",
            "initial_priority": occurrence.priority,
        }

    def test_populates_feedback_metadata(self) -> None:
        occurrence = self.build_occurrence(
            type=FeedbackGroup.type_id,
            evidence_data={
                "contact_email": "test@test.com",
                "message": "test",
                "name": "Name Test",
                "source": "crash report widget",
                "summary": "test",
            },
        )
        event = self.store_event(data={}, project_id=self.project.id)
        event.data.setdefault("metadata", {})
        event.data["metadata"]["dogs"] = "are great"  # should not get clobbered

        materialized = materialize_metadata(occurrence, event)
        assert materialized["metadata"] == {
            "title": occurrence.issue_title,
            "value": occurrence.subtitle,
            "dogs": "are great",
            "contact_email": "test@test.com",
            "message": "test",
            "name": "Name Test",
            "source": "crash report widget",
            "summary": "test",
            "initial_priority": occurrence.priority,
        }

    def test_populates_feedback_metadata_with_linked_error(self) -> None:
        occurrence = self.build_occurrence(
            type=FeedbackGroup.type_id,
            evidence_data={
                "contact_email": "test@test.com",
                "message": "test",
                "name": "Name Test",
                "source": "crash report widget",
                "summary": "test",
                "associated_event_id": "55798fee4d21425c8689c980cde794f2",
            },
        )
        event = self.store_event(data={}, project_id=self.project.id)
        event.data.setdefault("metadata", {})
        event.data["metadata"]["dogs"] = "are great"  # should not get clobbered

        materialized = materialize_metadata(occurrence, event)
        assert materialized["metadata"] == {
            "title": occurrence.issue_title,
            "value": occurrence.subtitle,
            "dogs": "are great",
            "contact_email": "test@test.com",
            "message": "test",
            "name": "Name Test",
            "source": "crash report widget",
            "summary": "test",
            "initial_priority": occurrence.priority,
            "associated_event_id": "55798fee4d21425c8689c980cde794f2",
        }


class SaveIssueOccurrenceToEventstreamTest(OccurrenceTestMixin, TestCase):
    def test(self) -> None:
        create_default_projects()
        event_data = load_data("generic-event-profiling")
        project_id = event_data["event"].pop("project_id")
        event_data["event"]["timestamp"] = timezone.now().isoformat()
        event = self.store_event(data=event_data["event"], project_id=project_id)
        occurrence = self.build_occurrence(event_id=event.event_id)
        group_info = save_issue_from_occurrence(occurrence, event, None)
        assert group_info is not None

        group_event = event.for_group(group_info.group)
        with (
            mock.patch("sentry.issues.ingest.eventstream") as eventstream,
            mock.patch.object(event, "for_group", return_value=group_event),
        ):
            send_issue_occurrence_to_eventstream(event, occurrence, group_info)
            eventstream.backend.insert.assert_called_once_with(
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
