import uuid
from unittest.mock import patch

from sentry.issues.grouptype import PerformanceNPlusOneGroupType, ProfileFileIOGroupType
from sentry.issues.occurrence_consumer import process_event_and_issue_occurrence
from sentry.models.group import Group
from sentry.testutils.cases import PerformanceIssueTestCase, SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.silo import region_silo_test
from sentry.utils.samples import load_data
from tests.sentry.issues.test_utils import OccurrenceTestMixin


@region_silo_test
class GroupTestSnuba(TestCase, SnubaTestCase, PerformanceIssueTestCase, OccurrenceTestMixin):
    def test_get_oldest_latest_for_environments(self):
        project = self.create_project()

        min_ago = iso_format(before_now(minutes=1))

        self.store_event(
            data={
                "event_id": "a" * 32,
                "environment": "production",
                "timestamp": min_ago,
                "fingerprint": ["group-1"],
            },
            project_id=project.id,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "environment": "production",
                "timestamp": min_ago,
                "fingerprint": ["group-1"],
            },
            project_id=project.id,
        )
        self.store_event(
            data={"event_id": "c" * 32, "timestamp": min_ago, "fingerprint": ["group-1"]},
            project_id=project.id,
        )

        group = Group.objects.first()

        assert group.get_latest_event_for_environments().event_id == "c" * 32
        assert group.get_latest_event_for_environments(["staging"]) is None
        assert group.get_latest_event_for_environments(["production"]).event_id == "b" * 32
        assert group.get_oldest_event_for_environments().event_id == "a" * 32
        assert (
            group.get_oldest_event_for_environments(["staging", "production"]).event_id == "a" * 32
        )
        assert group.get_oldest_event_for_environments(["staging"]) is None

    def test_perf_issue(self):
        group_fingerprint = f"{PerformanceNPlusOneGroupType.type_id}-group1"

        event_data_1 = load_data("transaction-n-plus-one", fingerprint=[group_fingerprint])
        event_data_1["timestamp"] = iso_format(before_now(seconds=10))
        event_data_1["start_timestamp"] = iso_format(before_now(seconds=11))
        event_data_1["event_id"] = "d" * 32
        event_data_2 = load_data("transaction-n-plus-one", fingerprint=[group_fingerprint])
        event_data_2["timestamp"] = iso_format(before_now(seconds=20))
        event_data_2["start_timestamp"] = iso_format(before_now(seconds=21))
        event_data_2["event_id"] = "f" * 32
        event_data_3 = load_data("transaction-n-plus-one", fingerprint=[group_fingerprint])
        event_data_3["timestamp"] = iso_format(before_now(seconds=30))
        event_data_3["start_timestamp"] = iso_format(before_now(seconds=31))
        event_data_3["event_id"] = "f" * 32

        transaction_event_1 = self.create_performance_issue(
            event_data=event_data_1, fingerprint=group_fingerprint
        )
        self.create_performance_issue(event_data=event_data_2, fingerprint=group_fingerprint)
        self.create_performance_issue(event_data=event_data_3, fingerprint=group_fingerprint)

        perf_group = transaction_event_1.group

        assert perf_group.get_latest_event_for_environments().event_id == "d" * 32
        assert perf_group.get_oldest_event_for_environments().event_id == "f" * 32

    def test_error_issue_get_helpful_for_environments(self):
        project = self.create_project()
        min_ago = iso_format(before_now(minutes=1))
        replay_id = uuid.uuid4().hex

        event_all_helpful_params = self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": min_ago,
                "fingerprint": ["group-1"],
                "contexts": {
                    "replay": {"replay_id": replay_id},
                    "trace": {
                        "sampled": True,
                        "span_id": "babaae0d4b7512d9",
                        "trace_id": "a7d67cf796774551a95be6543cacd459",
                    },
                },
                "errors": [],
            },
            project_id=project.id,
            assert_no_errors=False,
        )
        self.store_event(
            data={
                "event_id": "b" * 32,
                "timestamp": min_ago,
                "fingerprint": ["group-1"],
                "contexts": {
                    "replay": {"replay_id": replay_id},
                },
                "errors": [{"type": "one"}, {"type": "two"}],
            },
            project_id=project.id,
            assert_no_errors=False,
        )
        event_none_helpful_params = self.store_event(
            data={"event_id": "c" * 32, "timestamp": min_ago, "fingerprint": ["group-1"]},
            project_id=project.id,
        )

        group = Group.objects.first()
        assert (
            group.get_recommended_event_for_environments().event_id
            == event_all_helpful_params.event_id
        )
        assert (
            group.get_latest_event_for_environments().event_id == event_none_helpful_params.event_id
        )
        assert (
            group.get_oldest_event_for_environments().event_id == event_all_helpful_params.event_id
        )

    def test_perf_issue_helpful(self):
        group_fingerprint = f"{PerformanceNPlusOneGroupType.type_id}-group1"

        transaction_event_data_with_all_helpful = load_data(
            "transaction-n-plus-one", fingerprint=[group_fingerprint]
        )
        transaction_event_data_with_all_helpful["timestamp"] = iso_format(before_now(seconds=10))
        transaction_event_data_with_all_helpful["start_timestamp"] = iso_format(
            before_now(seconds=11)
        )
        transaction_event_data_with_all_helpful["event_id"] = "d" * 32
        transaction_event_data_with_all_helpful["contexts"].update(
            {"profile": {"profile_id": uuid.uuid4().hex}}
        )
        transaction_event_data_with_all_helpful["contexts"].update(
            {"replay": {"replay_id": uuid.uuid4().hex}}
        )
        transaction_event_data_with_all_helpful["contexts"]["trace"]["sampled"] = True
        transaction_event_data_with_all_helpful["errors"] = []

        transaction_event_data_with_none_helpful = load_data(
            "transaction-n-plus-one", fingerprint=[group_fingerprint]
        )
        transaction_event_data_with_none_helpful["timestamp"] = iso_format(before_now(seconds=20))
        transaction_event_data_with_none_helpful["start_timestamp"] = iso_format(
            before_now(seconds=21)
        )
        transaction_event_data_with_none_helpful["event_id"] = "f" * 32

        transaction_event_1 = self.create_performance_issue(
            event_data=transaction_event_data_with_all_helpful, fingerprint=group_fingerprint
        )
        transaction_event_2 = self.create_performance_issue(
            event_data=transaction_event_data_with_none_helpful, fingerprint=group_fingerprint
        )

        perf_group = transaction_event_1.group

        assert (
            perf_group.get_recommended_event_for_environments().event_id
            == transaction_event_1.event_id
        )
        assert (
            perf_group.get_latest_event_for_environments().event_id == transaction_event_1.event_id
        )
        assert (
            perf_group.get_oldest_event_for_environments().event_id == transaction_event_2.event_id
        )

    def test_profile_issue_helpful(self):
        event_id_1 = uuid.uuid4().hex
        occurrence = process_event_and_issue_occurrence(
            self.build_occurrence_data(event_id=event_id_1, project_id=self.project.id),
            {
                "event_id": event_id_1,
                "fingerprint": ["group-1"],
                "project_id": self.project.id,
                "timestamp": before_now(minutes=2).isoformat(),
                "contexts": {
                    "profile": {"profile_id": uuid.uuid4().hex},
                    "replay": {"replay_id": uuid.uuid4().hex},
                    "trace": {
                        "sampled": True,
                        "span_id": "babaae0d4b7512d9",
                        "trace_id": "a7d67cf796774551a95be6543cacd459",
                    },
                },
                "errors": [],
            },
        )[0]

        event_id_2 = uuid.uuid4().hex
        occurrence_2 = process_event_and_issue_occurrence(
            self.build_occurrence_data(event_id=event_id_2, project_id=self.project.id),
            {
                "event_id": event_id_2,
                "fingerprint": ["group-1"],
                "project_id": self.project.id,
                "timestamp": before_now(minutes=1).isoformat(),
            },
        )[0]

        group = Group.objects.first()
        group.update(type=ProfileFileIOGroupType.type_id)

        group_event = group.get_recommended_event_for_environments()
        assert group_event.event_id == occurrence.event_id
        self.assert_occurrences_identical(group_event.occurrence, occurrence)

        assert group.get_latest_event_for_environments().event_id == occurrence_2.event_id
        assert group.get_oldest_event_for_environments().event_id == occurrence.event_id

    @patch("sentry.quotas.backend.get_event_retention")
    def test_get_recommended_event_for_environments_retention_limit(self, mock_get_event_retention):
        """
        If last_seen is outside of the retention limit, falls back to the latest event behavior.
        """
        mock_get_event_retention.return_value = 90
        project = self.create_project()
        outside_retention_date = before_now(days=91)

        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": iso_format(outside_retention_date),
                "fingerprint": ["group-1"],
                "contexts": {},
                "errors": [],
            },
            project_id=project.id,
            assert_no_errors=False,
        )

        group = Group.objects.first()
        group.last_seen = before_now(days=91)
        assert group.get_recommended_event_for_environments().event_id == event.event_id
