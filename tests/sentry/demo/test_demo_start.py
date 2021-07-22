from urllib.parse import quote

from django.core import signing
from django.test.utils import override_settings
from exam import fixture

from sentry.demo.demo_start import MEMBER_ID_COOKIE, SAAS_ORG_SLUG, SKIP_EMAIL_COOKIE
from sentry.demo.models import DemoOrganization
from sentry.demo.settings import DEMO_DATA_GEN_PARAMS, DEMO_DATA_QUICK_GEN_PARAMS
from sentry.models import Group, Organization, OrganizationStatus, Project, Release, User
from sentry.testutils import TestCase
from sentry.utils.compat import mock

signer = signing.get_cookie_signer(salt=MEMBER_ID_COOKIE)


# significantly decrease event volume
DEMO_DATA_QUICK_GEN_PARAMS = DEMO_DATA_QUICK_GEN_PARAMS.copy()
DEMO_DATA_QUICK_GEN_PARAMS["MAX_DAYS"] = 1
DEMO_DATA_QUICK_GEN_PARAMS["SCALE_FACTOR"] = 0.1
DEMO_DATA_QUICK_GEN_PARAMS["DISABLE_SESSIONS"] = True

org_owner_email = "james@example.com"


@override_settings(DEMO_MODE=True, ROOT_URLCONF="sentry.demo.urls")
class DemoStartTest(TestCase):
    @fixture
    def path(self):
        return "/demo/start/"

    def setUp(self):
        super().setUp()
        self.user = self.create_user()
        self.org = self.create_organization()
        self.member = self.create_member(organization=self.org, role="member", user=self.user)

    @mock.patch("sentry.demo.demo_start.auth.login")
    @mock.patch("sentry.demo.demo_org_manager.assign_demo_org")
    def test_basic(self, mock_assign_demo_org, mock_auth_login):
        mock_assign_demo_org.return_value = (self.org, self.user)
        resp = self.client.post(self.path)
        assert resp.status_code == 302
        mock_auth_login.assert_called_once_with(mock.ANY, self.user)
        recovered = resp.cookies[MEMBER_ID_COOKIE].value.split(":")[0]
        assert recovered == str(self.member.id)
        mock_assign_demo_org.assert_called_once_with(skip_buffer=False)

    @override_settings(DEMO_MODE=False, ROOT_URLCONF="sentry.demo.urls")
    def test_disabled(self):
        resp = self.client.post(self.path)
        assert resp.status_code == 404

    @mock.patch("sentry.demo.demo_start.auth.login")
    def test_member_cookie(self, mock_auth_login):
        self.save_cookie(MEMBER_ID_COOKIE, signer.sign(self.member.id))
        resp = self.client.post(self.path)
        assert resp.status_code == 302
        mock_auth_login.assert_called_once_with(mock.ANY, self.user)

    @mock.patch("sentry.demo.demo_start.auth.login")
    @mock.patch("sentry.demo.demo_org_manager.assign_demo_org")
    def test_member_cookie_deactivated_org(self, mock_assign_demo_org, mock_auth_login):
        self.org.status = OrganizationStatus.PENDING_DELETION
        self.org.save()
        self.save_cookie(MEMBER_ID_COOKIE, signer.sign(self.member.id))

        new_user = self.create_user()
        new_org = self.create_organization()
        new_member = self.create_member(organization=new_org, role="member", user=new_user)
        mock_assign_demo_org.return_value = (new_org, new_user)

        resp = self.client.post(self.path)
        assert resp.status_code == 302
        mock_auth_login.assert_called_once_with(mock.ANY, new_user)
        recovered = resp.cookies[MEMBER_ID_COOKIE].value.split(":")[0]
        assert recovered == str(new_member.id)

    @mock.patch("sentry.demo.demo_start.auth.login")
    @mock.patch("sentry.demo.demo_org_manager.assign_demo_org")
    def test_basic_deep_links(self, mock_assign_demo_org, mock_auth_login):
        mock_assign_demo_org.return_value = (self.org, self.user)

        for scenario in ["performance", "releases", "alerts", "discover", "dashboards", "projects"]:
            resp = self.client.post(self.path, data={"scenario": scenario})
            partial_url = f"/organizations/{self.org.slug}/{scenario}/"
            assert resp.status_code == 302
            assert partial_url in resp.url

        extra_query_string = "param=156&thing=test"
        resp = self.client.post(
            self.path, data={"scenario": scenario, "extraQueryString": extra_query_string}
        )
        partial_url = f"/organizations/{self.org.slug}/{scenario}/?{extra_query_string}"
        assert resp.status_code == 302
        assert partial_url in resp.url

    @override_settings(
        DEMO_DATA_QUICK_GEN_PARAMS=DEMO_DATA_QUICK_GEN_PARAMS,
        DEMO_DATA_GEN_PARAMS=DEMO_DATA_GEN_PARAMS,
        DEMO_ORG_OWNER_EMAIL=org_owner_email,
    )
    def test_advanced_deep_links(self):
        User.objects.create(email=org_owner_email)
        # gen the org w/o mocks and save the cookie
        resp = self.client.post(self.path)
        self.save_cookie(MEMBER_ID_COOKIE, resp.cookies[MEMBER_ID_COOKIE])

        org = Organization.objects.get(demoorganization__isnull=False)
        project = Project.objects.get(slug="react", organization=org)
        group = Group.objects.filter(project=project).first()
        release = (
            Release.objects.filter(organization=org, projects=project)
            .order_by("-date_added")
            .first()
        )
        version = quote(release.version)

        base_issue_url = f"/organizations/{org.slug}/issues/{group.id}/?project={group.project_id}"

        scenario_tuples = [
            ("oneRelease", f"/organizations/{org.slug}/releases/{version}/"),
            ("oneDiscoverQuery", f"/organizations/{org.slug}/discover/results/"),
            ("oneIssue", base_issue_url),
            ("oneBreadcrumb", base_issue_url + "#breadcrumbs"),
            ("oneStackTrace", base_issue_url + "#exception"),
            ("oneTransaction", f"/organizations/{org.slug}/discover/"),
            (
                "oneWebVitals",
                f"/organizations/{org.slug}/performance/summary/vitals/?project={project.id}",
            ),
            (
                "oneTransactionSummary",
                f"/organizations/{org.slug}/performance/summary/?project={project.id}",
            ),
        ]

        assert DemoOrganization.objects.filter(organization=org).exists()

        for scenario_tuple in scenario_tuples:
            (scenario, partial_url) = scenario_tuple
            resp = self.client.post(self.path, data={"scenario": scenario, "projectSlug": "react"})
            assert resp.status_code == 302
            assert partial_url in resp.url

        extra_query_string = "param=156&thing=test"
        scenario_pairs = [
            ("oneIssue", f"{base_issue_url}&{extra_query_string}"),
            ("oneBreadcrumb", f"{base_issue_url}&{extra_query_string}#breadcrumbs"),
        ]

        for pair in scenario_pairs:
            (scenario, partial_url) = pair
            resp = self.client.post(
                self.path,
                data={
                    "scenario": scenario,
                    "projectSlug": "react",
                    "extraQueryString": extra_query_string,
                },
            )
            assert resp.status_code == 302
            assert partial_url in resp.url

    @mock.patch("sentry.demo.demo_start.auth.login")
    @mock.patch("sentry.demo.demo_org_manager.assign_demo_org")
    def test_skip_buffer(self, mock_assign_demo_org, mock_auth_login):
        mock_assign_demo_org.return_value = (self.org, self.user)
        self.client.post(self.path, data={"skipBuffer": "1"})
        mock_assign_demo_org.assert_called_once_with(skip_buffer=True)

    @mock.patch("sentry.demo.demo_start.auth.login")
    @mock.patch("sentry.demo.demo_org_manager.assign_demo_org")
    def test_skip_email(self, mock_assign_demo_org, mock_auth_login):
        mock_assign_demo_org.return_value = (self.org, self.user)
        resp = self.client.post(self.path, data={"skipEmail": "1"})
        assert resp.cookies[SKIP_EMAIL_COOKIE].value == "1"

    @mock.patch("sentry.demo.demo_start.auth.login")
    @mock.patch("sentry.demo.demo_org_manager.assign_demo_org")
    def test_saas_org_slug(self, mock_assign_demo_org, mock_auth_login):
        mock_assign_demo_org.return_value = (self.org, self.user)
        resp = self.client.post(self.path, data={"saasOrgSlug": "my-org"})
        assert resp.cookies[SAAS_ORG_SLUG].value == "my-org"
