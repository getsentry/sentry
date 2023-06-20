import uuid

from sentry.issues.grouptype import PerformanceNPlusOneGroupType
from sentry.models import Group
from sentry.testutils import SnubaTestCase, TestCase
from sentry.testutils.cases import PerformanceIssueTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.silo import region_silo_test
from sentry.utils.samples import load_data


@region_silo_test
class GroupTestSnuba(TestCase, SnubaTestCase, PerformanceIssueTestCase):
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

    def test_get_helpful_for_environments(self):
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
                "errors": None,
            },
            project_id=project.id,
        )
        event_partial_helpful_params = self.store_event(
            data={
                "event_id": "b" * 32,
                "timestamp": min_ago,
                "fingerprint": ["group-1"],
                "contexts": {
                    "replay": {"replay_id": replay_id},
                },
            },
            project_id=project.id,
        )
        event_none_helpful_params = self.store_event(
            data={"event_id": "c" * 32, "timestamp": min_ago, "fingerprint": ["group-1"]},
            project_id=project.id,
        )

        group = Group.objects.first()
        assert event_partial_helpful_params
        assert event_none_helpful_params
        assert (
            group.get_helpful_event_for_environments().event_id == event_all_helpful_params.event_id
        )

    def test_get_helpful_for_environments_partial(self):
        project = self.create_project()

        min_ago = iso_format(before_now(minutes=1))
        replay_id = uuid.uuid4().hex

        event_all_helpful_params = self.store_event(
            data={
                "event_id": "b" * 32,
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
                "errors": None,
            },
            project_id=project.id,
        )
        event_partial_helpful_params = self.store_event(
            data={
                "event_id": "a" * 32,
                "timestamp": min_ago,
                "fingerprint": ["group-1"],
                "contexts": {
                    "replay": {"replay_id": replay_id},
                },
            },
            project_id=project.id,
        )

        group = Group.objects.first()
        assert event_partial_helpful_params
        assert (
            group.get_helpful_event_for_environments().event_id == event_all_helpful_params.event_id
        )

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
