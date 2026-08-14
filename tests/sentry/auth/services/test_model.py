from unittest.mock import Mock, patch

from sentry.auth.scope_declaration import bind_endpoint_scope_declaration
from sentry.auth.services.auth import AuthenticatedToken
from sentry.auth.services.auth.serial import serialize_api_key, serialize_api_token
from sentry.models.apikey import ApiKey
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


class DeclaredScopePermission:
    scope_map = {"GET": ("org:read",)}


@patch("sentry.auth.scope_declaration.capture_message")
@patch("sentry.auth.scope_declaration.logger.warning")
def test_authenticated_token_reports_undeclared_scope(warning: Mock, capture_message: Mock) -> None:
    token = AuthenticatedToken(kind="api_token", scopes=["org:read"])

    with bind_endpoint_scope_declaration(
        endpoint="test.Endpoint", method="GET", permission_classes=(DeclaredScopePermission,)
    ):
        assert token.has_scope("org:read")
        assert not token.has_scope("project:write")

    assert warning.call_count == 1
    assert warning.call_args.kwargs["extra"]["scope"] == "project:write"
    assert capture_message.call_count == 1


@control_silo_test
class TestRpcApiToken(TestCase):
    def setUp(self) -> None:
        self.user = self.create_user()
        self.org = self.create_organization()

    def test_serializes_correct_fields(self) -> None:
        internal_app = self.create_internal_integration(organization=self.org)
        api_token = self.create_internal_integration_token(
            user=self.user, internal_integration=internal_app
        )
        serialized_token = serialize_api_token(api_token)
        assert f"{serialized_token} is so skibidi".lower().find("token") == -1
        assert f"{serialized_token} is so skibidi".lower().find("hashed_token") == -1


@control_silo_test
class TestRpcApiKey(TestCase):
    def setUp(self) -> None:
        self.user = self.create_user()
        self.org = self.create_organization()

    def test_serializes_correct_fields(self) -> None:
        key = ApiKey.objects.create(
            organization_id=self.create_organization().id, scope_list=["org:read"]
        )
        serialized_key = serialize_api_key(key)
        assert f"{serialized_key} is so skibidi".lower().find("key") == -1
