from unittest import mock

import responses
from django.test import override_settings
from django.urls import reverse

from sentry.conf.types.uptime import UptimeRegionConfig
from tests.sentry.uptime.endpoints import UptimeAlertBaseEndpointTest


@override_settings(
    UPTIME_REGIONS=[
        UptimeRegionConfig(
            slug="default",
            name="Default Region",
            config_redis_key_prefix="default",
            api_endpoint="pop-st-1.uptime-checker.s4s.sentry.internal:80",
        )
    ]
)
class OrganizationUptimeAlertPreview(UptimeAlertBaseEndpointTest):
    endpoint = "sentry-api-0-organization-uptime-alert-preview-check"
    method = "post"

    def setUp(self) -> None:
        super().setUp()
        self.context = {
            "organization": self.organization,
            "user": self.user,
        }

    def test_bad_config(self) -> None:
        response = self.get_error_response(self.organization.slug, name="test", region="default")
        assert "url" in response.data
        assert response.data["url"][0].code == "required"
        assert "timeoutMs" in response.data
        assert response.data["timeoutMs"][0].code == "required"

    def test_bad_checker_validation(self) -> None:
        mock_response = mock.Mock()
        mock_response.status_code = 400
        mock_response.json.return_value = {"error": True}
        self.mock_invoke_checker_validator.return_value = mock_response

        response = self.get_error_response(
            self.organization.slug,
            name="test",
            environment="uptime-prod",
            owner=f"user:{self.user.id}",
            url="http://sentry.io",
            timeout_ms=1500,
            body=None,
            region="default",
            assertion={
                "root": {
                    "op": "and",
                    "id": "root-1",
                    "children": [
                        {
                            "id": "child-1",
                            "op": "status_code_check",
                            "operator": {"cmp": "equals"},
                            "value": 200,
                        }
                    ],
                }
            },
        )

        assert "assertion" in response.data
        assert "error" in response.data["assertion"]
        assert response.data["assertion"]["error"].code == "invalid"

    @responses.activate
    def test_success(self) -> None:
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

    @responses.activate
    def test_alerts_write_permission(self) -> None:
        """Test that a user with only alerts:write permission can run a preview check"""
        api_key = self.create_api_key(organization=self.organization, scope_list=["alerts:write"])

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

        url = reverse(
            "sentry-api-0-organization-uptime-alert-preview-check",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )
        response = self.client.post(
            url,
            data={
                "name": "test",
                "environment": "uptime-prod",
                "owner": f"user:{self.user.id}",
                "url": "http://sentry.io",
                "timeoutMs": 1500,
                "body": None,
                "region": "default",
            },
            format="json",
            HTTP_AUTHORIZATION=self.create_basic_auth_header(api_key.key),
        )

        assert response.status_code == 200, response.content
