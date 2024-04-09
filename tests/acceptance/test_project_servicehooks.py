from sentry.models.servicehook import ServiceHook
from sentry.testutils.cases import AcceptanceTestCase
from sentry.testutils.silo import no_silo_test


@no_silo_test
class ProjectServiceHooksTest(AcceptanceTestCase):
    def setUp(self):
        super().setUp()
        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(name="Rowdy Tiger", owner=None)
        self.team = self.create_team(organization=self.org, name="Mariachi Band")
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.create_member(user=self.user, organization=self.org, role="owner", teams=[self.team])

        self.login_as(self.user)
        self.list_hooks_path = f"/settings/{self.org.slug}/projects/{self.project.slug}/hooks/"
        self.new_hook_path = f"/settings/{self.org.slug}/projects/{self.project.slug}/hooks/new/"

    def test_simple(self):
        with self.feature("projects:servicehooks"):
            self.browser.get(self.list_hooks_path)
            self.browser.wait_until_not('[data-test-id="loading-indicator"]')
            # click "New"
            self.browser.click('[data-test-id="new-service-hook"]')

            self.browser.wait_until_not('[data-test-id="loading-indicator"]')
            assert self.browser.current_url == f"{self.browser.live_server_url}{self.new_hook_path}"
            self.browser.element('input[name="url"]').send_keys("https://example.com/hook")
            # click "Save Changes"
            self.browser.click('form [data-test-id="form-submit"]')

            self.browser.wait_until_not('[data-test-id="loading-indicator"]')
            assert (
                self.browser.current_url == f"{self.browser.live_server_url}{self.list_hooks_path}"
            )

            hook = ServiceHook.objects.get(project_id=self.project.id)
            assert hook.url == "https://example.com/hook"
            assert not hook.events

            # hopefully click the first service hook
            self.browser.click('[data-test-id="project-service-hook"]')
            self.browser.wait_until_not('[data-test-id="loading-indicator"]')
            assert self.browser.current_url == "{}{}".format(
                self.browser.live_server_url,
                f"/settings/{self.org.slug}/projects/{self.project.slug}/hooks/{hook.guid}/",
            )
