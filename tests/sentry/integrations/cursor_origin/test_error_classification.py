from __future__ import annotations

from sentry.integrations.cursor_origin.integration import CursorOriginIntegration
from sentry.shared_integrations.exceptions import ApiError, ApiUnauthorized
from sentry.testutils.cases import TestCase

TOKEN_URL = "https://api.cursor.com/v1/origin/app/installations/i_01example/access_tokens"
REPO_URL = "https://api.cursor.com/v1/origin/repos/sentry/nuget-trends"


class ErrorClassificationTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        integration = self.create_integration(
            organization=self.organization,
            provider="cursor_origin",
            external_id="i_01example",
            name="sentry",
        )
        installation = integration.get_installation(organization_id=self.organization.id)
        assert isinstance(installation, CursorOriginIntegration)
        self.installation = installation

    def test_rate_limiting_is_recognised(self) -> None:
        # The base class calls no error rate-limited, so without the override a
        # 429 would be reported as a broken integration.
        assert self.installation.is_rate_limited_error(ApiError("slow down", code=429))
        assert not self.installation.is_rate_limited_error(ApiError("nope", code=404))

    def test_a_failed_token_exchange_is_terminal(self) -> None:
        # Once an install is revoked, every call fails at the exchange rather
        # than on the resource. Generic handling reads that as an ordinary 404
        # and retries forever.
        for code in (401, 403, 404):
            assert (
                self.installation.is_broken_integration_error(
                    ApiError("gone", code=code, url=TOKEN_URL)
                )
                == "installation_suspended"
            )

    def test_rate_limiting_on_the_token_route_is_not_terminal(self) -> None:
        assert (
            self.installation.is_broken_integration_error(
                ApiError("slow down", code=429, url=TOKEN_URL)
            )
            == "rate_limited"
        )

    def test_a_missing_repository_is_not_terminal(self) -> None:
        # A 404 on a resource means that resource is gone, not the install.
        assert (
            self.installation.is_broken_integration_error(
                ApiError("no such repo", code=404, url=REPO_URL)
            )
            is None
        )

    def test_falls_back_to_the_shared_classification(self) -> None:
        assert (
            self.installation.is_broken_integration_error(ApiUnauthorized("bad token"))
            == "unauthorized"
        )
