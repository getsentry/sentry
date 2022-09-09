from unittest import mock

from sentry.event_manager import _pull_out_data
from sentry.models import Group
from sentry.testutils import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.types.issues import GroupType
from sentry.utils.samples import load_data


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
        perf_group = self.create_group(type=GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES.value)

        def hack_pull_out_data(jobs, projects):
            _pull_out_data(jobs, projects)
            for job in jobs:
                job["event"].groups = [perf_group]
            return jobs, projects

        event_data_1 = load_data("transaction")
        event_data_1["timestamp"] = iso_format(before_now(seconds=10))
        event_data_1["start_timestamp"] = iso_format(before_now(seconds=11))
        event_data_1["event_id"] = "d" * 32
        event_data_2 = load_data("transaction")
        event_data_2["timestamp"] = iso_format(before_now(seconds=20))
        event_data_2["start_timestamp"] = iso_format(before_now(seconds=21))
        event_data_2["event_id"] = "f" * 32
        event_data_3 = load_data("transaction")
        event_data_3["timestamp"] = iso_format(before_now(seconds=30))
        event_data_3["start_timestamp"] = iso_format(before_now(seconds=31))
        event_data_3["event_id"] = "f" * 32

        with mock.patch("sentry.event_manager._pull_out_data", hack_pull_out_data):
            self.transaction_event_1 = self.store_event(
                data=event_data_1, project_id=self.project.id
            )
            self.transaction_event_2 = self.store_event(
                data=event_data_2, project_id=self.project.id
            )
            self.transaction_event_3 = self.store_event(
                data=event_data_3, project_id=self.project.id
            )

        with self.feature("organizations:performance-issues"):
            assert perf_group.get_latest_event_for_environments().event_id == "d" * 32
            assert perf_group.get_oldest_event_for_environments().event_id == "f" * 32
