import responses

from tests.sentry.uptime.endpoints import UptimeAlertBaseEndpointTest


class OrganizationUptimeAlertPreview(UptimeAlertBaseEndpointTest):
    endpoint = "sentry-api-0-organization-uptime-alert-preview-check"
    method = "post"
    features: dict[str, bool] = {"organizations:uptime-runtime-assertions": True}

    def test_bad_region(self) -> None:
        with self.feature(self.features):
            response = self.get_error_response(
                self.organization.slug,
                name="test",
                environment="uptime-prod",
                owner=f"user:{self.user.id}",
                url="http://sentry.io",
                timeout_ms=1500,
                body=None,
                region="does_not_exist",
            )
            assert "region" in response.data

    def test_bad_config(self) -> None:
        with self.feature(self.features):
            response = self.get_error_response(
                self.organization.slug, name="test", region="default"
            )
            assert "url" in response.data
            assert "timeoutMs" in response.data

    @responses.activate
    def test_bad_checker_validation(self) -> None:
        with self.feature(self.features):
            # (We issue a validate call before the actual check execution.)
            responses.add(
                responses.POST,
                "http://pop-st-1.uptime-checker.s4s.sentry.internal:80/validate_check",
                status=400,
                json={"error": True},
            )
            response = self.get_error_response(
                self.organization.slug,
                name="test",
                environment="uptime-prod",
                owner=f"user:{self.user.id}",
                url="http://sentry.io",
                timeout_ms=1500,
                body=None,
                region="default",
            )

            assert "error" in response.data

    @responses.activate
    def test_success(self) -> None:
        with self.feature(self.features):
            # (We issue a validate call before the actual check execution.)
            responses.add(
                responses.POST,
                "http://pop-st-1.uptime-checker.s4s.sentry.internal:80/validate_check",
                status=200,
                json={"succeeded": True},
            )
            responses.add(
                responses.POST,
                "http://pop-st-1.uptime-checker.s4s.sentry.internal:80/execute_config",
                status=200,
                json={"succeeded": True},
            )
            self.get_success_response(
                self.organization.slug,
                name="test",
                environment="uptime-prod",
                owner=f"user:{self.user.id}",
                url="http://sentry.io",
                timeout_ms=1500,
                body=None,
                region="default",
            )
