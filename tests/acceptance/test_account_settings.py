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


@no_silo_test
class AccountSettingsWithoutOrganizationTest(AcceptanceTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.user = self.create_user("orgless@example.com")
        self.login_as(self.user)

    def test_navigate_account_settings(self) -> None:
        with self.options({"system.url-prefix": self.browser.live_server_url}):
            self.browser.get("/settings/account/details/")
            self.browser.wait_until('input[name="name"]')

            primary_navigation = self.browser.element('nav[aria-label="Primary Navigation"]')
            avatar = self.browser.element(f'button[aria-label="{self.user.email}"]')
            assert avatar.rect["y"] > primary_navigation.rect["y"]

            secondary_navigation = '[role="navigation"][aria-label="Secondary Navigation"]'
            links = self.browser.elements(f"{secondary_navigation} a[href]")
            assert len(links) == 10
            assert all("/settings/account/" in link.get_attribute("href") for link in links)

            for path, title in [
                ("security", "Security"),
                ("notifications", "Notifications"),
                ("emails", "Email Addresses"),
                ("subscriptions", "Subscriptions"),
                ("authorizations", "Authorized Applications"),
                ("identities", "Identities"),
                ("close-account", "Close Account"),
                ("api/auth-tokens", "Personal Tokens"),
                ("api/applications", "API Applications"),
            ]:
                destination = f"/settings/account/{path}/"
                self.browser.click_when_visible(f'{secondary_navigation} a[href="{destination}"]')
                self.browser.wait_until(xpath=f'//*[@id="main"]//h1[contains(., "{title}")]')
                self.wait_for_loading()
                assert self.browser.driver.current_url.endswith(destination)
                assert (
                    self.browser.element(
                        f'{secondary_navigation} a[href="{destination}"]'
                    ).get_attribute("aria-current")
                    == "page"
                )

            self.browser.click_when_visible(
                f'{secondary_navigation} a[href="/settings/account/details/"]'
            )
            self.browser.wait_until('input[name="name"]')
            assert self.browser.driver.current_url.endswith("/settings/account/details/")

    def test_navigate_account_settings_on_mobile(self) -> None:
        with (
            self.options({"system.url-prefix": self.browser.live_server_url}),
            self.browser.full_viewport(width=375, height=812, fit_content=False),
        ):
            self.browser.driver.execute_cdp_cmd(
                "Emulation.setTouchEmulationEnabled", {"enabled": True}
            )
            try:
                self.browser.get("/settings/account/details/")
                self.browser.wait_until('input[name="name"]')
                self.browser.click_when_visible('button[aria-label="Open main menu"]')
                self.browser.click_when_visible('a[href="/settings/account/security/"]')
                self.browser.wait_until('button[aria-label="Open main menu"]')
                self.browser.wait_until('input[autocomplete="current-password"]')
                assert self.browser.driver.current_url.endswith("/settings/account/security/")

                self.browser.click_when_visible('button[aria-label="Open main menu"]')
                self.browser.click_when_visible('a[href="/settings/account/emails/"]')
                self.browser.wait_until('button[aria-label="Open main menu"]')
                self.browser.wait_until('input[name="email"]')
                assert self.browser.driver.current_url.endswith("/settings/account/emails/")
            finally:
                self.browser.driver.execute_cdp_cmd(
                    "Emulation.setTouchEmulationEnabled", {"enabled": False}
                )
