from __future__ import annotations

from typing import Any
from unittest.mock import patch

import orjson
from django.test import override_settings
from django.urls import reverse
from rest_framework.exceptions import ErrorDetail

from sentry.hybridcloud.rpc.service import generate_request_signature
from sentry.organizations.services.organization import RpcUserOrganizationContext
from sentry.testutils.cases import APITestCase
from sentry.viewer_context import ActorType, ViewerContext, get_viewer_context


@override_settings(RPC_SHARED_SECRET=["a-long-value-that-is-hard-to-guess"])
class RpcServiceEndpointTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user, superuser=True)

    @staticmethod
    def _get_path(service_name: str, method_name: str) -> str:
        return reverse(
            "sentry-api-0-rpc-service",
            kwargs={"service_name": service_name, "method_name": method_name},
        )

    def auth_header(self, path: str, data: dict | str) -> str:
        if isinstance(data, dict):
            data = orjson.dumps(data).decode()
        signature = generate_request_signature(path, data.encode())

        return f"rpcsignature {signature}"

    def test_invalid_endpoint(self) -> None:
        path = self._get_path("not_a_service", "not_a_method")
        response = self.client.post(path)
        assert response.status_code == 403

    def _send_post_request(self, path, data):
        response = self.client.post(
            path, data=data, HTTP_AUTHORIZATION=self.auth_header(path, data)
        )
        return response

    def test_missing_authentication(self) -> None:
        path = self._get_path("organization", "get_organization_by_id")
        data: dict[str, Any] = {"args": {}, "meta": {"organization_id": self.organization.id}}
        response = self.client.post(path, data=data)
        assert response.status_code == 403

    def test_invalid_authentication(self) -> None:
        path = self._get_path("organization", "get_organization_by_id")
        data: dict[str, Any] = {"args": {}, "meta": {"organization_id": self.organization.id}}
        response = self.client.post(path, data=data, HTTP_AUTHORIZATION="rpcsignature trash")
        assert response.status_code == 401

    def test_bad_service_name(self) -> None:
        path = self._get_path("not_a_service", "not_a_method")
        data: dict[str, Any] = {"args": {}, "meta": {}}
        response = self._send_post_request(path, data)
        assert response.status_code == 404

    def test_bad_method_name(self) -> None:
        path = self._get_path("user", "not_a_method")
        data: dict[str, Any] = {"args": {}, "meta": {}}
        response = self._send_post_request(path, data)
        assert response.status_code == 404

    def test_no_body(self) -> None:
        path = self._get_path("organization", "get_organization_by_id")
        data: dict[str, Any] = {"args": {}, "meta": {}}
        response = self._send_post_request(path, data)
        assert response.status_code == 400
        assert response.data == {
            "detail": ErrorDetail(string="Malformed request.", code="parse_error")
        }

    def test_invalid_args_syntax(self) -> None:
        path = self._get_path("organization", "get_organization_by_id")
        data: dict[str, Any] = {"args": [], "meta": {}}
        response = self._send_post_request(path, data)
        assert response.status_code == 400
        assert response.data == {
            "detail": ErrorDetail(string="Malformed request.", code="parse_error")
        }

    def test_missing_argument_key(self) -> None:
        path = self._get_path("organization", "get_organization_by_id")
        data: dict[str, Any] = {}
        response = self._send_post_request(path, data)
        assert response.status_code == 400
        assert response.data == {
            "detail": ErrorDetail(string="Malformed request.", code="parse_error")
        }

    def test_missing_argument_values(self) -> None:
        path = self._get_path("organization", "get_organization_by_id")
        data: dict[str, Any] = {"args": {}}
        response = self._send_post_request(path, data)
        assert response.status_code == 400
        assert response.data == {
            "detail": ErrorDetail(string="Malformed request.", code="parse_error")
        }

    def test_with_empty_response(self) -> None:
        path = self._get_path("organization", "get_organization_by_id")
        data = {"args": {"id": 0}}
        response = self._send_post_request(path, data)

        assert response.status_code == 200
        assert "meta" in response.data
        assert response.data["value"] is None

    def test_with_object_response(self) -> None:
        organization = self.create_organization()

        path = self._get_path("organization", "get_organization_by_id")
        data = {"args": {"id": organization.id}}
        response = self._send_post_request(path, data)
        assert response.status_code == 200
        assert response.data
        assert "meta" in response.data

        response_obj = RpcUserOrganizationContext.parse_obj(response.data["value"])
        assert response_obj.organization.id == organization.id
        assert response_obj.organization.slug == organization.slug
        assert response_obj.organization.name == organization.name

    def test_with_invalid_arguments(self) -> None:
        path = self._get_path("organization", "get_organization_by_id")
        data = {"args": {"id": "invalid type"}}
        response = self._send_post_request(path, data)
        assert response.status_code == 400
        assert response.data == {
            "detail": ErrorDetail(string="Malformed request.", code="parse_error")
        }

        data = {"args": {"invalid": "invalid type"}}
        response = self._send_post_request(path, data)
        assert response.status_code == 400
        assert response.data == {
            "detail": ErrorDetail(string="Malformed request.", code="parse_error")
        }

    def test_viewer_context_propagated_from_meta(self) -> None:
        """ViewerContext in meta is set as the contextvar during dispatch."""
        organization = self.create_organization()
        captured_contexts: list[ViewerContext | None] = []

        original_dispatch = __import__(
            "sentry.hybridcloud.rpc.service", fromlist=["dispatch_to_local_service"]
        ).dispatch_to_local_service

        def capturing_dispatch(*args, **kwargs):
            captured_contexts.append(get_viewer_context())
            return original_dispatch(*args, **kwargs)

        path = self._get_path("organization", "get_organization_by_id")
        data = {
            "args": {"id": organization.id},
            "meta": {
                "viewer_context": {
                    "organization_id": organization.id,
                    "user_id": 42,
                    "actor_type": "user",
                }
            },
        }

        with patch(
            "sentry.api.endpoints.internal.rpc.dispatch_to_local_service",
            side_effect=capturing_dispatch,
        ):
            response = self._send_post_request(path, data)

        assert response.status_code == 200
        assert len(captured_contexts) == 1
        ctx = captured_contexts[0]
        assert ctx is not None
        assert ctx.organization_id == organization.id
        assert ctx.user_id == 42
        assert ctx.actor_type == ActorType.USER

    def test_viewer_context_unknown_when_meta_empty(self) -> None:
        """Empty ViewerContext with UNKNOWN actor type when meta has no viewer_context."""
        organization = self.create_organization()
        captured_contexts: list[ViewerContext | None] = []

        original_dispatch = __import__(
            "sentry.hybridcloud.rpc.service", fromlist=["dispatch_to_local_service"]
        ).dispatch_to_local_service

        def capturing_dispatch(*args, **kwargs):
            captured_contexts.append(get_viewer_context())
            return original_dispatch(*args, **kwargs)

        path = self._get_path("organization", "get_organization_by_id")
        data = {"args": {"id": organization.id}, "meta": {}}

        with patch(
            "sentry.api.endpoints.internal.rpc.dispatch_to_local_service",
            side_effect=capturing_dispatch,
        ):
            response = self._send_post_request(path, data)

        assert response.status_code == 200
        assert len(captured_contexts) == 1
        ctx = captured_contexts[0]
        assert ctx is not None
        assert ctx.user_id is None
        assert ctx.organization_id is None
        assert ctx.actor_type == ActorType.UNKNOWN

    def test_viewer_context_roundtrip_through_meta(self) -> None:
        """ViewerContext set on the sending side arrives on the receiving side."""
        organization = self.create_organization()
        captured_contexts: list[ViewerContext | None] = []

        original_dispatch = __import__(
            "sentry.hybridcloud.rpc.service", fromlist=["dispatch_to_local_service"]
        ).dispatch_to_local_service

        def capturing_dispatch(*args, **kwargs):
            captured_contexts.append(get_viewer_context())
            return original_dispatch(*args, **kwargs)

        # Simulate what _send_to_remote_silo builds when ViewerContext is set
        ctx = ViewerContext(organization_id=organization.id, user_id=42, actor_type=ActorType.USER)
        path = self._get_path("organization", "get_organization_by_id")
        data = {
            "args": {"id": organization.id},
            "meta": {"viewer_context": ctx.serialize()},
        }

        with patch(
            "sentry.api.endpoints.internal.rpc.dispatch_to_local_service",
            side_effect=capturing_dispatch,
        ):
            response = self._send_post_request(path, data)

        assert response.status_code == 200
        assert len(captured_contexts) == 1
        restored = captured_contexts[0]
        assert restored is not None
        assert restored.organization_id == ctx.organization_id
        assert restored.user_id == ctx.user_id
        assert restored.actor_type == ctx.actor_type
