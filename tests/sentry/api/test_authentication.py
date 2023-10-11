import uuid
from datetime import datetime

import pytest
from django.http import HttpRequest
from django.test import RequestFactory, override_settings
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.request import Request
from sentry_relay.auth import generate_key_pair

from sentry.api.authentication import (
    ClientIdSecretAuthentication,
    DSNAuthentication,
    OrgAuthTokenAuthentication,
    RelayAuthentication,
    RpcSignatureAuthentication,
    UserAuthTokenAuthentication,
)
from sentry.models.apitoken import ApiToken
from sentry.models.orgauthtoken import OrgAuthToken
from sentry.models.projectkey import ProjectKeyStatus
from sentry.models.relay import Relay
from sentry.services.hybrid_cloud.rpc import (
    RpcAuthenticationSetupException,
    generate_request_signature,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.silo import control_silo_test
from sentry.utils.security.orgauthtoken_token import hash_token


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


class TestOrgAuthTokenAuthentication(TestCase):
    def setUp(self):
        super().setUp()

        self.auth = OrgAuthTokenAuthentication()
        self.org = self.create_organization(owner=self.user)
        self.token = "sntrys_abc123_xyz"
        self.org_auth_token = OrgAuthToken.objects.create(
            name="Test Token 1",
            token_hashed=hash_token(self.token),
            organization_id=self.org.id,
            token_last_characters="xyz",
            scope_list=[],
            date_last_used=None,
        )

    def test_authenticate(self):
        request = HttpRequest()
        request.META["HTTP_AUTHORIZATION"] = f"Bearer {self.token}"

        result = self.auth.authenticate(request)
        assert result is not None

        user, auth = result
        assert user.is_anonymous
        assert auth == self.org_auth_token

    def test_no_match(self):
        request = HttpRequest()
        request.META["HTTP_AUTHORIZATION"] = "Bearer sntrys_abc"

        with pytest.raises(AuthenticationFailed):
            self.auth.authenticate(request)

    def test_inactive_key(self):
        self.org_auth_token.update(date_deactivated=datetime.now())
        request = HttpRequest()
        request.META["HTTP_AUTHORIZATION"] = f"Bearer {self.token}"

        with pytest.raises(AuthenticationFailed):
            self.auth.authenticate(request)


class TestTokenAuthentication(TestCase):
    def setUp(self):
        super().setUp()

        self.auth = UserAuthTokenAuthentication()
        self.org = self.create_organization(owner=self.user)
        self.token = "abc123"
        self.api_token = ApiToken.objects.create(
            token=self.token,
            user=self.user,
        )

    def test_authenticate(self):
        request = HttpRequest()
        request.META["HTTP_AUTHORIZATION"] = f"Bearer {self.token}"

        result = self.auth.authenticate(request)
        assert result is not None

        user, auth = result
        assert user.is_anonymous is False
        assert user == self.user
        assert auth == self.api_token

    def test_no_match(self):
        request = HttpRequest()
        request.META["HTTP_AUTHORIZATION"] = "Bearer abc"

        with pytest.raises(AuthenticationFailed):
            self.auth.authenticate(request)


@django_db_all
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


@django_db_all
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


@control_silo_test(stable=True)
class TestRpcSignatureAuthentication(TestCase):
    def setUp(self):
        super().setUp()

        self.auth = RpcSignatureAuthentication()
        self.org = self.create_organization(owner=self.user)

    @override_settings(RPC_SHARED_SECRET=["a-long-secret-key"])
    def test_authenticate_success(self):
        data = b'{"meta":{},"args":{"id":1}'
        request = RequestFactory().post("/", data=data, content_type="application/json")
        request = Request(request=request)

        signature = generate_request_signature(request.path_info, request.body)
        request.META["HTTP_AUTHORIZATION"] = f"rpcsignature {signature}"

        user, token = self.auth.authenticate(request)
        assert user.is_anonymous
        assert token == signature

    def test_authenticate_old_key_validates(self):
        request = RequestFactory().post("/", data="", content_type="application/json")
        with override_settings(RPC_SHARED_SECRET=["an-old-key"]):
            signature = generate_request_signature(request.path_info, request.body)
            request.META["HTTP_AUTHORIZATION"] = f"rpcsignature {signature}"

        request = Request(request=request)

        # Update settings so that we have a new key
        with override_settings(RPC_SHARED_SECRET=["a-long-secret-key", "an-old-key"]):
            user, token = self.auth.authenticate(request)

        assert user.is_anonymous
        assert token == signature

    def test_authenticate_without_signature(self):
        request = RequestFactory().post("/", data="", content_type="application/json")
        request.META["HTTP_AUTHORIZATION"] = "Bearer abcdef"

        request = Request(request=request)

        assert self.auth.authenticate(request) is None

    @override_settings(RPC_SHARED_SECRET=["a-long-secret-key"])
    def test_authenticate_invalid_signature(self):
        request = RequestFactory().post("/", data="", content_type="application/json")
        request.META["HTTP_AUTHORIZATION"] = "rpcsignature abcdef"

        request = Request(request=request)

        with pytest.raises(AuthenticationFailed):
            self.auth.authenticate(request)

    def test_authenticate_no_shared_secret(self):
        request = RequestFactory().post("/", data="", content_type="application/json")
        request.META["HTTP_AUTHORIZATION"] = "rpcsignature abcdef"

        request = Request(request=request)

        with override_settings(RPC_SHARED_SECRET=None):
            with pytest.raises(RpcAuthenticationSetupException):
                self.auth.authenticate(request)
