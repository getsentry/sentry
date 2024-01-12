from django.test.utils import override_settings
from django.urls import reverse

from sentry.api.endpoints.setup_wizard import SETUP_WIZARD_CACHE_KEY
from sentry.api.serializers import serialize
from sentry.cache import default_cache
from sentry.models.apitoken import ApiToken
from sentry.models.projectkey import ProjectKey
from sentry.silo.base import SiloMode
from sentry.testutils.cases import PermissionTestCase
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test


@control_silo_test
class SetupWizard(PermissionTestCase):
    def test_redirect(self):
        user = self.create_user("foo@example.com", is_active=False)

        url = reverse("sentry-project-wizard-fetch", kwargs={"wizard_hash": "abc"})
        resp = self.client.get(url)

        self.login_as(user)

        assert resp.status_code == 302

    def test_simple(self):
        self.create_organization(owner=self.user)

        self.login_as(self.user)

        key = f"{SETUP_WIZARD_CACHE_KEY}abc"
        default_cache.set(key, "test", 600)

        url = reverse("sentry-project-wizard-fetch", kwargs={"wizard_hash": "abc"})
        resp = self.client.get(url)

        assert resp.status_code == 200
        self.assertTemplateUsed(resp, "sentry/setup-wizard.html")

    def test_redirect_to_org(self):
        self.create_organization(owner=self.user)

        self.login_as(self.user)

        url = reverse("sentry-project-wizard-fetch", kwargs={"wizard_hash": "xyz"})
        resp = self.client.get(url)

        assert resp.status_code == 302

    def test_project(self):
        self.org = self.create_organization(owner=self.user)
        self.team = self.create_team(organization=self.org, name="Mariachi Band")
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.login_as(self.user)

        key = f"{SETUP_WIZARD_CACHE_KEY}abc"
        default_cache.set(key, "test", 600)

        url = reverse("sentry-project-wizard-fetch", kwargs={"wizard_hash": "abc"})
        resp = self.client.get(url)

        assert resp.status_code == 200
        self.assertTemplateUsed(resp, "sentry/setup-wizard.html")
        cached = default_cache.get(key)
        assert cached.get("apiKeys").get("scopes")[0] == "org:ci"
        assert cached.get("projects")[0].get("status") == "active"
        assert cached.get("projects")[0].get("keys")[0].get("isActive")
        assert cached.get("projects")[0].get("organization").get("status").get("id") == "active"

    def test_project_multiple_keys(self):
        self.org = self.create_organization(owner=self.user)
        self.team = self.create_team(organization=self.org, name="Mariachi Band")
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")

        with assume_test_silo_mode(SiloMode.REGION):
            self.project.key_set.add(ProjectKey.objects.create(project=self.project, label="abc"))

        self.login_as(self.user)

        key = f"{SETUP_WIZARD_CACHE_KEY}abc"
        default_cache.set(key, "test", 600)

        url = reverse("sentry-project-wizard-fetch", kwargs={"wizard_hash": "abc"})
        resp = self.client.get(url)

        assert resp.status_code == 200
        self.assertTemplateUsed(resp, "sentry/setup-wizard.html")
        cached = default_cache.get(key)

        assert len(cached.get("projects")[0].get("keys")) == 2

    def test_return_user_auth_token_if_multiple_orgs(self):
        user_api_token = ApiToken.objects.create_or_update(
            user=self.user,
            scope_list=["project:releases"],
            refresh_token=None,
            expires_at=None,
        )[0]

        self.org = self.create_organization(name="org1", owner=self.user)
        self.org2 = self.create_organization(name="org2", owner=self.user)
        self.team = self.create_team(organization=self.org, name="Mariachi Band")
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        with assume_test_silo_mode(SiloMode.REGION):
            self.project.key_set.add(ProjectKey.objects.create(project=self.project, label="abc"))

        self.login_as(self.user)

        key = f"{SETUP_WIZARD_CACHE_KEY}abc"
        default_cache.set(key, "test", 600)

        url = reverse("sentry-project-wizard-fetch", kwargs={"wizard_hash": "abc"})
        resp = self.client.get(url)

        assert resp.status_code == 200
        self.assertTemplateUsed(resp, "sentry/setup-wizard.html")
        cached = default_cache.get(key)

        assert cached.get("apiKeys") == serialize(user_api_token)

    def test_return_org_auth_token_if_one_org(self):
        self.org = self.create_organization(owner=self.user)
        self.team = self.create_team(organization=self.org, name="Mariachi Band")
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")

        with assume_test_silo_mode(SiloMode.REGION):
            self.project.key_set.add(ProjectKey.objects.create(project=self.project, label="abc"))

        self.login_as(self.user)

        key = f"{SETUP_WIZARD_CACHE_KEY}abc"
        default_cache.set(key, "test", 600)

        url = reverse("sentry-project-wizard-fetch", kwargs={"wizard_hash": "abc"})
        resp = self.client.get(url)

        assert resp.status_code == 200
        self.assertTemplateUsed(resp, "sentry/setup-wizard.html")
        cached = default_cache.get(key)

        token = cached.get("apiKeys")["token"]

        assert token.startswith("sntrys_")

    @override_settings(SENTRY_SIGNUP_URL="https://sentry.io/signup/")
    def test_redirect_to_signup(self):
        self.create_organization(owner=self.user)
        url = (
            reverse("sentry-project-wizard-fetch", kwargs={"wizard_hash": "xyz"})
            + "?signup=1&test=other"
        )
        resp = self.client.get(url)

        assert resp.status_code == 302
        assert (
            resp.headers["Location"]
            == "https://sentry.io/signup/?next=http%3A%2F%2Ftestserver%2Faccount%2Fsettings%2Fwizard%2Fxyz%2F&test=other"
        )

    @override_settings(SENTRY_SIGNUP_URL="https://sentry.io/signup/")
    def test_redirect_to_login_if_no_query_param(self):
        self.create_organization(owner=self.user)
        url = reverse("sentry-project-wizard-fetch", kwargs={"wizard_hash": "xyz"})
        resp = self.client.get(url)

        assert resp.status_code == 302
        assert resp.headers["Location"] == "/auth/login/"
