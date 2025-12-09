import responses

from tests.sentry.uptime.endpoints import UptimeAlertBaseEndpointTest


class OrganizationUptimeAlertTest(UptimeAlertBaseEndpointTest):
    endpoint = "sentry-api-0-organization-uptime-alert-test"
    method = "post"

    def test_bad_region(self) -> None:
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

        assert response.data == "No such region"

    def test_bad_config(self) -> None:
        response = self.get_error_response(self.organization.slug, name="test", region="default")
        assert "url" in response.data
        assert "timeoutMs" in response.data

    @responses.activate
    def test_success(self) -> None:
        responses.add(
            responses.POST,
            "http://pop-st-1.uptime-checker.s4s.sentry.internal:80/execute_config",
            status=200,
            json={"succeeded": True},
        )
        response = self.get_success_response(
            self.organization.slug,
            name="test",
            environment="uptime-prod",
            owner=f"user:{self.user.id}",
            url="http://sentry.io",
            timeout_ms=1500,
            body=None,
            region="default",
        )

        assert response.data["succeeded"]
