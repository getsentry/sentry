from unittest import mock

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
class OrganizationUptimeAssertionSuggestionsTest(UptimeAlertBaseEndpointTest):
    endpoint = "sentry-api-0-organization-uptime-assertion-suggestions"
    method = "post"

    def setUp(self) -> None:
        super().setUp()
        self.url = reverse(self.endpoint, args=[self.organization.slug])
        self.payload = {
            "name": "test",
            "environment": "uptime-prod",
            "owner": f"user:{self.user.id}",
            "url": "http://sentry.io",
            "timeoutMs": 1500,
            "body": None,
            "region": "default",
        }

    # TODO(api-write-scope-compat): Remove this legacy org:* coverage once
    # uptime assertion-suggestion clients have migrated to alerts:write.
    @mock.patch(
        "sentry.uptime.endpoints.organization_uptime_assertion_suggestions.generate_assertion_suggestions"
    )
    @mock.patch(
        "sentry.uptime.endpoints.organization_uptime_assertion_suggestions.checker_api.invoke_checker_preview"
    )
    @mock.patch(
        "sentry.uptime.endpoints.organization_uptime_assertion_suggestions.UptimeCheckPreviewValidator"
    )
    @mock.patch("sentry.uptime.endpoints.organization_uptime_assertion_suggestions.has_seer_access")
    def test_alerts_write_scope_can_generate_suggestions(
        self,
        mock_has_seer_access: mock.MagicMock,
        mock_validator_cls: mock.MagicMock,
        mock_preview: mock.MagicMock,
        mock_generate: mock.MagicMock,
    ) -> None:
        api_key = self.create_api_key(organization=self.organization, scope_list=["alerts:write"])
        mock_has_seer_access.return_value = True
        mock_validator = mock_validator_cls.return_value
        mock_validator.is_valid.return_value = True
        mock_validator.save.return_value = {"active_regions": ["default"]}
        mock_preview.return_value = mock.Mock(
            status_code=200,
            json=mock.Mock(return_value={"status": 200}),
            raise_for_status=mock.Mock(),
        )
        mock_generate.return_value = (None, None)

        response = self.client.post(
            self.url,
            data=self.payload,
            format="json",
            HTTP_AUTHORIZATION=self.create_basic_auth_header(api_key.key),
        )

        assert response.status_code == 200

    # TODO(api-write-scope-compat): Remove this legacy org:* coverage once
    # uptime assertion-suggestion clients have migrated to alerts:write.
    @mock.patch(
        "sentry.uptime.endpoints.organization_uptime_assertion_suggestions.generate_assertion_suggestions"
    )
    @mock.patch(
        "sentry.uptime.endpoints.organization_uptime_assertion_suggestions.checker_api.invoke_checker_preview"
    )
    @mock.patch(
        "sentry.uptime.endpoints.organization_uptime_assertion_suggestions.UptimeCheckPreviewValidator"
    )
    @mock.patch("sentry.uptime.endpoints.organization_uptime_assertion_suggestions.has_seer_access")
    def test_org_read_scope_can_generate_suggestions(
        self,
        mock_has_seer_access: mock.MagicMock,
        mock_validator_cls: mock.MagicMock,
        mock_preview: mock.MagicMock,
        mock_generate: mock.MagicMock,
    ) -> None:
        api_key = self.create_api_key(organization=self.organization, scope_list=["org:read"])
        mock_has_seer_access.return_value = True
        mock_validator = mock_validator_cls.return_value
        mock_validator.is_valid.return_value = True
        mock_validator.save.return_value = {"active_regions": ["default"]}
        mock_preview.return_value = mock.Mock(
            status_code=200,
            json=mock.Mock(return_value={"status": 200}),
            raise_for_status=mock.Mock(),
        )
        mock_generate.return_value = (None, None)

        response = self.client.post(
            self.url,
            data=self.payload,
            format="json",
            HTTP_AUTHORIZATION=self.create_basic_auth_header(api_key.key),
        )

        assert response.status_code == 200

    @mock.patch(
        "sentry.uptime.endpoints.organization_uptime_assertion_suggestions.generate_assertion_suggestions"
    )
    @mock.patch(
        "sentry.uptime.endpoints.organization_uptime_assertion_suggestions.checker_api.invoke_checker_preview"
    )
    @mock.patch(
        "sentry.uptime.endpoints.organization_uptime_assertion_suggestions.UptimeCheckPreviewValidator"
    )
    @mock.patch("sentry.uptime.endpoints.organization_uptime_assertion_suggestions.has_seer_access")
    def test_org_write_scope_can_generate_suggestions(
        self,
        mock_has_seer_access: mock.MagicMock,
        mock_validator_cls: mock.MagicMock,
        mock_preview: mock.MagicMock,
        mock_generate: mock.MagicMock,
    ) -> None:
        api_key = self.create_api_key(organization=self.organization, scope_list=["org:write"])
        mock_has_seer_access.return_value = True
        mock_validator = mock_validator_cls.return_value
        mock_validator.is_valid.return_value = True
        mock_validator.save.return_value = {"active_regions": ["default"]}
        mock_preview.return_value = mock.Mock(
            status_code=200,
            json=mock.Mock(return_value={"status": 200}),
            raise_for_status=mock.Mock(),
        )
        mock_generate.return_value = (None, None)

        response = self.client.post(
            self.url,
            data=self.payload,
            format="json",
            HTTP_AUTHORIZATION=self.create_basic_auth_header(api_key.key),
        )

        assert response.status_code == 200

    @mock.patch(
        "sentry.uptime.endpoints.organization_uptime_assertion_suggestions.generate_assertion_suggestions"
    )
    @mock.patch(
        "sentry.uptime.endpoints.organization_uptime_assertion_suggestions.checker_api.invoke_checker_preview"
    )
    @mock.patch(
        "sentry.uptime.endpoints.organization_uptime_assertion_suggestions.UptimeCheckPreviewValidator"
    )
    @mock.patch("sentry.uptime.endpoints.organization_uptime_assertion_suggestions.has_seer_access")
    def test_team_admin_can_generate_suggestions_when_member_alert_write_disabled(
        self,
        mock_has_seer_access: mock.MagicMock,
        mock_validator_cls: mock.MagicMock,
        mock_preview: mock.MagicMock,
        mock_generate: mock.MagicMock,
    ) -> None:
        team_admin_user = self.create_user(is_superuser=False)
        self.create_member(
            user=team_admin_user,
            organization=self.organization,
            role="member",
            team_roles=[(self.team, "admin")],
        )
        self.organization.update_option("sentry:alerts_member_write", False)
        self.login_as(team_admin_user)

        mock_has_seer_access.return_value = True
        mock_validator = mock_validator_cls.return_value
        mock_validator.is_valid.return_value = True
        mock_validator.save.return_value = {"active_regions": ["default"]}
        mock_preview.return_value = mock.Mock(
            status_code=200,
            json=mock.Mock(return_value={"status": 200}),
            raise_for_status=mock.Mock(),
        )
        mock_generate.return_value = (None, None)

        response = self.client.post(self.url, data=self.payload, format="json")

        assert response.status_code == 200
