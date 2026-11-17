from typing import Any
from unittest.mock import patch

import orjson
import pytest
from django.test import override_settings
from urllib3.exceptions import HTTPError
from urllib3.response import HTTPResponse

from sentry.deletions.tasks.seer import (
    delete_seer_supergroup_embeddings,
    notify_seer_repository_deleted,
)
from sentry.seer.code_review.utils import SeerEndpoint
from sentry.testutils.cases import TestCase
from sentry.viewer_context import (
    Actor,
    ActorType,
    ViewerContext,
    decode_viewer_context,
    viewer_context_scope,
)


class NotifySeerRepositoryDeletedTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization_id = 12345
        self.repository_id = 67890
        self.provider = "integrations:github"
        self.repository_name = "acme/widget"

    @override_settings(SEER_API_SHARED_SECRET="viewer-context-test-secret")
    @patch("sentry.seer.code_review.utils.seer_code_review_connection_pool.urlopen")
    def test_notifies_seer_via_signed_endpoint(self, mock_urlopen: Any) -> None:
        mock_urlopen.return_value = HTTPResponse(b"", status=200)

        notify_seer_repository_deleted(
            self.organization_id,
            self.repository_id,
            self.provider,
            self.repository_name,
        )

        mock_urlopen.assert_called_once()
        request = mock_urlopen.call_args
        assert request.args[1].endswith(SeerEndpoint.REPOSITORY_OFFBOARD.value)
        assert orjson.loads(request.kwargs["body"]) == {
            "organization_id": self.organization_id,
            "repository_id": self.repository_id,
            "provider": self.provider,
            "repository_name": self.repository_name,
        }
        viewer_context = decode_viewer_context(
            request.kwargs["headers"]["X-Viewer-Context"],
            key="viewer-context-test-secret",
        )
        assert viewer_context == ViewerContext(
            actor=Actor(type=ActorType.SYSTEM), organization_id=self.organization_id
        )

    @patch("sentry.seer.code_review.utils.make_seer_request")
    def test_propagates_seer_errors(self, mock_make_seer_request: Any) -> None:
        mock_make_seer_request.side_effect = RuntimeError("seer unavailable")

        with pytest.raises(RuntimeError, match="seer unavailable"):
            notify_seer_repository_deleted(
                self.organization_id,
                self.repository_id,
                self.provider,
                self.repository_name,
            )

        mock_make_seer_request.assert_called_once()


@pytest.mark.django_db
class TestDeleteSeerSupergroupEmbeddings:
    @override_settings(SEER_API_SHARED_SECRET="viewer-context-test-secret")
    @pytest.mark.parametrize(
        ("origin_context", "expected_actor"),
        [
            (None, Actor(type=ActorType.SYSTEM)),
            (
                ViewerContext(actor=Actor(type=ActorType.USER, actor_id=1)),
                Actor(type=ActorType.USER, actor_id=1),
            ),
        ],
    )
    @patch("sentry.seer.signed_seer_api.seer_autofix_default_connection_pool.urlopen")
    def test_sends_signed_deletion(
        self, mock_urlopen: Any, origin_context: ViewerContext | None, expected_actor: Actor
    ) -> None:
        mock_urlopen.return_value = HTTPResponse(b'{"ok": true}', status=200)

        with viewer_context_scope(origin_context):
            delete_seer_supergroup_embeddings(12345, 67890, [1, 2])

        mock_urlopen.assert_called_once()
        request = mock_urlopen.call_args
        assert request.args == ("POST", "/v0/issues/supergroups/delete-by-group-ids")
        assert orjson.loads(request.kwargs["body"]) == {"project_id": 67890, "group_ids": [1, 2]}
        assert decode_viewer_context(
            request.kwargs["headers"]["X-Viewer-Context"], key="viewer-context-test-secret"
        ) == ViewerContext(actor=expected_actor, organization_id=12345, project_id=67890)

    @override_settings(SEER_API_SHARED_SECRET="viewer-context-test-secret")
    @pytest.mark.parametrize("status", [429, 500])
    @patch("sentry.seer.signed_seer_api.seer_autofix_default_connection_pool.urlopen")
    def test_seer_errors_raise_for_retry(self, mock_urlopen: Any, status: int) -> None:
        mock_urlopen.return_value = HTTPResponse(b"", status=status)

        with pytest.raises(HTTPError, match=str(status)):
            delete_seer_supergroup_embeddings(12345, 67890, [1, 2])
