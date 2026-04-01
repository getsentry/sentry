import os
from dataclasses import asdict
from unittest.mock import patch

import httpx
import pytest
import requests
import zstandard
from django.db import connections
from django.http import HttpResponse, StreamingHttpResponse
from django.urls import reverse
from objectstore_client import Client, RequestError, Session, Usecase
from pytest_django.live_server_helper import LiveServer

from sentry.hybridcloud.apigateway_async import proxy as proxy_mod
from sentry.silo.base import SiloMode, SingleProcessSiloModeState
from sentry.testutils.asserts import assert_status_code
from sentry.testutils.cases import TransactionTestCase
from sentry.testutils.cell import override_cells
from sentry.testutils.helpers.features import with_feature
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
class OrganizationObjectstoreEndpointTest(TransactionTestCase):
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

    @with_feature("organizations:objectstore-endpoint")
    def test_health(self) -> None:
        url = self.get_endpoint_url() + "health"
        res = requests.get(url, headers=self.get_auth_headers())
        res.raise_for_status()

    @with_feature("organizations:objectstore-endpoint")
    def test_full_cycle(self) -> None:
        session = self.get_session()

        object_key = session.put(b"test data")
        assert object_key is not None

        retrieved = session.get(object_key)
        assert retrieved.payload.read() == b"test data"

        new_key = session.put(b"new data", key=object_key)
        assert new_key == object_key

        retrieved = session.get(object_key)
        assert retrieved.payload.read() == b"new data"

        session.delete(object_key)

        with pytest.raises(RequestError):
            session.get(object_key)

    @with_feature("organizations:objectstore-endpoint")
    def test_uncompressed(self) -> None:
        session = self.get_session()

        object_key = session.put(b"test data", compression="none")
        assert object_key is not None

        retrieved = session.get(object_key)
        assert retrieved.payload.read() == b"test data"

    @with_feature("organizations:objectstore-endpoint")
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

    @with_feature("organizations:objectstore-endpoint")
    def test_large_payload(self) -> None:
        session = self.get_session()
        data = b"A" * 1_000_000

        object_key = session.put(data)
        assert object_key is not None

        retrieved = session.get(object_key)
        assert retrieved.payload.read() == data


test_region = create_test_cells("us")[0]


@cell_silo_test(cells=(test_region,))
@requires_objectstore
@with_feature("organizations:objectstore-endpoint")
@pytest.mark.usefixtures("local_live_server")
class OrganizationObjectstoreEndpointWithControlSiloTest(TransactionTestCase):
    endpoint = "sentry-api-0-organization-objectstore"
    live_server: LiveServer

    def setUp(self) -> None:
        super().setUp()

        #: some shenanigans to work around async/sync hell:
        #  - use a "one shot" httpx client, so that we're not bound previous
        #    no-more existing event loops
        #  - patch the middleware to consume original streamed response body
        #    before the loop gets closed/destroyed
        class HTTPXOneShotClient:
            def __init__(self):
                self.inner = None

            def __getattr__(self, name):
                return getattr(self.inner, name)

            def build_request(self, *args, **kwargs):
                self.inner = httpx.AsyncClient()
                return self.inner.build_request(*args, **kwargs)

        from sentry.hybridcloud.apigateway_async.middleware import ApiGatewayMiddleware

        _original_mw = ApiGatewayMiddleware.process_view

        async def _eager_process_view(mw_self, request, view_func, view_args, view_kwargs):
            resp = await _original_mw(mw_self, request, view_func, view_args, view_kwargs)
            if isinstance(resp, StreamingHttpResponse) and resp.is_async:
                body = b""
                async for chunk in resp:
                    body += chunk
                await proxy_mod.proxy_client.aclose()
                sync_resp = HttpResponse(
                    content=body,
                    status=resp.status_code,
                    content_type=resp.get("Content-Type"),
                )
                for header, value in resp.items():
                    if header.lower() != "content-type":
                        sync_resp[header] = value
                return sync_resp
            return resp

        self._apigateway_patch = patch.object(proxy_mod, "proxy_client", HTTPXOneShotClient())
        self._middleware_patch = patch.object(
            ApiGatewayMiddleware, "process_view", _eager_process_view
        )
        self._apigateway_patch.start()
        self._middleware_patch.start()

        self.login_as(user=self.user)
        self.organization = self.create_organization(owner=self.user)
        self.api_key = self.create_api_key(
            organization=self.organization,
            scope_list=["project:releases"],
        )

    def tearDown(self) -> None:
        self._middleware_patch.stop()
        self._apigateway_patch.stop()
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
                object_key = json.loads(response.content)["key"]
                assert object_key is not None

                response = self.client.get(
                    f"{base_url}{object_key}",
                    HTTP_AUTHORIZATION=auth_header,
                    follow=True,
                )
                assert_status_code(response, 200)
                assert response.content == b"test data"

                response = self.client.put(
                    f"{base_url}{object_key}",
                    data=b"new data",
                    content_type="application/octet-stream",
                    HTTP_AUTHORIZATION=auth_header,
                    follow=True,
                )
                assert_status_code(response, 200)
                new_key = json.loads(response.content)["key"]
                assert new_key == object_key

                response = self.client.get(
                    f"{base_url}{object_key}",
                    HTTP_AUTHORIZATION=auth_header,
                    follow=True,
                )
                assert_status_code(response, 200)
                assert response.content == b"new data"

                response = self.client.delete(
                    f"{base_url}{object_key}",
                    HTTP_AUTHORIZATION=auth_header,
                    follow=True,
                )
                assert_status_code(response, 204)

                response = self.client.get(
                    f"{base_url}{object_key}",
                    HTTP_AUTHORIZATION=auth_header,
                    follow=True,
                )
                assert_status_code(response, 404)

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
                object_key = json.loads(response.content)["key"]
                assert object_key is not None

                response = self.client.get(
                    f"{base_url}{object_key}",
                    HTTP_AUTHORIZATION=auth_header,
                    follow=True,
                )
                assert_status_code(response, 200)
                assert response.content == data
