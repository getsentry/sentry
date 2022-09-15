from unittest import mock

from sentry.event_manager import _pull_out_data
from sentry.models import Group
from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.silo import region_silo_test
from sentry.types.issues import GroupType


@region_silo_test
class GroupTagDetailsTest(APITestCase, SnubaTestCase):
    def test_simple(self):
        for i in range(3):
            self.store_event(
                data={
                    "tags": {"foo": "bar"},
                    "fingerprint": ["group1"],
                    "timestamp": iso_format(before_now(seconds=1)),
                },
                project_id=self.project.id,
            )

        group = Group.objects.first()

        self.login_as(user=self.user)

        url = f"/api/0/issues/{group.id}/tags/foo/"
        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        assert response.data["key"] == "foo"
        assert response.data["totalValues"] == 3

    def test_simple_perf(self):
        transaction_event_data = {
            "message": "hello",
            "type": "transaction",
            "culprit": "app/components/events/eventEntries in map",
            "contexts": {"trace": {"trace_id": "b" * 32, "span_id": "c" * 16, "op": ""}},
        }

        def hack_pull_out_data(jobs, projects):
            _pull_out_data(jobs, projects)
            for job in jobs:
                job["event"].groups = [perf_group]
            return jobs, projects

        perf_group = self.create_group(type=GroupType.PERFORMANCE_SLOW_SPAN.value)

        with mock.patch("sentry.event_manager._pull_out_data", hack_pull_out_data):
            self.store_event(
                data={
                    **transaction_event_data,
                    "event_id": "a" * 32,
                    "timestamp": iso_format(before_now(minutes=1)),
                    "start_timestamp": iso_format(before_now(minutes=1)),
                    "tags": {"foo": "bar", "biz": "baz"},
                    "release": "releaseme",
                },
                project_id=self.project.id,
            )
            self.store_event(
                data={
                    **transaction_event_data,
                    "event_id": "b" * 32,
                    "timestamp": iso_format(before_now(minutes=2)),
                    "start_timestamp": iso_format(before_now(minutes=2)),
                    "tags": {"foo": "quux"},
                    "release": "releaseme",
                },
                project_id=self.project.id,
            )

        self.login_as(user=self.user)

        url = f"/api/0/issues/{perf_group.id}/tags/foo/"
        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        assert response.data["key"] == "foo"
        assert response.data["totalValues"] == 2
