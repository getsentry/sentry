import uuid

import pytest
from django.http import HttpRequest
from django.test import RequestFactory, override_settings
from rest_framework.exceptions import AuthenticationFailed
from sentry_relay import generate_key_pair

from sentry.api.authentication import (
    ClientIdSecretAuthentication,
    DSNAuthentication,
    RelayAuthentication,
)
from sentry.models import ProjectKeyStatus, Relay
from sentry.testutils import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test(stable=True)
class TestClientIdSecretAuthentication(TestCase):
    def setUp(self):
        super().setUp()

        self.auth = ClientIdSecretAuthentication()
        self.org = self.create_organization(owner=self.user)

        self.sentry_app = self.create_sentry_app(name="foo", organization=self.org)

        self.api_app = self.sentry_app.application

    def test_authenticate(self):
        request = HttpRequest()
        request.json_body = {
            "client_id": self.api_app.client_id,
            "client_secret": self.api_app.client_secret,
        }

        user, _ = self.auth.authenticate(request)

        assert user == self.sentry_app.proxy_user

    def test_without_json_body(self):
        request = HttpRequest()
        request.json_body = None

        with pytest.raises(AuthenticationFailed):
            self.auth.authenticate(request)

    def test_missing_client_id(self):
        request = HttpRequest()
        request.json_body = {"client_secret": self.api_app.client_secret}

        with pytest.raises(AuthenticationFailed):
            self.auth.authenticate(request)

    def test_missing_client_secret(self):
        request = HttpRequest()
        request.json_body = {"client_id": self.api_app.client_id}

        with pytest.raises(AuthenticationFailed):
            self.auth.authenticate(request)

    def test_incorrect_client_id(self):
        request = HttpRequest()
        request.json_body = {"client_id": "notit", "client_secret": self.api_app.client_secret}

        with pytest.raises(AuthenticationFailed):
            self.auth.authenticate(request)

    def test_incorrect_client_secret(self):
        request = HttpRequest()
        request.json_body = {"client_id": self.api_app.client_id, "client_secret": "notit"}

        with pytest.raises(AuthenticationFailed):
            self.auth.authenticate(request)


class TestDSNAuthentication(TestCase):
    def setUp(self):
        super().setUp()

        self.auth = DSNAuthentication()
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)
        self.project_key = self.create_project_key(project=self.project)

    def test_authenticate(self):
        request = HttpRequest()
        request.META["HTTP_AUTHORIZATION"] = f"DSN {self.project_key.dsn_public}"

        result = self.auth.authenticate(request)
        assert result is not None

        user, auth = result
        assert user.is_anonymous
        assert auth == self.project_key

    def test_inactive_key(self):
        self.project_key.update(status=ProjectKeyStatus.INACTIVE)
        request = HttpRequest()
        request.META["HTTP_AUTHORIZATION"] = f"DSN {self.project_key.dsn_public}"

        with pytest.raises(AuthenticationFailed):
            self.auth.authenticate(request)


@pytest.mark.django_db
@pytest.mark.parametrize("internal", [True, False])
def test_registered_relay(internal):
    sk, pk = generate_key_pair()
    relay_id = str(uuid.uuid4())

    data = {"some_data": "hello"}
    packed, signature = sk.pack(data)
    request = RequestFactory().post("/", data=packed, content_type="application/json")
    request.META["HTTP_X_SENTRY_RELAY_SIGNATURE"] = signature
    request.META["HTTP_X_SENTRY_RELAY_ID"] = relay_id
    request.META["REMOTE_ADDR"] = "200.200.200.200"  # something that is NOT local network

    Relay.objects.create(relay_id=relay_id, public_key=str(pk))
    if internal:
        white_listed_pk = [str(pk)]  # mark the relay as internal
    else:
        white_listed_pk = []

    authenticator = RelayAuthentication()
    with override_settings(SENTRY_RELAY_WHITELIST_PK=white_listed_pk):
        authenticator.authenticate(request)

    # now the request should contain a relay
    relay = request.relay
    assert relay.is_internal == internal
    assert relay.public_key == str(pk)
    # data should be deserialized in request.relay_request_data
    assert request.relay_request_data == data


@pytest.mark.django_db
@pytest.mark.parametrize("internal", [True, False])
def test_statically_configured_relay(settings, internal):
    sk, pk = generate_key_pair()
    relay_id = str(uuid.uuid4())

    data = {"some_data": "hello"}
    packed, signature = sk.pack(data)
    request = RequestFactory().post("/", data=packed, content_type="application/json")
    request.META["HTTP_X_SENTRY_RELAY_SIGNATURE"] = signature
    request.META["HTTP_X_SENTRY_RELAY_ID"] = relay_id
    request.META["REMOTE_ADDR"] = "200.200.200.200"  # something that is NOT local network

    relay_options = {relay_id: {"internal": internal, "public_key": str(pk)}}

    settings.SENTRY_OPTIONS["relay.static_auth"] = relay_options
    authenticator = RelayAuthentication()
    authenticator.authenticate(request)

    # now the request should contain a relay
    relay = request.relay
    assert relay.is_internal == internal
    assert relay.public_key == str(pk)
    # data should be deserialized in request.relay_request_data
    assert request.relay_request_data == data
