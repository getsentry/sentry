import uuid
from datetime import UTC, datetime

import pytest
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
    ServiceRpcSignatureAuthentication,
    UserAuthTokenAuthentication,
    compare_service_signature,
)
from sentry.auth.services.auth import AuthenticatedToken
from sentry.auth.system import SystemToken, is_system_auth
from sentry.hybridcloud.models import ApiKeyReplica, ApiTokenReplica, OrgAuthTokenReplica
from sentry.hybridcloud.rpc.service import (
    RpcAuthenticationSetupException,
    generate_request_signature,
)
from sentry.models.apikey import is_api_key_auth
from sentry.models.apitoken import ApiToken, is_api_token_auth
from sentry.models.orgauthtoken import OrgAuthToken, is_org_auth_token_auth
from sentry.models.projectkey import ProjectKeyStatus
from sentry.models.relay import Relay
from sentry.silo.base import SiloMode
from sentry.testutils.auth import generate_service_request_signature
from sentry.testutils.cases import TestCase
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.requests import drf_request_from_request
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test, no_silo_test
from sentry.types.token import AuthTokenType
from sentry.utils.security.orgauthtoken_token import hash_token


def _drf_request(data: dict[str, str] | None = None) -> Request:
    req = RequestFactory().post("/example", data, format="json")
    return drf_request_from_request(req)


@control_silo_test
class TestClientIdSecretAuthentication(TestCase):
    def setUp(self) -> None:
        super().setUp()

        self.auth = ClientIdSecretAuthentication()
        self.org = self.create_organization(owner=self.user)

        self.sentry_app = self.create_sentry_app(name="foo", organization=self.org)

        self.api_app = self.sentry_app.application

    def test_authenticate(self) -> None:
        request = _drf_request(
            {
                "client_id": self.api_app.client_id,
                "client_secret": self.api_app.client_secret,
            }
        )

        user, _ = self.auth.authenticate(request)

        assert user.id == self.sentry_app.proxy_user.id

    def test_without_json_body(self) -> None:
        request = _drf_request()

        with pytest.raises(AuthenticationFailed):
            self.auth.authenticate(request)

    def test_missing_client_id(self) -> None:
        request = _drf_request({"client_secret": self.api_app.client_secret})

        with pytest.raises(AuthenticationFailed):
            self.auth.authenticate(request)

    def test_missing_client_secret(self) -> None:
        request = _drf_request({"client_id": self.api_app.client_id})

        with pytest.raises(AuthenticationFailed):
            self.auth.authenticate(request)

    def test_incorrect_client_id(self) -> None:
        request = _drf_request(
            {
                "client_id": "notit",
                "client_secret": self.api_app.client_secret,
            }
        )

        with pytest.raises(AuthenticationFailed):
            self.auth.authenticate(request)

    def test_incorrect_client_secret(self) -> None:
        request = _drf_request(
            {
                "client_id": self.api_app.client_id,
                "client_secret": "notit",
            }
        )

        with pytest.raises(AuthenticationFailed):
            self.auth.authenticate(request)


class TestDSNAuthentication(TestCase):
    def setUp(self) -> None:
        super().setUp()

        self.auth = DSNAuthentication()
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)
        self.project_key = self.create_project_key(project=self.project)

    def test_authenticate(self) -> None:
        request = _drf_request()
        request.META["HTTP_AUTHORIZATION"] = f"DSN {self.project_key.dsn_public}"

        result = self.auth.authenticate(request)
        assert result is not None

        user, auth = result
        assert user.is_anonymous
        assert auth == AuthenticatedToken.from_token(self.project_key)

    def test_inactive_key(self) -> None:
        self.project_key.update(status=ProjectKeyStatus.INACTIVE)
        request = _drf_request()
        request.META["HTTP_AUTHORIZATION"] = f"DSN {self.project_key.dsn_public}"

        with pytest.raises(AuthenticationFailed):
            self.auth.authenticate(request)


