import os
from dataclasses import asdict
from unittest.mock import MagicMock, patch

import pytest
import requests
import zstandard
from django.db import connections
from django.urls import reverse
from objectstore_client import Client, Session, Usecase
from pytest_django.live_server_helper import LiveServer

from sentry.silo.base import SiloMode, SingleProcessSiloModeState
from sentry.testutils.asserts import assert_status_code
from sentry.testutils.cases import TransactionTestCase
from sentry.testutils.cell import override_cells
from sentry.testutils.helpers.response import close_streaming_response
from sentry.testutils.silo import cell_silo_test, create_test_cells
from sentry.testutils.skips import requires_objectstore
from sentry.types.cell import Cell
from sentry.utils import json


@pytest.fixture(scope="function")
def local_live_server(request: pytest.FixtureRequest, live_server: LiveServer) -> None:
    if hasattr(request, "cls"):
        request.cls.live_server = live_server
    request.node.live_server = live_server


@cell_silo_test
@requires_objectstore
@pytest.mark.usefixtures("local_live_server")
class ObjectstoreEndpointTest(TransactionTestCase):
    endpoint = "sentry-api-0-organization-objectstore"
    live_server: LiveServer

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.organization = self.create_organization(owner=self.user)
        self.api_key = self.create_api_key(
            organization=self.organization,
            scope_list=["project:releases"],
        )

    def get_endpoint_url(self) -> str:
        path = reverse(
            self.endpoint,
            kwargs={
                "organization_id_or_slug": self.organization.id,
                "path": "",
            },
        )
        return f"{self.live_server.url}{path}"

    def get_auth_headers(self) -> dict[str, str]:
        auth_header = self.create_basic_auth_header(self.api_key.key)
        return {"Authorization": auth_header.decode()}

    def get_session(self) -> Session:
        client = Client(
            self.get_endpoint_url(), connection_kwargs={"headers": self.get_auth_headers()}
        )
        session = client.session(Usecase("test"), org=self.organization.id)
        return session

    def test_health(self) -> None:
        url = self.get_endpoint_url() + "health"
        res = requests.get(url, headers=self.get_auth_headers())
        res.raise_for_status()

    def test_full_cycle(self) -> None:
        session = self.get_session()

        object_key = session.put(b"test data")
        assert object_key is not None

        retrieved = session.get(object_key)
        assert retrieved is not None
        assert retrieved.payload.read() == b"test data"

        new_key = session.put(b"new data", key=object_key)
        assert new_key == object_key

        retrieved = session.get(object_key)
        assert retrieved is not None
        assert retrieved.payload.read() == b"new data"

        session.delete(object_key)

        assert session.get(object_key) is None

    def test_uncompressed(self) -> None:
        session = self.get_session()

        object_key = session.put(b"test data", compression="none")
        assert object_key is not None

        retrieved = session.get(object_key)
        assert retrieved is not None
        assert retrieved.payload.read() == b"test data"

    def test_accept_encoding_passthrough(self) -> None:
        data = os.urandom(10 * 1024)
        ctx = zstandard.ZstdCompressor()
        compressed = ctx.compress(data)

        auth_headers = self.get_auth_headers()
        base_url = f"{self.get_endpoint_url()}v1/objects/test/org={self.organization.id}/"

        # Upload with explicit zstd Content-Encoding so objectstore stores it compressed
        post_resp = requests.post(
            base_url,
            data=compressed,
            headers={
                **auth_headers,
                "Content-Encoding": "zstd",
                "Content-Type": "application/octet-stream",
            },
            stream=True,
        )
        post_resp.raise_for_status()
        object_key = post_resp.json()["key"]
        assert object_key is not None

        # Accept-Encoding: identity means no encoding accepted; proxy must decompress
        get_resp = requests.get(
            f"{base_url}{object_key}",
            headers={**auth_headers, "Accept-Encoding": "identity"},
        )
        get_resp.raise_for_status()
        assert get_resp.headers.get("Content-Encoding") is None
        assert get_resp.headers.get("Content-Length") is None  # compressed size would be wrong
        assert get_resp.content == data

        # With Accept-Encoding: zstd, proxy passes through compressed bytes
        get_resp = requests.get(
            f"{base_url}{object_key}",
            headers={**auth_headers, "Accept-Encoding": "zstd"},
            stream=True,
        )
        get_resp.raise_for_status()
        assert get_resp.headers.get("Content-Encoding") == "zstd"
        raw_body = get_resp.raw.read(decode_content=False)
        dctx = zstandard.ZstdDecompressor()
        with dctx.stream_reader(raw_body) as reader:
            assert reader.read() == data

    def test_large_payload(self) -> None:
        session = self.get_session()
        data = b"A" * 1_000_000

        object_key = session.put(data)
        assert object_key is not None

        retrieved = session.get(object_key)
        assert retrieved is not None
        assert retrieved.payload.read() == data


test_region = create_test_cells("us")[0]


