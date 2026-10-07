from typing import Any
from unittest.mock import patch

from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from sentry.seer.signed_seer_api import _resolve_viewer_context
from sentry.testutils.cases import APITestCase
from sentry.types.superuser import SuperuserAccess
from sentry.viewer_context import ActorType, ViewerContext, encode_viewer_context

SECRET = "test-seer-api-shared-secret-thirty-two-bytes!"


@override_settings(SEER_API_SHARED_SECRET=SECRET, SENTRY_SELF_HOSTED=False)
class SuperuserViewerContextTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.employee = self.create_user(is_superuser=True, is_staff=True)
        self.organization = self.create_organization()
        self.path = f"/api/0/organizations/{self.organization.slug}/"

    def _viewer_header(self, expires_at: int | None, read_only: bool = True) -> str:
        return encode_viewer_context(
            ViewerContext(
                organization_id=self.organization.id,
                user_id=self.employee.id,
                actor_type=ActorType.USER,
                superuser=SuperuserAccess(expires_at=expires_at, read_only=read_only)
                if expires_at is not None
                else None,
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

    def test_read_only_mode_is_propagated(self) -> None:
        self._assert_approved_chat([], True)

    def test_read_write_mode_is_propagated(self) -> None:
        self._assert_approved_chat(["superuser.write"], False)

    def _assert_approved_chat(self, permissions, read_only) -> None:
        for permission in permissions:
            self.add_user_permission(self.employee, permission)
        with self.options({"superuser.read-write.ga-rollout": True}):
            resolved = self._approved_chat_context()
        assert resolved.organization_id == self.organization.id
        assert resolved.superuser is not None
        assert type(resolved.superuser.expires_at) is int
        assert resolved.superuser.read_only is read_only
        assert 0 < resolved.superuser.expires_at - timezone.now().timestamp() <= 300

    def test_read_only_callback_is_org_bound(self) -> None:
        self._assert_callback(True)

    def test_read_write_metadata_does_not_allow_callback_writes(self) -> None:
        self._assert_callback(False)

    def _assert_callback(self, read_only) -> None:
        resolved = self._approved_chat_context()
        assert resolved.superuser is not None
        expires_at = resolved.superuser.expires_at

        client = APIClient()
        client.credentials(HTTP_X_VIEWER_CONTEXT=self._viewer_header(expires_at, read_only))
        assert client.get(self.path).status_code == 200
        assert client.put(self.path, {}, format="json").status_code == 403
        other = self.create_organization()
        assert client.get(f"/api/0/organizations/{other.slug}/").status_code == 403

        client.credentials(HTTP_X_VIEWER_CONTEXT=self._viewer_header(None))
        assert client.get(self.path).status_code == 403

    def test_callback_rejects_elevation_over_five_minutes(self) -> None:
        client = APIClient()
        client.credentials(
            HTTP_X_VIEWER_CONTEXT=self._viewer_header(int(timezone.now().timestamp()) + 360)
        )
        assert client.get(self.path).status_code == 401