@control_silo_test
class TestOrgAuthTokenAuthentication(TestCase):
    def setUp(self) -> None:
        super().setUp()

        self.auth = OrgAuthTokenAuthentication()
        self.org = self.create_organization(owner=self.user)

        self.token = "sntrys_abc123_xyz"
        self.org_auth_token = self.create_org_auth_token(
            name="Test Token 1",
            token_hashed=hash_token(self.token),
            organization_id=self.org.id,
            token_last_characters="xyz",
            scope_list=[],
            date_last_used=None,
        )

    def test_authenticate(self) -> None:
        request = _drf_request()
        request.META["HTTP_AUTHORIZATION"] = f"Bearer {self.token}"

        result = self.auth.authenticate(request)
        assert result is not None

        user, auth = result
        assert user.is_anonymous
        assert AuthenticatedToken.from_token(auth) == AuthenticatedToken.from_token(
            self.org_auth_token
        )

    def test_no_match(self) -> None:
        request = _drf_request()
        request.META["HTTP_AUTHORIZATION"] = "Bearer sntrys_abc"

        with pytest.raises(AuthenticationFailed):
            self.auth.authenticate(request)

    def test_inactive_key(self) -> None:
        self.org_auth_token.update(date_deactivated=datetime.now(UTC))
        request = _drf_request()
        request.META["HTTP_AUTHORIZATION"] = f"Bearer {self.token}"

        with pytest.raises(AuthenticationFailed):
            self.auth.authenticate(request)


@control_silo_test
class TestTokenAuthentication(TestCase):
    def setUp(self) -> None:
        super().setUp()

        self.auth = UserAuthTokenAuthentication()
        self.org = self.create_organization(owner=self.user)
        self.api_token = ApiToken.objects.create(
            token_type=AuthTokenType.USER,
            user=self.user,
        )
        self.token = self.api_token.plaintext_token

    def test_authenticate(self) -> None:
        request = _drf_request()
        request.META["HTTP_AUTHORIZATION"] = f"Bearer {self.token}"

        result = self.auth.authenticate(request)
        assert result is not None

        user, auth = result
        assert user.is_anonymous is False
        assert user.id == self.user.id
        assert AuthenticatedToken.from_token(auth) == AuthenticatedToken.from_token(self.api_token)

    def test_no_match(self) -> None:
        request = _drf_request()
        request.META["HTTP_AUTHORIZATION"] = "Bearer abc"

        with pytest.raises(AuthenticationFailed):
            self.auth.authenticate(request)

    def test_authenticate_bearer_scheme_case_insensitive(self) -> None:
        """
        Allow lowercase 'bearer' scheme for input authorization header.
        """
        request = _drf_request()
        request.META["HTTP_AUTHORIZATION"] = f"bearer {self.token}"

        result = self.auth.authenticate(request)
        assert result is not None
        user, auth = result
        assert user.is_anonymous is False
        assert user.id == self.user.id
        assert AuthenticatedToken.from_token(auth) == AuthenticatedToken.from_token(self.api_token)


@control_silo_test
class TestOrgScopedAppTokenAuthentication(TestCase):
    def setUp(self) -> None:
        super().setUp()

        self.auth = UserAuthTokenAuthentication()
        self.org = self.create_organization(owner=self.user)
        self.another_org = self.create_organization(owner=self.user)
        self.api_token = ApiToken.objects.create(
            token_type=AuthTokenType.USER,
            user=self.user,
            scoping_organization_id=self.org.id,
        )
        self.token = self.api_token.plaintext_token

    def test_authenticate_correct_org(self) -> None:
        request = _drf_request()
        request.META["HTTP_AUTHORIZATION"] = f"Bearer {self.token}"
        request.path_info = f"/api/0/organizations/{self.org.slug}/projects/"

        result = self.auth.authenticate(request)
        assert result is not None

        user, auth = result
        assert user.is_anonymous is False
        assert user.id == self.user.id
        assert AuthenticatedToken.from_token(auth) == AuthenticatedToken.from_token(self.api_token)

    def test_authenticate_incorrect_org(self) -> None:
        request = _drf_request()
        request.META["HTTP_AUTHORIZATION"] = f"Bearer {self.token}"
        request.path_info = f"/api/0/organizations/{self.another_org}/projects/"

        with pytest.raises(AuthenticationFailed):
            self.auth.authenticate(request)

    def test_authenticate_user_level_endpoints(self) -> None:
        request = _drf_request()
        request.META["HTTP_AUTHORIZATION"] = f"Bearer {self.token}"
        request.path_info = "/api/0/projects/"

        with pytest.raises(AuthenticationFailed):
            self.auth.authenticate(request)

    def test_authenticate_allowlist_endpoint(self) -> None:
        request = _drf_request()
        request.META["HTTP_AUTHORIZATION"] = f"Bearer {self.token}"
        request.path_info = "/api/0/organizations/"

        result = self.auth.authenticate(request)
        assert result is not None

        user, auth = result
        assert user.is_anonymous is False
        assert user.id == self.user.id
        assert AuthenticatedToken.from_token(auth) == AuthenticatedToken.from_token(self.api_token)

    def test_no_match(self) -> None:
        request = _drf_request()
        request.META["HTTP_AUTHORIZATION"] = "Bearer abc"
        request.path_info = f"/api/0/organizations/{self.another_org}/projects/"

        with pytest.raises(AuthenticationFailed):
            self.auth.authenticate(request)


