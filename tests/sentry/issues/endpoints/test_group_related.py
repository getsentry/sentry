from unittest import mock

import orjson
from django.test import override_settings
from urllib3.response import HTTPResponse

from sentry.api.serializers import serialize
from sentry.issues.endpoints.group_related import ALL_TYPES_UNAVAILABLE_DETAIL
from sentry.issues.related.similar_stacktrace import (
    NO_STACKTRACE_DETAIL,
    SIMILARITY_DISABLED_DETAIL,
)
from sentry.models.group import Group
from sentry.models.grouphash import GroupHash
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.options import override_options

ERROR_EVENT_DATA = {
    "exception": {
        "values": [
            {
                "stacktrace": {
                    "frames": [
                        {
                            "function": "divide_by_zero",
                            "module": "__main__",
                            "filename": "python_onboarding.py",
                            "abs_path": "/Users/jodi/python_onboarding/python_onboarding.py",
                            "lineno": 20,
                            "context_line": " divide = 1/0",
                            "in_app": True,
                        },
                    ]
                },
                "type": "ZeroDivisionError",
                "value": "division by zero",
            }
        ]
    },
    "platform": "python",
}

# Seer is the only thing mocked: its HTTP call.
SEER_URLOPEN = "sentry.seer.similarity.similar_issues.seer_grouping_connection_pool.urlopen"


def seer_response(*matches: tuple[str, float]) -> HTTPResponse:
    responses = [
        {"parent_hash": parent_hash, "should_group": True, "stacktrace_distance": distance}
        for parent_hash, distance in matches
    ]
    return HTTPResponse(orjson.dumps({"responses": responses}), status=200)


class GroupRelatedEndpointTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        # Seer requests carry a ViewerContext signed with this secret; without it they fail.
        self.enterContext(override_settings(SEER_API_SHARED_SECRET="viewer-context-test-secret"))
        self.login_as(self.user)
        self.project.update_option("sentry:similarity_backfill_completed", 1)
        self.event = self.store_event(data=ERROR_EVENT_DATA, project_id=self.project.id)
        assert self.event.group is not None
        self.group = self.event.group
        self.path = f"/api/0/organizations/{self.organization.slug}/issues/{self.group.id}/related/"

    @mock.patch(SEER_URLOPEN)
    def test_similar_issues(self, mock_seer_request: mock.MagicMock) -> None:
        similar_event = self.store_event(data={"message": "Dogs"}, project_id=self.project.id)
        other_event = self.store_event(data={"message": "Cats"}, project_id=self.project.id)
        assert similar_event.group is not None and other_event.group is not None
        # An issue can have several hashes (after a merge, say), and Seer can match more than one.
        # There's no fixture for adding a hash to an existing issue.
        second_hash = GroupHash.objects.create(
            project=self.project, group=similar_event.group, hash="a" * 32
        )
        mock_seer_request.return_value = seer_response(
            (self.event.get_primary_hash(), 0.0),  # the issue itself
            (similar_event.get_primary_hash(), 0.01),
            (other_event.get_primary_hash(), 0.05),
            (second_hash.hash, 0.10),  # a weaker match for an issue already found
        )

        response = self.client.get(self.path, {"type": "similar_stacktrace", "limit": "3"})

        assert response.status_code == 200
        # Reloaded: event processing updates the issue's row after store_event returns it.
        assert response.data == {
            "data": [
                {
                    "issue": serialize(Group.objects.get(id=similar_event.group.id), self.user),
                    "relations": [{"type": "similar_stacktrace", "score": 0.99}],
                },
                {
                    "issue": serialize(Group.objects.get(id=other_event.group.id), self.user),
                    "relations": [{"type": "similar_stacktrace", "score": 0.95}],
                },
            ],
            "meta": {
                "types": [
                    {"type": "similar_stacktrace", "status": "ok", "eventId": self.event.event_id}
                ]
            },
        }
        seer_request = orjson.loads(mock_seer_request.call_args.kwargs["body"])
        assert seer_request["event_id"] == self.event.event_id
        assert seer_request["k"] == 3

    @mock.patch(SEER_URLOPEN)
    def test_uses_latest_event(self, mock_seer_request: mock.MagicMock) -> None:
        older_event = self.store_event(
            data={
                **ERROR_EVENT_DATA,
                "fingerprint": ["shared-group"],
                "timestamp": before_now(minutes=5).isoformat(),
            },
            project_id=self.project.id,
        )
        latest_event = self.store_event(
            data={
                "message": "No stack trace here",
                "fingerprint": ["shared-group"],
                "timestamp": before_now(minutes=1).isoformat(),
            },
            project_id=self.project.id,
        )
        assert older_event.group_id == latest_event.group_id
        path = (
            f"/api/0/organizations/{self.organization.slug}/issues/{latest_event.group_id}/related/"
        )

        response = self.client.get(path)

        assert response.status_code == 200
        assert response.data == {
            "data": [],
            "meta": {
                "types": [
                    {
                        "type": "similar_stacktrace",
                        "status": "not_applicable",
                        "detail": NO_STACKTRACE_DETAIL,
                        "eventId": latest_event.event_id,
                    }
                ]
            },
        }
        mock_seer_request.assert_not_called()

    @mock.patch(SEER_URLOPEN)
    def test_issue_without_events(self, mock_seer_request: mock.MagicMock) -> None:
        # Old issues whose events are past retention
        group = self.create_group(project=self.project)

        response = self.client.get(
            f"/api/0/organizations/{self.organization.slug}/issues/{group.id}/related/"
        )

        assert response.status_code == 200
        assert response.data["meta"] == {
            "types": [
                {
                    "type": "similar_stacktrace",
                    "status": "not_applicable",
                    "detail": NO_STACKTRACE_DETAIL,
                }
            ]
        }
        mock_seer_request.assert_not_called()

    @mock.patch(SEER_URLOPEN)
    def test_project_without_seer_similarity(self, mock_seer_request: mock.MagicMock) -> None:
        # Self-hosted, for example
        self.project.delete_option("sentry:similarity_backfill_completed")

        response = self.client.get(self.path)

        assert response.status_code == 200
        assert response.data["meta"] == {
            "types": [
                {
                    "type": "similar_stacktrace",
                    "status": "not_applicable",
                    "detail": SIMILARITY_DISABLED_DETAIL,
                }
            ]
        }
        mock_seer_request.assert_not_called()

    @mock.patch(SEER_URLOPEN)
    def test_seer_error(self, mock_seer_request: mock.MagicMock) -> None:
        mock_seer_request.return_value = HTTPResponse(b"", status=500)

        response = self.client.get(self.path)

        assert response.status_code == 503
        assert response.data == {"detail": ALL_TYPES_UNAVAILABLE_DETAIL}

    @override_options({"seer.similarity-killswitch.enabled": True})
    @mock.patch(SEER_URLOPEN)
    def test_killswitch(self, mock_seer_request: mock.MagicMock) -> None:
        response = self.client.get(self.path)

        assert response.status_code == 503
        assert response.data == {"detail": ALL_TYPES_UNAVAILABLE_DETAIL}
        mock_seer_request.assert_not_called()

    @mock.patch(SEER_URLOPEN)
    def test_invalid_params(self, mock_seer_request: mock.MagicMock) -> None:
        response = self.client.get(self.path, {"type": "nope"})
        assert response.status_code == 400
        assert "type" in response.data["detail"]

        response = self.client.get(self.path, {"limit": "101"})
        assert response.status_code == 400
        assert "limit" in response.data["detail"]

        mock_seer_request.assert_not_called()
