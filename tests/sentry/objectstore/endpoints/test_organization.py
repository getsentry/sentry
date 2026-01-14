from dataclasses import asdict

import pytest
import requests
from django.urls import reverse
from objectstore_client import Client, RequestError, Session, Usecase
from pytest_django.live_server_helper import LiveServer

from sentry.silo.base import SiloMode, SingleProcessSiloModeState
from sentry.testutils.asserts import assert_status_code
from sentry.testutils.cases import TransactionTestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.region import override_regions
from sentry.testutils.silo import create_test_regions, region_silo_test
from sentry.testutils.skips import requires_objectstore
from sentry.types.region import Region
from sentry.utils import json


@pytest.fixture(scope="function")
def local_live_server(request: pytest.FixtureRequest, live_server: LiveServer) -> None:
    if hasattr(request, "cls"):
        request.cls.live_server = live_server
    request.node.live_server = live_server


@region_silo_test
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
            scope_list=["org:admin"],
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
    def test_health(self):
        url = self.get_endpoint_url() + "health"
        res = requests.get(url, headers=self.get_auth_headers())
        res.raise_for_status()

    @with_feature("organizations:objectstore-endpoint")
    def test_full_cycle(self):
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
    def test_uncompressed(self):
        session = self.get_session()

        object_key = session.put(b"test data", compression="none")
        assert object_key is not None

        retrieved = session.get(object_key)
        assert retrieved.payload.read() == b"test data"

    @with_feature("organizations:objectstore-endpoint")
    def test_large_payload(self):
        session = self.get_session()
        data = b"A" * 1_000_000

        object_key = session.put(data)
        assert object_key is not None

        retrieved = session.get(object_key)
        assert retrieved.payload.read() == data


test_region = create_test_regions("us")[0]


@region_silo_test(regions=(test_region,))
@requires_objectstore
@with_feature("organizations:objectstore-endpoint")
@pytest.mark.usefixtures("local_live_server")
class OrganizationObjectstoreEndpointWithControlSiloTest(TransactionTestCase):
    endpoint = "sentry-api-0-organization-objectstore"
    live_server: LiveServer

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.organization = self.create_organization(owner=self.user)
        self.api_key = self.create_api_key(
            organization=self.organization,
            scope_list=["org:admin"],
        )

    def get_endpoint_url(self) -> str:
        path = reverse(
            self.endpoint,
            kwargs={
                "organization_id_or_slug": self.organization.id,
                "path": "",
            },
        )
        return path

    def test_health(self):
        config = asdict(test_region)
        config["address"] = self.live_server.url
        with override_regions([Region(**config)]):
            with SingleProcessSiloModeState.enter(SiloMode.CONTROL):
                response = self.client.get(
                    self.get_endpoint_url() + "health",
                    follow=True,
                )
                assert response.status_code == 200

    def test_full_cycle(self):

        config = asdict(test_region)
        config["address"] = self.live_server.url
        auth_header = self.create_basic_auth_header(self.api_key.key).decode()

        with override_regions([Region(**config)]):
            with SingleProcessSiloModeState.enter(SiloMode.CONTROL):
                base_url = f"{self.get_endpoint_url()}v1/objects/test/org={self.organization.id}/"

                response = self.client.post(
                    base_url,
                    data=b"test data",
                    HTTP_AUTHORIZATION=auth_header,
                    content_type="application/octet-stream",
                    follow=True,
                    Authorization=auth_header,
                )
                assert_status_code(response, 201)
                object_key = json.loads(b"".join(response.streaming_content))["key"]
                assert object_key is not None

                response = self.client.get(
                    f"{base_url}{object_key}",
                    HTTP_AUTHORIZATION=auth_header,
                    follow=True,
                )
                assert_status_code(response, 200)
                retrieved_data = b"".join(response.streaming_content)
                assert retrieved_data == b"test data"

                response = self.client.put(
                    f"{base_url}{object_key}",
                    data=b"new data",
                    HTTP_AUTHORIZATION=auth_header,
                    content_type="application/octet-stream",
                    follow=True,
                )
                assert_status_code(response, 200)
                new_key = json.loads(b"".join(response.streaming_content))["key"]
                assert new_key == object_key

                response = self.client.get(
                    f"{base_url}{object_key}",
                    HTTP_AUTHORIZATION=auth_header,
                    follow=True,
                )
                assert_status_code(response, 200)
                retrieved_data = b"".join(response.streaming_content)
                assert retrieved_data == b"new data"

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
