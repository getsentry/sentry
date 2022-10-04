from sentry.models import Group
from sentry.testutils import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.silo import region_silo_test
from sentry.types.issues import GroupType
from sentry.utils.samples import load_data


@region_silo_test
class GroupTestSnuba(TestCase, SnubaTestCase):
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
        group_fingerprint = f"{GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES.value}-group1"

        event_data_1 = load_data("transaction", fingerprint=[group_fingerprint])
        event_data_1["timestamp"] = iso_format(before_now(seconds=10))
        event_data_1["start_timestamp"] = iso_format(before_now(seconds=11))
        event_data_1["event_id"] = "d" * 32
        event_data_2 = load_data("transaction", fingerprint=[group_fingerprint])
        event_data_2["timestamp"] = iso_format(before_now(seconds=20))
        event_data_2["start_timestamp"] = iso_format(before_now(seconds=21))
        event_data_2["event_id"] = "f" * 32
        event_data_3 = load_data("transaction", fingerprint=[group_fingerprint])
        event_data_3["timestamp"] = iso_format(before_now(seconds=30))
        event_data_3["start_timestamp"] = iso_format(before_now(seconds=31))
        event_data_3["event_id"] = "f" * 32

        self.transaction_event_1 = self.store_event(data=event_data_1, project_id=self.project.id)
        self.transaction_event_2 = self.store_event(data=event_data_2, project_id=self.project.id)
        self.transaction_event_3 = self.store_event(data=event_data_3, project_id=self.project.id)
        perf_group = self.transaction_event_1.groups[0]

        with self.feature("organizations:performance-issues"):
            assert perf_group.get_latest_event_for_environments().event_id == "d" * 32
            assert perf_group.get_oldest_event_for_environments().event_id == "f" * 32
