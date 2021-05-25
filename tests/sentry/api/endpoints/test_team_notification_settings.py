from sentry.models import NotificationSetting
from sentry.notifications.types import NotificationSettingOptionValues, NotificationSettingTypes
from sentry.testutils import APITestCase
from sentry.types.integrations import ExternalProviders

FEATURE_NAMES = [
    "organizations:notification-platform",
]


class TeamNotificationSettingsTestBase(APITestCase):
    endpoint = "sentry-api-0-team-notification-settings"

    def setUp(self):
        self.login_as(self.user)
        self.org = self.organization  # Force creation.
        _ = self.project  # Force creation.


class TeamNotificationSettingsGetTest(TeamNotificationSettingsTestBase):
    def test_simple(self):
        with self.feature(FEATURE_NAMES):
            response = self.get_success_response(self.org.slug, self.team.slug)

        # Spot check.
        assert response.data["alerts"]["project"][self.project.id]["email"] == "default"
        assert response.data["deploy"]["organization"][self.org.id]["email"] == "default"
        assert response.data["workflow"]["project"][self.project.id]["slack"] == "default"

    def test_type_querystring(self):
        with self.feature(FEATURE_NAMES):
            response = self.get_success_response(
                self.org.slug, self.team.slug, qs_params={"type": "workflow"}
            )

        assert "alerts" not in response.data
        assert "workflow" in response.data

    def test_invalid_querystring(self):
        with self.feature(FEATURE_NAMES):
            self.get_error_response(
                self.org.slug, self.team.slug, qs_params={"type": "invalid"}, status_code=400
            )

    def test_invalid_team_slug(self):
        with self.feature(FEATURE_NAMES):
            self.get_error_response(self.org.slug, "invalid", status_code=404)

    def test_wrong_team_slug(self):
        other_org = self.create_organization()
        other_team = self.create_team(organization=other_org, name="Tesla Motors")

        with self.feature(FEATURE_NAMES):
            self.get_error_response(other_org.slug, other_team.slug, status_code=403)


class TeamNotificationSettingsTest(TeamNotificationSettingsTestBase):
    method = "put"

    def test_simple(self):
        assert (
            NotificationSetting.objects.get_settings(
                provider=ExternalProviders.SLACK,
                type=NotificationSettingTypes.ISSUE_ALERTS,
                team=self.team,
                project=self.project,
            )
            == NotificationSettingOptionValues.DEFAULT
        )

        with self.feature(FEATURE_NAMES):
            self.get_success_response(
                self.org.slug,
                self.team.slug,
                **{
                    "alerts": {"project": {self.project.id: {"email": "always", "slack": "always"}}}
                },
            )

        assert (
            NotificationSetting.objects.get_settings(
                provider=ExternalProviders.SLACK,
                type=NotificationSettingTypes.ISSUE_ALERTS,
                team=self.team,
                project=self.project,
            )
            == NotificationSettingOptionValues.ALWAYS
        )

    def test_empty_payload(self):
        with self.feature(FEATURE_NAMES):
            self.get_error_response(self.org.slug, self.team.slug, **{}, status_code=400)

    def test_invalid_payload(self):
        with self.feature(FEATURE_NAMES):
            self.get_error_response(
                self.org.slug, self.team.slug, **{"invalid": 1}, status_code=400
            )