@django_db_all
@pytest.mark.parametrize("internal", [True, False])
def test_registered_relay(internal) -> None:
    sk, pk = generate_key_pair()
    relay_id = str(uuid.uuid4())

    data = {"some_data": "hello"}
    packed, signature = sk.pack(data)
    request = drf_request_from_request(
        RequestFactory().post("/", data=packed, content_type="application/json")
    )
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
def test_statically_configured_relay(settings, internal) -> None:
    sk, pk = generate_key_pair()
    relay_id = str(uuid.uuid4())

    data = {"some_data": "hello"}
    packed, signature = sk.pack(data)
    request = drf_request_from_request(
        RequestFactory().post("/", data=packed, content_type="application/json")
    )
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


@control_silo_test
class TestRpcSignatureAuthentication(TestCase):
    def setUp(self) -> None:
        super().setUp()

        self.auth = RpcSignatureAuthentication()
        self.org = self.create_organization(owner=self.user)

    @override_settings(RPC_SHARED_SECRET=["a-long-secret-key"])
    def test_authenticate_success(self) -> None:
        data = b'{"meta":{},"args":{"id":1}'
        request = drf_request_from_request(
            RequestFactory().post("/", data=data, content_type="application/json")
        )

        signature = generate_request_signature(request.path_info, request.body)
        request.META["HTTP_AUTHORIZATION"] = f"rpcsignature {signature}"

        user, token = self.auth.authenticate(request)
        assert user.is_anonymous
        assert token == signature

    def test_authenticate_old_key_validates(self) -> None:
        request = drf_request_from_request(
            RequestFactory().post("/", data="", content_type="application/json")
        )
        with override_settings(RPC_SHARED_SECRET=["an-old-key"]):
            signature = generate_request_signature(request.path_info, request.body)
            request.META["HTTP_AUTHORIZATION"] = f"rpcsignature {signature}"

        # Update settings so that we have a new key
        with override_settings(RPC_SHARED_SECRET=["a-long-secret-key", "an-old-key"]):
            user, token = self.auth.authenticate(request)

        assert user.is_anonymous
        assert token == signature

    def test_authenticate_without_signature(self) -> None:
        request = drf_request_from_request(
            RequestFactory().post("/", data="", content_type="application/json")
        )
        request.META["HTTP_AUTHORIZATION"] = "Bearer abcdef"

        assert self.auth.authenticate(request) is None

    @override_settings(RPC_SHARED_SECRET=["a-long-secret-key"])
    def test_authenticate_invalid_signature(self) -> None:
        request = drf_request_from_request(
            RequestFactory().post("/", data="", content_type="application/json")
        )
        request.META["HTTP_AUTHORIZATION"] = "rpcsignature abcdef"

        with pytest.raises(AuthenticationFailed):
            self.auth.authenticate(request)

    def test_authenticate_no_shared_secret(self) -> None:
        request = drf_request_from_request(
            RequestFactory().post("/", data="", content_type="application/json")
        )
        request.META["HTTP_AUTHORIZATION"] = "rpcsignature abcdef"

        with override_settings(RPC_SHARED_SECRET=None):
            with pytest.raises(RpcAuthenticationSetupException):
                self.auth.authenticate(request)


