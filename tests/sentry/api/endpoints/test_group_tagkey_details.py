from sentry.issues.grouptype import PerformanceRenderBlockingAssetSpanGroupType
from sentry.models import Group
from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.silo import region_silo_test


@region_silo_test(stable=True)
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

        event = self.store_event(
            data={
                **transaction_event_data,
                "event_id": "a" * 32,
                "timestamp": iso_format(before_now(minutes=1)),
                "start_timestamp": iso_format(before_now(minutes=1, seconds=5)),
                "tags": {"foo": "bar", "biz": "baz"},
                "release": "releaseme",
                "fingerprint": [f"{PerformanceRenderBlockingAssetSpanGroupType.type_id}-group1"],
            },
            project_id=self.project.id,
        )
        self.store_event(
            data={
                **transaction_event_data,
                "event_id": "b" * 32,
                "timestamp": iso_format(before_now(minutes=2)),
                "start_timestamp": iso_format(before_now(minutes=2, seconds=5)),
                "tags": {"foo": "quux"},
                "release": "releaseme",
                "fingerprint": [f"{PerformanceRenderBlockingAssetSpanGroupType.type_id}-group1"],
            },
            project_id=self.project.id,
        )

        self.login_as(user=self.user)

        url = f"/api/0/issues/{event.groups[0].id}/tags/foo/"
        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        assert response.data["key"] == "foo"
        assert response.data["totalValues"] == 2
