from sentry.models.group import Group
from sentry.testutils.cases import APITestCase, PerformanceIssueTestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now


class GroupTagDetailsTest(APITestCase, SnubaTestCase, PerformanceIssueTestCase):
    def test_simple(self) -> None:
        for i in range(3):
            self.store_event(
                data={
                    "tags": {"foo": "bar"},
                    "fingerprint": ["group1"],
                    "timestamp": before_now(seconds=1).isoformat(),
                },
                project_id=self.project.id,
            )

        group = Group.objects.get()

        self.login_as(user=self.user)

        url = f"/api/0/issues/{group.id}/tags/foo/"
        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        assert response.data["key"] == "foo"
        assert response.data["totalValues"] == 3

    def test_simple_perf(self) -> None:
        event = self.create_performance_issue(
            tags=[["foo", "bar"], ["biz", "baz"], ["sentry:release", "releaseme"]],
            fingerprint="group1",
            contexts={"trace": {"trace_id": "b" * 32, "span_id": "c" * 16, "op": ""}},
        )
        self.create_performance_issue(
            tags=[["foo", "guux"], ["sentry:release", "releaseme"]],
            fingerprint="group1",
            contexts={"trace": {"trace_id": "b" * 32, "span_id": "c" * 16, "op": ""}},
        )
        assert event.group is not None

        self.login_as(user=self.user)

        url = f"/api/0/issues/{event.group.id}/tags/foo/"
        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        assert response.data["key"] == "foo"
        assert response.data["totalValues"] == 2

    def test_includes_empty_values_counts(self) -> None:
        for i in range(2):
            self.store_event(
                data={
                    "tags": {"foo": ""},
                    "fingerprint": ["group-empty-flag"],
                    "timestamp": before_now(seconds=1 + i).isoformat(),
                },
                project_id=self.project.id,
                assert_no_errors=False,
            )

        event = self.store_event(
            data={
                "tags": {"foo": "baz"},
                "fingerprint": ["group-empty-flag"],
                "timestamp": before_now(seconds=1).isoformat(),
            },
            project_id=self.project.id,
        )

        self.login_as(user=self.user)

        url = f"/api/0/issues/{event.group.id}/tags/foo/"
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["totalValues"] == 3
        top_values = {value["value"]: value["count"] for value in response.data["topValues"]}
        assert top_values.get("") == 2
        assert top_values.get("baz") == 1
