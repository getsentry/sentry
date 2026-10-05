from typing import Any
from unittest.mock import patch

from django.test import override_settings
from rest_framework.test import APIClient

from sentry.seer.signed_seer_api import _resolve_viewer_context
from sentry.testutils.cases import APITestCase
from sentry.viewer_context import ActorType, ViewerContext, encode_viewer_context

SECRET = "test-seer-api-shared-secret-thirty-two-bytes!"


@override_settings(SEER_API_SHARED_SECRET=SECRET, SENTRY_SELF_HOSTED=False)
class SuperuserViewerContextTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.employee = self.create_user(is_superuser=True, is_staff=True)
        self.organization = self.create_organization()
        self.path = f"/api/0/organizations/{self.organization.slug}/"

    def _viewer_header(self, expires_at: int | None) -> str:
        return encode_viewer_context(
            ViewerContext(
                organization_id=self.organization.id,
                user_id=self.employee.id,
                actor_type=ActorType.USER,
                superuser_access_expires_at=expires_at,
            ),
            key=SECRET,
        )

    def _approved_chat_context(self) -> ViewerContext:
        self.login_as(self.employee, superuser=True)
        resolved_contexts: list[ViewerContext] = []
        with (
            self.feature("organizations:seer-explorer"),
            patch(
                "sentry.seer.agent.client.has_seer_access_with_detail", return_value=(True, None)
            ),
            patch("sentry.receivers.outbox.cell.make_agent_chat_request") as outbound,
        ):
            outbound.return_value.status = 200
            outbound.return_value.json.return_value = {"run_id": 123}

            def capture_context(*_args: Any, **kwargs: Any) -> Any:
                resolved = _resolve_viewer_context(kwargs["viewer_context"])
                assert resolved is not None
                resolved_contexts.append(resolved)
                return outbound.return_value

            outbound.side_effect = capture_context
            response = self.client.post(
                f"{self.path}seer/explorer-chat/", {"query": "List projects"}, format="json"
            )

        assert response.status_code == 200, response.content
        return resolved_contexts[0]

    def test_approved_chat_uses_ambient_org_bound_claim(self) -> None:
        resolved = self._approved_chat_context()
        assert resolved.organization_id == self.organization.id
        assert type(resolved.superuser_access_expires_at) is int

    def test_callback_is_read_only_and_org_bound(self) -> None:
        resolved = self._approved_chat_context()
        assert resolved.superuser_access_expires_at is not None
        expires_at = resolved.superuser_access_expires_at

        client = APIClient()
        client.credentials(HTTP_X_VIEWER_CONTEXT=self._viewer_header(expires_at))
        assert client.get(self.path).status_code == 200
        assert client.put(self.path, {}, format="json").status_code == 403
        other = self.create_organization()
        assert client.get(f"/api/0/organizations/{other.slug}/").status_code == 403

        client.credentials(HTTP_X_VIEWER_CONTEXT=self._viewer_header(None))
        assert client.get(self.path).status_code == 403