class TestServiceRpcSignatureAuthentication(TestCase):
    def setUp(self) -> None:
        super().setUp()

        # Create a concrete implementation for testing
        class TestServiceAuth(ServiceRpcSignatureAuthentication):
            shared_secret_setting_name = "TEST_SERVICE_RPC_SHARED_SECRET"
            service_name = "TestService"
            sdk_tag_name = "test_service_rpc_auth"

        self.auth = TestServiceAuth()

    @override_settings(TEST_SERVICE_RPC_SHARED_SECRET=["test-secret-key"])
    def test_authenticate_success(self) -> None:
        data = b'{"test": "data"}'
        request = drf_request_from_request(
            RequestFactory().post("/test", data=data, content_type="application/json")
        )

        signature = generate_service_request_signature(
            request.path_info, request.body, ["test-secret-key"], "TestService"
        )
        request.META["HTTP_AUTHORIZATION"] = f"rpcsignature {signature}"

        user, token = self.auth.authenticate(request)
        assert user.is_anonymous
        assert token == signature

    @override_settings(TEST_SERVICE_RPC_SHARED_SECRET=["new-key", "old-key"])
    def test_authenticate_old_key_validates(self) -> None:
        data = b'{"test": "data"}'
        request = drf_request_from_request(
            RequestFactory().post("/test", data=data, content_type="application/json")
        )

        # Sign with old key
        signature = generate_service_request_signature(
            request.path_info, request.body, ["old-key"], "TestService"
        )
        request.META["HTTP_AUTHORIZATION"] = f"rpcsignature {signature}"

        user, token = self.auth.authenticate(request)
        assert user.is_anonymous
        assert token == signature

    def test_authenticate_without_signature(self) -> None:
        request = drf_request_from_request(
            RequestFactory().post(
                "/test", data=b'{"test": "data"}', content_type="application/json"
            )
        )
        request.META["HTTP_AUTHORIZATION"] = "Bearer abcdef"

        assert self.auth.authenticate(request) is None

    @override_settings(TEST_SERVICE_RPC_SHARED_SECRET=["test-secret-key"])
    def test_authenticate_invalid_signature(self) -> None:
        request = drf_request_from_request(
            RequestFactory().post(
                "/test", data=b'{"test": "data"}', content_type="application/json"
            )
        )
        request.META["HTTP_AUTHORIZATION"] = "rpcsignature invalid_signature"

        with pytest.raises(AuthenticationFailed):
            self.auth.authenticate(request)

    def test_authenticate_no_shared_secret(self) -> None:
        request = drf_request_from_request(
            RequestFactory().post(
                "/test", data=b'{"test": "data"}', content_type="application/json"
            )
        )
        request.META["HTTP_AUTHORIZATION"] = "rpcsignature test_signature"

        with override_settings(TEST_SERVICE_RPC_SHARED_SECRET=None):
            with pytest.raises(RpcAuthenticationSetupException):
                self.auth.authenticate(request)

    def test_authenticate_empty_shared_secret(self) -> None:
        request = drf_request_from_request(
            RequestFactory().post(
                "/test", data=b'{"test": "data"}', content_type="application/json"
            )
        )
        request.META["HTTP_AUTHORIZATION"] = "rpcsignature test_signature"

        # Test with empty string secret
        with override_settings(TEST_SERVICE_RPC_SHARED_SECRET=[""]):
            with pytest.raises(RpcAuthenticationSetupException):
                self.auth.authenticate(request)

        # Test with whitespace-only secret
        with override_settings(TEST_SERVICE_RPC_SHARED_SECRET=[" "]):
            with pytest.raises(RpcAuthenticationSetupException):
                self.auth.authenticate(request)


