from typing import Any
from unittest.mock import patch

import orjson
import pytest
from django.test import override_settings
from urllib3.response import HTTPResponse

from sentry.deletions.tasks.seer import notify_seer_repository_deleted
from sentry.seer.code_review.utils import SeerEndpoint
from sentry.testutils.cases import TestCase
from sentry.viewer_context import ActorType, ViewerContext, decode_viewer_context


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
            organization_id=self.organization_id,
            actor_type=ActorType.SYSTEM,
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
