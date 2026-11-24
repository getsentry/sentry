from typing import Any, cast
from unittest import mock

from rest_framework.request import Request

from sentry.api.serializers import serialize
from sentry.issues.related.follow_ups import record_shown, update_action
from sentry.issues.related.types import (
    RelatedIssueRelation,
    RelatedIssuesResponse,
    RelationType,
)
from sentry.models.group import Group, GroupStatus
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import assume_test_silo_mode
from sentry.users.models.user import User

METRICS = "sentry.issues.related.follow_ups.metrics"


def follow_up_calls(metrics: mock.MagicMock) -> list[dict[str, str]]:
    return [
        call.kwargs["tags"]
        for call in metrics.incr.call_args_list
        if call.args[0] == "issues.related.follow_up"
    ]


class RelatedIssueFollowUpsTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.source = self.create_group(project=self.project)
        self.duplicate = self.create_group(project=self.project)
        self.neighbor = self.create_group(project=self.project)
        self.unrelated = self.create_group(project=self.project)

    def request(self, user: User | None = None) -> Request:
        return cast(Request, self.make_request(user=user or self.user))

    def related_response(self) -> RelatedIssuesResponse:
        """The duplicate and the neighbor, as the related issues endpoint returns them."""
        relations: list[tuple[Group, list[RelatedIssueRelation]]] = [
            (
                self.duplicate,
                [
                    {"type": RelationType.SIMILAR_STACKTRACE, "score": 0.9},
                    {"type": RelationType.SAME_TRACE},
                ],
            ),
            (self.neighbor, [{"type": RelationType.SAME_TRACE}]),
        ]
        return cast(
            RelatedIssuesResponse,
            {
                "data": [
                    {"issue": serialize(group, self.user), "relations": group_relations}
                    for group, group_relations in relations
                ],
                "investigations": [],
                "meta": {"types": []},
            },
        )

    def show(self, user: User | None = None) -> None:
        record_shown(self.request(user), self.source, self.related_response())

    def update(self, group: Group, data: dict[str, Any]) -> None:
        response = self.client.put(
            f"/api/0/organizations/{self.organization.slug}/issues/{group.id}/",
            data=data,
            format="json",
        )
        assert response.status_code == 200, response.content

    @mock.patch(METRICS)
    def test_counts_shown_issues_by_relation_types(self, metrics: mock.MagicMock) -> None:
        self.show()

        assert sorted(
            (call.kwargs["tags"]["relation_types"], call.kwargs["amount"])
            for call in metrics.incr.call_args_list
            if call.args[0] == "issues.related.shown"
        ) == [("same_trace", 1), ("same_trace+similar_stacktrace", 1)]

    @mock.patch(METRICS)
    def test_update_on_a_shown_issue(self, metrics: mock.MagicMock) -> None:
        self.show()

        self.update(self.duplicate, {"status": "resolved"})

        assert follow_up_calls(metrics) == [
            {
                "relation_types": "same_trace+similar_stacktrace",
                "action": "resolve",
                "client": "session",
            }
        ]
        assert Group.objects.get(id=self.duplicate.id).status == GroupStatus.RESOLVED

    @mock.patch(METRICS)
    def test_each_action_counts_once_per_showing(self, metrics: mock.MagicMock) -> None:
        self.show()

        self.update(self.neighbor, {"status": "ignored"})
        self.update(self.neighbor, {"status": "unresolved"})
        self.update(self.neighbor, {"status": "ignored"})
        assert [tags["action"] for tags in follow_up_calls(metrics)] == ["ignore", "unresolve"]

        # Showing the issue again starts a new count
        self.show()
        self.update(self.neighbor, {"status": "ignored"})
        assert [tags["action"] for tags in follow_up_calls(metrics)] == [
            "ignore",
            "unresolve",
            "ignore",
        ]

    @mock.patch(METRICS)
    def test_bulk_update_counts_only_shown_issues(self, metrics: mock.MagicMock) -> None:
        self.show()

        response = self.client.put(
            f"/api/0/organizations/{self.organization.slug}/issues/"
            f"?id={self.neighbor.id}&id={self.unrelated.id}",
            data={"status": "resolved"},
            format="json",
        )

        assert response.status_code == 200, response.content
        assert follow_up_calls(metrics) == [
            {"relation_types": "same_trace", "action": "resolve", "client": "session"}
        ]

    @mock.patch(METRICS)
    def test_comment_on_a_shown_issue(self, metrics: mock.MagicMock) -> None:
        self.show()

        response = self.client.post(
            f"/api/0/organizations/{self.organization.slug}/issues/{self.duplicate.id}/notes/",
            data={"text": "Same crash as the source issue"},
            format="json",
        )

        assert response.status_code == 201, response.content
        assert follow_up_calls(metrics) == [
            {
                "relation_types": "same_trace+similar_stacktrace",
                "action": "comment",
                "client": "session",
            }
        ]

    @mock.patch(METRICS)
    def test_token_caller(self, metrics: mock.MagicMock) -> None:
        self.show()
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.client.logout()
            token = self.create_user_auth_token(user=self.user, scope_list=["event:write"])

        response = self.client.put(
            f"/api/0/organizations/{self.organization.slug}/issues/{self.duplicate.id}/",
            data={"status": "resolved"},
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {token.token}",
        )

        assert response.status_code == 200, response.content
        assert [tags["client"] for tags in follow_up_calls(metrics)] == ["token"]

    @mock.patch(METRICS)
    def test_related_endpoint_then_view(self, metrics: mock.MagicMock) -> None:
        with mock.patch(
            "sentry.issues.endpoints.group_related.combine", return_value=self.related_response()
        ):
            response = self.client.get(
                f"/api/0/organizations/{self.organization.slug}/issues/{self.source.id}/related/",
                {"type": "same_title"},
            )
        assert response.status_code == 200, response.content

        response = self.client.get(
            f"/api/0/organizations/{self.organization.slug}/issues/{self.neighbor.id}/"
        )

        assert response.status_code == 200, response.content
        assert follow_up_calls(metrics) == [
            {"relation_types": "same_trace", "action": "view", "client": "session"}
        ]

    @mock.patch(METRICS)
    def test_issue_shown_to_another_user(self, metrics: mock.MagicMock) -> None:
        self.show(user=self.create_user())

        self.update(self.duplicate, {"status": "resolved"})

        assert follow_up_calls(metrics) == []

    @mock.patch(METRICS)
    def test_option_off(self, metrics: mock.MagicMock) -> None:
        with override_options({"issues.related.track-follow-ups": False}):
            self.show()
        self.update(self.duplicate, {"status": "resolved"})

        assert metrics.incr.call_args_list == []

    @mock.patch(METRICS)
    def test_redis_failure_does_not_fail_the_request(self, metrics: mock.MagicMock) -> None:
        self.show()

        with mock.patch(
            "sentry.issues.related.follow_ups._client", side_effect=ConnectionError("down")
        ):
            self.update(self.duplicate, {"status": "resolved"})

        assert follow_up_calls(metrics) == []


def test_update_action() -> None:
    assert update_action({"status": "resolved"}) == "resolve"
    assert update_action({"status": "resolvedInNextRelease"}) == "resolve"
    assert update_action({"status": "ignored"}) == "ignore"
    assert update_action({"status": "unresolved"}) == "unresolve"
    assert update_action({"merge": 1}) == "merge"
    assert update_action({"discard": True}) == "discard"
    assert update_action({"assignedTo": "user:1"}) == "assign"
    assert update_action({"hasSeen": True}) == "update"
