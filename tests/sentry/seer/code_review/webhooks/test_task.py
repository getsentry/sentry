from typing import Any, cast
from unittest.mock import patch

from django.test import override_settings
from urllib3.response import HTTPResponse

from sentry.integrations.utils.webhook_viewer_context import webhook_viewer_context
from sentry.seer.code_review.webhooks.task import process_github_webhook_event
from sentry.taskworker.adapters import ViewerContextHook
from sentry.testutils.cases import TestCase
from sentry.viewer_context import (
    ActorType,
    ViewerContext,
    decode_viewer_context,
    get_viewer_context,
)


class ProcessGithubWebhookEventTest(TestCase):
    @override_settings(
        SEER_API_SHARED_SECRET="viewer-context-test-secret",
        SENTRY_VIEWER_CONTEXT_ENABLED=True,
    )
    @patch("sentry.seer.code_review.utils.seer_code_review_connection_pool.urlopen")
    def test_propagates_webhook_viewer_context_to_seer(self, mock_urlopen) -> None:
        mock_urlopen.return_value = HTTPResponse(b"", status=200)
        kwargs = {
            "seer_path": "/v1/code-review/test",
            "event_payload": {"action": "opened"},
            "tags": {"sentry_organization_id": str(self.organization.id)},
        }

        with webhook_viewer_context(self.organization.id):
            task = cast(Any, process_github_webhook_event).__wrapped__
            activation = task.create_activation(args=[], kwargs=kwargs)

        assert get_viewer_context() is None
        with ViewerContextHook().on_execute(dict(activation.headers)):
            process_github_webhook_event(**kwargs)

        viewer_context = decode_viewer_context(
            mock_urlopen.call_args.kwargs["headers"]["X-Viewer-Context"],
            key="viewer-context-test-secret",
        )
        assert viewer_context == ViewerContext(
            organization_id=self.organization.id,
            actor_type=ActorType.INTEGRATION,
        )
