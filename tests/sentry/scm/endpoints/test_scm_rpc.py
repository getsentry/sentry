from __future__ import annotations

import requests
import responses
from django.test import override_settings
from django.urls import reverse
from scm.actions import create_branch
from scm.rpc.client import SourceCodeManager
from scm.rpc.helpers import sign_get, sign_post

from sentry.constants import ObjectStatus
from sentry.models.repository import Repository
from sentry.testutils.cases import APITestCase
from sentry.utils import json


def assert_coded_error(response, status_code: int, code: str):
    assert response.headers["Content-Type"] == "application/json"
    assert response.status_code == status_code, response.content
    assert response.json()["errors"][0]["code"] == code


def assert_streaming_coded_error(response, status_code: int, code: str):
    assert response.headers["Content-Type"] == "application/json"
    assert response.status_code == status_code, response.content
    assert json.loads(b"".join(response.streaming_content))["errors"][0]["code"] == code


class DjangoTestClientSessionAdapter:
    """Adapts Django's test client to the scm.rpc.client.Session protocol.

    The RPC client expects a requests-like session. Django's test client returns
    Django response objects (including StreamingHttpResponse) which lack methods
    like .json() that the upstream scm library relies on. This adapter converts
    Django responses to requests.Response objects.
    """

    def __init__(self, client):
        self._client = client

    def _convert(self, django_response):
        resp = requests.Response()
        resp.status_code = django_response.status_code
        if hasattr(django_response, "streaming_content"):
            resp._content = b"".join(django_response.streaming_content)
        else:
            resp._content = django_response.content
        for key, value in django_response.items():
            resp.headers[key] = value
        resp.encoding = "utf-8"
        return resp

    def get(self, url, headers=None):
        return self._convert(self._client.get(url, headers=headers))

    def post(self, url, data=None, headers=None):
        h = dict(headers) if headers else {}
        content_type = h.pop("Content-Type", "application/octet-stream")
        return self._convert(
            self._client.post(url, data=data, content_type=content_type, headers=h)
        )


@override_settings(SCM_RPC_SHARED_SECRET=["a-long-value-that-is-hard-to-guess"])
class TestScmRpc(APITestCase):
    def setUp(self) -> None:
        self.url = reverse("sentry-api-0-scm-rpc-service")
        self.integration = self.create_integration(
            organization=self.organization,
            provider="github",
            name="Github Test Org",
            external_id="1",
        )
        self.repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="test-org/test-repo",
            provider="integrations:github",
            external_id="12345",
            status=ObjectStatus.ACTIVE,
            integration_id=self.integration.id,
        )
        self.rpc_client = SourceCodeManager.make_from_repository_id(
            self.organization.id,
            self.repo.id,
            base_url="",
            signing_secret="a-long-value-that-is-hard-to-guess",
            session=lambda: DjangoTestClientSessionAdapter(self.client),
        )

        self.default_headers = {
            "Authorization": f"rpcsignature {sign_get('a-long-value-that-is-hard-to-guess', self.organization.id, self.repo.id)}",
            "X-Organization-Id": str(self.organization.id),
            "X-Repository-Id": str(self.repo.id),
        }

    @responses.activate
    def test_end_to_end(self):
        responses.add(
            responses.POST,
            "https://api.github.com/repos/test-org/test-repo/git/refs",
            json={"ref": "refs/heads/test", "object": {"sha": "123"}},
            status=201,
        )

        result = create_branch(self.rpc_client, "test", sha="123")
        assert result["data"]["ref"] == "test"
        assert result["data"]["sha"] == "123"
        assert len(responses.calls) == 1

    def test_get(self):
        response = self.client.get(self.url, headers=self.default_headers)
        assert response.status_code == 200, response.content

    @override_settings(SCM_RPC_SHARED_SECRET=[])
    def test_get_no_secrets_set(self):
        response = self.client.get(self.url, headers=self.default_headers)
        assert response.status_code == 401, response.content

    def test_get_invalid_headers(self):
        assert_coded_error(
            self.client.get(self.url, headers={}), 400, "rpc_malformed_request_headers"
        )

    def test_get_missing_auth(self):
        assert_coded_error(
            self.client.get(self.url, headers={**self.default_headers, "Authorization": ""}),
            401,
            "rpc_invalid_grant",
        )

    def test_get_invalid_secret(self):
        def sig(secret):
            return f"rpcsignature {sign_get(secret, self.organization.id, self.repo.id)}"

        # Succeeds with correct secret.
        headers = {
            **self.default_headers,
            "Authorization": sig("a-long-value-that-is-hard-to-guess"),
        }
        assert self.client.get(self.url, headers=headers).status_code == 200

        # Fails with incorrect secret.
        response = self.client.get(self.url, headers={**headers, "Authorization": sig("s")})
        assert_coded_error(response, 401, "rpc_invalid_grant")

    def test_post_invalid_headers(self):
        assert_streaming_coded_error(
            self.client.post(self.url, headers={}), 400, "rpc_malformed_request_headers"
        )

    def test_post_missing_auth(self):
        assert_streaming_coded_error(
            self.client.post(self.url, headers={**self.default_headers, "Authorization": ""}),
            401,
            "rpc_invalid_grant",
        )

    def test_post_invalid_secret(self):
        assert_streaming_coded_error(
            self.client.post(
                self.url,
                data=b"test",
                headers={
                    **self.default_headers,
                    "Authorization": f"rpcsignature {sign_post('s', b'test')}",
                },
            ),
            401,
            "rpc_invalid_grant",
        )