class TestCompareServiceSignature(TestCase):
    def test_valid_signature(self) -> None:
        url = "/test/endpoint"
        body = b'{"test": "data"}'
        shared_secrets = ["secret-key"]
        service_name = "TestService"

        # Generate valid signature
        signature = generate_service_request_signature(url, body, shared_secrets, service_name)

        result = compare_service_signature(url, body, signature, shared_secrets, service_name)
        assert result is True

    def test_valid_signature_with_multiple_keys(self) -> None:
        url = "/test/endpoint"
        body = b'{"test": "data"}'
        shared_secrets = ["new-key", "old-key"]
        service_name = "TestService"

        # Sign with first key
        signature = generate_service_request_signature(url, body, ["new-key"], service_name)
        result = compare_service_signature(url, body, signature, shared_secrets, service_name)
        assert result is True

        # Sign with second key
        signature = generate_service_request_signature(url, body, ["old-key"], service_name)
        result = compare_service_signature(url, body, signature, shared_secrets, service_name)
        assert result is True

    def test_invalid_signature(self) -> None:
        url = "/test/endpoint"
        body = b'{"test": "data"}'
        shared_secrets = ["secret-key"]
        service_name = "TestService"

        result = compare_service_signature(
            url, body, "rpc0:invalid_signature", shared_secrets, service_name
        )
        assert result is False

    def test_no_shared_secrets(self) -> None:
        url = "/test/endpoint"
        body = b'{"test": "data"}'
        service_name = "TestService"

        with pytest.raises(RpcAuthenticationSetupException):
            compare_service_signature(url, body, "rpc0:signature", [], service_name)

    def test_empty_shared_secrets(self) -> None:
        url = "/test/endpoint"
        body = b'{"test": "data"}'
        service_name = "TestService"

        # Test list with empty string
        with pytest.raises(RpcAuthenticationSetupException):
            compare_service_signature(url, body, "rpc0:signature", [""], service_name)

        # Test list with whitespace-only string
        with pytest.raises(RpcAuthenticationSetupException):
            compare_service_signature(url, body, "rpc0:signature", [" "], service_name)

        # Test list with empty string mixed with valid secret
        with pytest.raises(RpcAuthenticationSetupException):
            compare_service_signature(
                url, body, "rpc0:signature", ["valid-secret", ""], service_name
            )

    def test_invalid_signature_prefix(self) -> None:
        url = "/test/endpoint"
        body = b'{"test": "data"}'
        shared_secrets = ["secret-key"]
        service_name = "TestService"

        result = compare_service_signature(
            url, body, "invalid:signature", shared_secrets, service_name
        )
        assert result is False

    def test_empty_body(self) -> None:
        url = "/test/endpoint"
        body = b""
        shared_secrets = ["secret-key"]
        service_name = "TestService"

        result = compare_service_signature(
            url, body, "rpc0:signature", shared_secrets, service_name
        )
        assert result is False

    def test_malformed_signature(self) -> None:
        url = "/test/endpoint"
        body = b'{"test": "data"}'
        shared_secrets = ["secret-key"]
        service_name = "TestService"

        # Test signature without colon
        result = compare_service_signature(url, body, "rpc0signature", shared_secrets, service_name)
        assert result is False


class TestGenerateServiceRequestSignature(TestCase):
    def test_generate_signature(self) -> None:
        url = "/test/endpoint"
        body = b'{"test": "data"}'
        shared_secrets = ["secret-key"]
        service_name = "TestService"

        signature = generate_service_request_signature(url, body, shared_secrets, service_name)

        assert signature.startswith("rpc0:")
        assert len(signature) > 5  # Should have actual signature data after prefix

    def test_generate_signature_uses_first_key(self) -> None:
        url = "/test/endpoint"
        body = b'{"test": "data"}'
        shared_secrets = ["first-key", "second-key"]
        service_name = "TestService"

        signature = generate_service_request_signature(url, body, shared_secrets, service_name)

        # Verify it uses the first key by checking it validates with first key only
        result = compare_service_signature(url, body, signature, ["first-key"], service_name)
        assert result is True

        # Should not validate with second key only
        result = compare_service_signature(url, body, signature, ["second-key"], service_name)
        assert result is False

    def test_generate_signature_no_shared_secrets(self) -> None:
        url = "/test/endpoint"
        body = b'{"test": "data"}'
        service_name = "TestService"

        with pytest.raises(RpcAuthenticationSetupException):
            generate_service_request_signature(url, body, [], service_name)

    def test_consistent_signatures(self) -> None:
        url = "/test/endpoint"
        body = b'{"test": "data"}'
        shared_secrets = ["secret-key"]
        service_name = "TestService"

        signature1 = generate_service_request_signature(url, body, shared_secrets, service_name)
        signature2 = generate_service_request_signature(url, body, shared_secrets, service_name)

        assert signature1 == signature2

    def test_different_bodies_different_signatures(self) -> None:
        url = "/test/endpoint"
        body1 = b'{"test": "data1"}'
        body2 = b'{"test": "data2"}'
        shared_secrets = ["secret-key"]
        service_name = "TestService"

        signature1 = generate_service_request_signature(url, body1, shared_secrets, service_name)
        signature2 = generate_service_request_signature(url, body2, shared_secrets, service_name)

        assert signature1 != signature2


