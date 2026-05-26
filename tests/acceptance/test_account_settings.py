from sentry.testutils.cases import AcceptanceTestCase
from sentry.testutils.silo import no_silo_test


@no_silo_test
class AccountSettingsTest(AcceptanceTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(name="Rowdy Tiger Rowdy Tiger Rowdy Tiger", owner=None)
        self.team = self.create_team(
            organization=self.org, name="Mariachi Band Mariachi Band Mariachi Band"
        )
        self.project = self.create_project(
            organization=self.org, teams=[self.team], name="Bengal Bengal Bengal Bengal"
        )
        self.create_member(user=self.user, organization=self.org, role="owner", teams=[self.team])
        second_org = self.create_organization(name="Multiple Owners", owner=self.user)
        self.create_member(
            user=self.create_user("bar@example.com"), organization=second_org, role="owner"
        )
        self.login_as(self.user)

    def test_account_notifications(self) -> None:
        with (
            self.options({"system.url-prefix": self.browser.live_server_url}),
            self.feature("organizations:onboarding"),
        ):
            self.browser.get("/settings/account/notifications/")
            self.browser.wait_until_not('[data-test-id="loading-indicator"]')

            self.browser.click_when_visible('[data-test-id="fine-tuning"]')
            self.browser.wait_until_not('[data-test-id="loading-indicator"]')
