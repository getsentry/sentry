from urllib.parse import parse_qs, urlsplit

from sentry.api.helpers.oauth_consent import persist_authorization
from sentry.models.apiapplication import ApiApplicationStatus
from sentry.models.apigrant import ApiGrant
from sentry.models.apitoken import ApiToken
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class OAuthAuthorizeContextTest(APITestCase):
    endpoint = "sentry-api-0-oauth-authorize-context"
    method = "get"

    def setUp(self) -> None:
        super().setUp()
        self.application = self.create_api_application(
            name="Example application", redirect_uris="https://example.com/callback"
        )
        self.query = {
            "client_id": self.application.client_id,
            "response_type": "code",
            "scope": "project:read",
            "state": "return & preserve state",
        }

    def test_public_context(self) -> None:
        response = self.get_success_response(**self.query)

        assert response.data == {
            "stage": "context",
            "application": {
                "clientId": self.application.client_id,
                "name": "Example application",
                "homepageUrl": None,
                "privacyUrl": None,
                "termsUrl": None,
                "requiresOrgLevelAccess": False,
            },
            "scopes": ["project:read"],
            "permissions": ["Read access to projects."],
            "permissionGroups": [
                {
                    "resource": "projects",
                    "label": "Projects",
                    "scopes": ["project:read"],
                    "actions": ["read"],
                    "description": None,
                    "accessDescriptions": {
                        "read": "View projects and their settings.",
                        "write": "Create and update projects. Manage project settings and alert rules, including deleting them.",
                        "admin": "Includes write access and allows deleting projects and removing ownership rules.",
                    },
                }
            ],
        }
        assert "no-store" in response["Cache-Control"]

    def test_context_does_not_authorize_existing_consent(self) -> None:
        self.login_as(self.user)
        persist_authorization(self.application, self.user.id, ["project:read"], None)

        response = self.get_success_response(**self.query)

        assert response.data["stage"] == "context"
        assert not ApiGrant.objects.filter(application=self.application).exists()
        assert not ApiToken.objects.filter(application=self.application).exists()
        assert not any(key.startswith("oa2:") for key in self.client.session.keys())

    def test_organization_app_context_before_membership(self) -> None:
        self.application.update(requires_org_level_access=True, scopes=["project:read"])

        response = self.get_success_response(**self.query)

        assert response.data["application"]["requiresOrgLevelAccess"] is True
        assert set(response.data) == {
            "stage",
            "application",
            "scopes",
            "permissions",
            "permissionGroups",
        }

    def test_unknown_client(self) -> None:
        response = self.get_error_response(
            **{**self.query, "client_id": "invalid"}, status_code=400
        )
        assert response.data == {"detail": "Missing or invalid client_id parameter."}

    def test_inactive_application(self) -> None:
        self.application.update(status=ApiApplicationStatus.inactive)
        self.get_error_response(**self.query, status_code=400)

    def test_unregistered_callback(self) -> None:
        response = self.get_error_response(
            **{**self.query, "redirect_uri": "https://other.example/callback"}, status_code=400
        )
        assert response.data == {"detail": "Missing or invalid redirect_uri parameter."}

    def test_multiple_callbacks_require_explicit_selection(self) -> None:
        self.application.update(redirect_uris="https://example.com/one\nhttps://example.com/two")
        self.get_error_response(**self.query, status_code=400)

    def test_invalid_scope_returns_validated_callback(self) -> None:
        response = self.get_success_response(**{**self.query, "scope": "invalid"})

        assert response.data["stage"] == "redirect"
        callback = urlsplit(response.data["redirectUrl"])
        assert callback.netloc == "example.com"
        assert parse_qs(callback.query) == {
            "error": ["invalid_scope"],
            "state": [self.query["state"]],
        }

    def test_invalid_pkce_returns_validated_callback(self) -> None:
        response = self.get_success_response(
            **{**self.query, "code_challenge": "invalid", "code_challenge_method": "S256"}
        )
        assert parse_qs(urlsplit(response.data["redirectUrl"]).query)["error"] == [
            "invalid_request"
        ]

    def test_unsafe_callback(self) -> None:
        self.application.update(redirect_uris="javascript:alert(1)")
        self.get_error_response(**self.query, status_code=400)

    def test_invalid_pkce_method_returns_validated_callback(self) -> None:
        response = self.get_success_response(
            **{**self.query, "code_challenge": "a" * 43, "code_challenge_method": "plain"}
        )
        assert parse_qs(urlsplit(response.data["redirectUrl"]).query)["error"] == [
            "invalid_request"
        ]

    def test_missing_client_id(self) -> None:
        response = self.get_error_response(response_type="code", status_code=400)
        assert "client_id" in response.data

    def test_invalid_response_type(self) -> None:
        response = self.get_error_response(
            **{**self.query, "response_type": "invalid"}, status_code=400
        )
        assert "response_type" in response.data

    def test_pkce_challenge_validation(self) -> None:
        for challenge in ("", "a" * 42, "a" * 129, "!" * 43):
            with self.subTest(challenge=challenge):
                response = self.get_success_response(
                    **{**self.query, "code_challenge": challenge, "code_challenge_method": "S256"}
                )

                assert parse_qs(urlsplit(response.data["redirectUrl"]).query)["error"] == [
                    "invalid_request"
                ]

    def test_unregistered_callback_with_invalid_pkce(self) -> None:
        response = self.get_error_response(
            **{
                **self.query,
                "redirect_uri": "https://other.example/callback",
                "code_challenge": "invalid",
            },
            status_code=400,
        )

        assert response.data == {"detail": "Missing or invalid redirect_uri parameter."}

    def test_state_whitespace_is_preserved(self) -> None:
        response = self.get_success_response(
            **{**self.query, "scope": "invalid", "state": "  opaque state  "}
        )

        assert parse_qs(urlsplit(response.data["redirectUrl"]).query)["state"] == [
            "  opaque state  "
        ]

    def test_custom_scheme_callback(self) -> None:
        for scheme, response_type in (
            ("sentry-apple", "code"),
            ("sentry-apple", "token"),
            ("sentry-replay-debugger", "code"),
            ("sentry-replay-debugger", "token"),
        ):
            with self.subTest(scheme=scheme, response_type=response_type):
                self.application.update(redirect_uris=f"{scheme}://callback")

                response = self.get_success_response(
                    **{**self.query, "response_type": response_type, "scope": "invalid"}
                )

                callback = urlsplit(response.data["redirectUrl"])
                assert callback.scheme == scheme
                assert callback.netloc == "callback"
                parameters = callback.fragment if response_type == "token" else callback.query
                assert parse_qs(parameters) == {
                    "error": ["invalid_scope"],
                    "state": [self.query["state"]],
                }

    def test_callback_is_normalized(self) -> None:
        for redirect_uri in (
            "https://example.com/new/path///../../callback/",
            "https://example.com/evil////../callback/",
        ):
            with self.subTest(redirect_uri=redirect_uri):
                self.application.update(redirect_uris="https://example.com/callback/", version=0)

                response = self.get_success_response(
                    **{**self.query, "redirect_uri": redirect_uri, "scope": "invalid"}
                )

                callback = urlsplit(response.data["redirectUrl"])
                assert callback.netloc == "example.com"
                assert callback.path == "/callback/"