@cell_silo_test(cells=(test_region,))
@requires_objectstore
@pytest.mark.usefixtures("local_live_server")
class ObjectstoreEndpointWithControlSiloTest(TransactionTestCase):
    endpoint = "sentry-api-0-organization-objectstore"
    live_server: LiveServer

    def setUp(self) -> None:
        super().setUp()

        self.login_as(user=self.user)
        self.organization = self.create_organization(owner=self.user)
        self.api_key = self.create_api_key(
            organization=self.organization,
            scope_list=["project:releases"],
        )

    def tearDown(self) -> None:
        for conn in connections.all():
            conn.close()
        super().tearDown()

    def get_endpoint_url(self) -> str:
        path = reverse(
            self.endpoint,
            kwargs={
                "organization_id_or_slug": self.organization.id,
                "path": "",
            },
        )
        return path

    def test_health(self) -> None:
        config = asdict(test_region)
        config["address"] = self.live_server.url
        with override_cells([Cell(**config)]):
            with SingleProcessSiloModeState.enter(SiloMode.CONTROL):
                response = self.client.get(
                    self.get_endpoint_url() + "health",
                    follow=True,
                )
                assert response.status_code == 200
                close_streaming_response(response)

    def test_full_cycle(self) -> None:
        config = asdict(test_region)
        config["address"] = self.live_server.url
        auth_header = self.create_basic_auth_header(self.api_key.key).decode()

        with override_cells([Cell(**config)]):
            with SingleProcessSiloModeState.enter(SiloMode.CONTROL):
                base_url = f"{self.get_endpoint_url()}v1/objects/test/org={self.organization.id}/"

                response = self.client.post(
                    base_url,
                    data=b"test data",
                    HTTP_AUTHORIZATION=auth_header,
                    content_type="application/octet-stream",
                    follow=True,
                )
                assert_status_code(response, 201)
                object_key = json.loads(close_streaming_response(response))["key"]
                assert object_key is not None

                response = self.client.get(
                    f"{base_url}{object_key}",
                    HTTP_AUTHORIZATION=auth_header,
                    follow=True,
                )
                assert_status_code(response, 200)
                assert close_streaming_response(response) == b"test data"

                response = self.client.put(
                    f"{base_url}{object_key}",
                    data=b"new data",
                    content_type="application/octet-stream",
                    HTTP_AUTHORIZATION=auth_header,
                    follow=True,
                )
                assert_status_code(response, 200)
                new_key = json.loads(close_streaming_response(response))["key"]
                assert new_key == object_key

                response = self.client.get(
                    f"{base_url}{object_key}",
                    HTTP_AUTHORIZATION=auth_header,
                    follow=True,
                )
                assert_status_code(response, 200)
                assert close_streaming_response(response) == b"new data"

                response = self.client.delete(
                    f"{base_url}{object_key}",
                    HTTP_AUTHORIZATION=auth_header,
                    follow=True,
                )
                assert_status_code(response, 204)
                close_streaming_response(response)

                response = self.client.get(
                    f"{base_url}{object_key}",
                    HTTP_AUTHORIZATION=auth_header,
                    follow=True,
                )
                assert_status_code(response, 404)
                close_streaming_response(response)

    def test_roundtrip_compressed(self) -> None:
        config = asdict(test_region)
        config["address"] = self.live_server.url
        auth_header = self.create_basic_auth_header(self.api_key.key).decode()

        data = os.urandom(10 * 1024)
        ctx = zstandard.ZstdCompressor()
        compressed = ctx.compress(data)

        with override_cells([Cell(**config)]):
            with SingleProcessSiloModeState.enter(SiloMode.CONTROL):
                base_url = f"{self.get_endpoint_url()}v1/objects/test/org={self.organization.id}/"

                response = self.client.post(
                    base_url,
                    data=compressed,
                    HTTP_AUTHORIZATION=auth_header,
                    HTTP_CONTENT_ENCODING="zstd",
                    content_type="application/octet-stream",
                    follow=True,
                )
                assert_status_code(response, 201)
                object_key = json.loads(close_streaming_response(response))["key"]
                assert object_key is not None

                response = self.client.get(
                    f"{base_url}{object_key}",
                    HTTP_AUTHORIZATION=auth_header,
                    follow=True,
                )
                assert_status_code(response, 200)
                assert close_streaming_response(response) == data


class ObjectstoreProxyQueryForwardingTest(TransactionTestCase):
    def test_query_string_forwarded_verbatim(self) -> None:
        from rest_framework.request import Request
        from rest_framework.test import APIRequestFactory

        from sentry.objectstore.endpoints.organization import ObjectstoreEndpoint

        # The ``:`` and ``+`` would be percent-encoded by ``dict(request.GET)``.
        query = (
            "os_kid=sentry&os_timestamp=2026-07-13T13:19:24+00:00&os_duration=300&os_sig=ab_c-D9z"
        )
        request = APIRequestFactory().get(f"/v1/objects/test/org=1/key?{query}")

        fake_response = MagicMock()
        fake_response.status_code = 200
        fake_response.headers = requests.structures.CaseInsensitiveDict()

        with patch(
            "sentry.objectstore.endpoints.organization.requests.request",
            return_value=fake_response,
        ) as mock_request:
            ObjectstoreEndpoint()._proxy(Request(request), "v1/objects/test/org=1/key")

        assert mock_request.call_args.kwargs["params"] == query
