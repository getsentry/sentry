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
from rest_framework.request import Request
from rest_framework.test import APIRequestFactory

from sentry.objectstore.endpoints.organization import ObjectstoreEndpoint, stream_response
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

        # A range of an accepted encoding is served from the compressed representation.
        range_end = 9
        get_resp = requests.get(
            f"{base_url}{object_key}",
            headers={
                **auth_headers,
                "Accept-Encoding": "zstd",
                "Range": f"bytes=0-{range_end}",
            },
            stream=True,
        )
        assert_status_code(get_resp, 206)
        assert get_resp.headers.get("Content-Encoding") == "zstd"
        assert get_resp.headers.get("Content-Length") == str(range_end + 1)
        assert get_resp.headers.get("Content-Range") == (f"bytes 0-{range_end}/{len(compressed)}")
        assert get_resp.raw.read(decode_content=False) == compressed[: range_end + 1]

        # A range of an unacceptable encoding is ignored and the full object is decoded.
        get_resp = requests.get(
            f"{base_url}{object_key}",
            headers={
                **auth_headers,
                "Accept-Encoding": "identity",
                "Range": f"bytes=0-{range_end}",
            },
        )
        assert_status_code(get_resp, 200)
        assert get_resp.headers.get("Content-Encoding") is None
        assert get_resp.headers.get("Content-Length") is None
        assert get_resp.headers.get("Content-Range") is None
        assert get_resp.content == data

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


class ObjectstoreProxyRequestForwardingTest(TransactionTestCase):
    def test_query_string_forwarded_verbatim(self) -> None:
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

    def test_range_request_serves_full_object_when_encoding_not_accepted(self) -> None:
        full_object = b"full object"
        head_response = requests.Response()
        head_response.status_code = 200
        head_response.headers = requests.structures.CaseInsensitiveDict(
            {"Content-Encoding": "zstd"}
        )
        head_response.raw = MagicMock()

        upstream_response = requests.Response()
        upstream_response.status_code = 200
        upstream_response.headers = requests.structures.CaseInsensitiveDict(
            {
                "Content-Encoding": "zstd",
                "Content-Length": "8",
            }
        )
        upstream_response.raw = MagicMock()
        upstream_response.raw.read.side_effect = [full_object, b""]

        request = APIRequestFactory().get(
            "/v1/objects/test/org=1/key",
            HTTP_ACCEPT_ENCODING="identity",
            HTTP_IF_RANGE='"previous-etag"',
            HTTP_RANGE="bytes=0-21",
        )

        with patch(
            "sentry.objectstore.endpoints.organization.requests.request",
            side_effect=[head_response, upstream_response],
        ) as mock_request:
            response = ObjectstoreEndpoint()._proxy(Request(request), "v1/objects/test/org=1/key")

        head_request, object_request = mock_request.call_args_list
        assert head_request.args == ("HEAD",)
        assert "Range" not in head_request.kwargs["headers"]
        assert "If-Range" not in head_request.kwargs["headers"]
        assert object_request.args == ("GET",)
        assert "Range" not in object_request.kwargs["headers"]
        assert "If-Range" not in object_request.kwargs["headers"]
        assert response.status_code == 200
        assert "Content-Encoding" not in response
        assert "Content-Length" not in response
        assert close_streaming_response(response) == full_object
        assert upstream_response.raw.decode_content is True

    def test_range_request_serves_encoded_range_when_encoding_accepted(self) -> None:
        encoded_range = b"encoded range"
        head_response = requests.Response()
        head_response.status_code = 200
        head_response.headers = requests.structures.CaseInsensitiveDict(
            {"Content-Encoding": "zstd"}
        )
        head_response.raw = MagicMock()

        upstream_response = requests.Response()
        upstream_response.status_code = 206
        upstream_response.headers = requests.structures.CaseInsensitiveDict(
            {
                "Content-Encoding": "zstd",
                "Content-Length": str(len(encoded_range)),
                "Content-Range": "bytes 0-12/100",
            }
        )
        upstream_response.raw = MagicMock()
        upstream_response.raw.read.side_effect = [encoded_range, b""]

        request = APIRequestFactory().get(
            "/v1/objects/test/org=1/key",
            HTTP_ACCEPT_ENCODING="zstd",
            HTTP_IF_RANGE='"current-etag"',
            HTTP_RANGE="bytes=0-12",
        )

        with patch(
            "sentry.objectstore.endpoints.organization.requests.request",
            side_effect=[head_response, upstream_response],
        ) as mock_request:
            response = ObjectstoreEndpoint()._proxy(Request(request), "v1/objects/test/org=1/key")

        head_request, object_request = mock_request.call_args_list
        assert head_request.args == ("HEAD",)
        assert "Range" not in head_request.kwargs["headers"]
        assert "If-Range" not in head_request.kwargs["headers"]
        assert object_request.args == ("GET",)
        assert object_request.kwargs["headers"]["Range"] == "bytes=0-12"
        assert object_request.kwargs["headers"]["If-Range"] == '"current-etag"'
        assert response.status_code == 206
        assert response["Content-Encoding"] == "zstd"
        assert response["Content-Length"] == str(len(encoded_range))
        assert response["Content-Range"] == "bytes 0-12/100"
        assert close_streaming_response(response) == encoded_range
        assert upstream_response.raw.decode_content is False


class ObjectstoreProxyStreamCloseTest(TransactionTestCase):
    def make_upstream_response(self) -> requests.Response:
        response = requests.Response()
        response.status_code = 200
        response.raw = MagicMock()
        response.raw.read.side_effect = [b"foo", b"bar", b""]
        return response

    def test_closes_upstream_response_when_fully_streamed(self) -> None:
        response = self.make_upstream_response()

        with patch.object(response, "close") as mock_close:
            streamed = close_streaming_response(stream_response(response))

        assert streamed == b"foobar"
        assert mock_close.called

    def test_closes_upstream_response_when_client_disconnects(self) -> None:
        response = self.make_upstream_response()

        with patch.object(response, "close") as mock_close:
            streaming_response = stream_response(response)
            assert next(iter(streaming_response)) == b"foo"
            assert not mock_close.called

            # Django closes the response, and with it the generator, when the client
            # disconnects part-way through the download.
            streaming_response.close()

            assert mock_close.called
