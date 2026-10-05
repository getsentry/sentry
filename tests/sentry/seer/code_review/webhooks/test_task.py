from unittest.mock import patch

from django.test import override_settings
from urllib3.response import HTTPResponse

from sentry.seer.code_review.webhooks.task import process_github_webhook_event
from sentry.testutils.cases import TestCase
from sentry.viewer_context import ActorType, ViewerContext, decode_viewer_context


class ProcessGithubWebhookEventTest(TestCase):
    @override_settings(SEER_API_SHARED_SECRET="viewer-context-test-secret")
    @patch("sentry.seer.code_review.utils.seer_code_review_connection_pool.urlopen")
    def test_sends_integration_viewer_context_without_an_ambient_context(
        self, mock_urlopen
    ) -> None:
        mock_urlopen.return_value = HTTPResponse(b"", status=200)

        process_github_webhook_event(
            seer_path="/v1/code-review/test",
            event_payload={"action": "opened"},
            tags={"sentry_organization_id": str(self.organization.id)},
        )

        viewer_context = decode_viewer_context(
            mock_urlopen.call_args.kwargs["headers"]["X-Viewer-Context"],
            key="viewer-context-test-secret",
        )
        assert viewer_context == ViewerContext(
            organization_id=self.organization.id,
            actor_type=ActorType.INTEGRATION,
        )
