from typing import Any
from unittest.mock import patch

from django.test import override_settings
from rest_framework.test import APIClient

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

    def _approved_chat_context(self) -> dict[str, Any]:
        self.login_as(self.employee, superuser=True)
        with (
            self.feature("organizations:seer-explorer"),
            patch(
                "sentry.seer.agent.client.has_seer_access_with_detail", return_value=(True, None)
            ),
            patch("sentry.receivers.outbox.cell.make_agent_chat_request") as outbound,
        ):
            outbound.return_value.status = 200
            outbound.return_value.json.return_value = {"run_id": 123}
            response = self.client.post(
                f"{self.path}seer/explorer-chat/", {"query": "List projects"}, format="json"
            )

        assert response.status_code == 200, response.content
        return outbound.call_args.kwargs["viewer_context"]

    def test_approved_chat_sends_org_bound_claim(self) -> None:
        context = self._approved_chat_context()
        assert context["organization_id"] == self.organization.id
        assert type(context["superuser_access_expires_at"]) is int

    def test_callback_is_read_only_and_org_bound(self) -> None:
        expires_at = self._approved_chat_context()["superuser_access_expires_at"]

        client = APIClient()
        client.credentials(HTTP_X_VIEWER_CONTEXT=self._viewer_header(expires_at))
        assert client.get(self.path).status_code == 200
        assert client.put(self.path, {}, format="json").status_code == 403
        other = self.create_organization()
        assert client.get(f"/api/0/organizations/{other.slug}/").status_code == 403

        client.credentials(HTTP_X_VIEWER_CONTEXT=self._viewer_header(None))
        assert client.get(self.path).status_code == 403