@no_silo_test
class TestAuthTokens(TestCase):
    def test_system_tokens(self) -> None:
        sys_token = SystemToken()
        auth_token = AuthenticatedToken.from_token(sys_token)

        assert auth_token is not None
        assert auth_token.entity_id is None
        assert auth_token.user_id is None
        assert is_system_auth(sys_token) and is_system_auth(auth_token)
        assert auth_token.organization_id is None
        assert auth_token.application_id is None
        assert auth_token.allowed_origins == sys_token.get_allowed_origins()
        assert auth_token.scopes == sys_token.get_scopes()
        assert auth_token.audit_log_data == sys_token.get_audit_log_data()

    def test_api_tokens(self) -> None:
        app = self.create_sentry_app(user=self.user, organization_id=self.organization.id)
        app_install = self.create_sentry_app_installation(
            organization=self.organization, user=self.user, slug=app.slug
        )
        with assume_test_silo_mode(SiloMode.CONTROL):
            at = app_install.api_token
        with assume_test_silo_mode(SiloMode.REGION):
            atr = ApiTokenReplica.objects.get(apitoken_id=at.id)

        assert at.organization_id

        for token in [at, atr]:
            auth_token = AuthenticatedToken.from_token(token)

            assert auth_token is not None
            assert auth_token.entity_id == at.id
            assert auth_token.user_id == app.proxy_user_id
            assert is_api_token_auth(token) and is_api_token_auth(auth_token)
            assert auth_token.organization_id == self.organization.id
            assert auth_token.application_id == app.application_id
            assert auth_token.allowed_origins == token.get_allowed_origins()
            assert auth_token.scopes == token.get_scopes()
            assert auth_token.audit_log_data == token.get_audit_log_data()

    def test_api_keys(self) -> None:
        ak = self.create_api_key(organization=self.organization, scope_list=["projects:read"])
        with assume_test_silo_mode(SiloMode.REGION):
            akr = ApiKeyReplica.objects.get(apikey_id=ak.id)

        for token in [ak, akr]:
            auth_token = AuthenticatedToken.from_token(token)

            assert auth_token is not None
            assert auth_token.entity_id == ak.id
            assert auth_token.user_id is None
            assert is_api_key_auth(token) and is_api_key_auth(auth_token)
            assert auth_token.organization_id == self.organization.id
            assert auth_token.application_id is None
            assert auth_token.allowed_origins == token.get_allowed_origins()
            assert auth_token.scopes == token.get_scopes()
            assert auth_token.audit_log_data == token.get_audit_log_data()

    def test_org_auth_tokens(self) -> None:
        oat = OrgAuthToken.objects.create(
            organization_id=self.organization.id,
            name="token 1",
            token_hashed="ABCDEF",
            token_last_characters="xyz1",
            scope_list=["org:ci"],
            date_last_used=None,
        )
        with assume_test_silo_mode(SiloMode.REGION):
            oatr = OrgAuthTokenReplica.objects.get(orgauthtoken_id=oat.id)

        for token in (oat, oatr):
            auth_token = AuthenticatedToken.from_token(token)

            assert auth_token is not None
            assert auth_token.entity_id == oat.id
            assert auth_token.user_id is None
            assert is_org_auth_token_auth(token) and is_org_auth_token_auth(auth_token)
            assert auth_token.organization_id == self.organization.id
            assert auth_token.application_id is None
            assert auth_token.allowed_origins == token.get_allowed_origins()
            assert auth_token.scopes == token.get_scopes()
            assert auth_token.audit_log_data == token.get_audit_log_data()
