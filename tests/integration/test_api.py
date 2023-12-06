from datetime import datetime, timedelta, timezone

from sentry.models.authidentity import AuthIdentity
from sentry.models.authprovider import AuthProvider
from sentry.testutils.cases import AuthProviderTestCase
from sentry.testutils.skips import requires_snuba
from sentry.utils.auth import SSO_EXPIRY_TIME, SsoSession

pytestmark = [requires_snuba]


# TODO: move these into the tests/sentry/auth directory and remove deprecated logic
class AuthenticationTest(AuthProviderTestCase):
    def setUp(self):
        self.organization = self.create_organization(name="foo")
        self.user = self.create_user("foobar@example.com", is_superuser=False)
        team = self.create_team(name="bar", organization=self.organization)

        self.project = self.create_project(name="baz", organization=self.organization, teams=[team])

        member = self.create_member(user=self.user, organization=self.organization, teams=[team])

        setattr(member.flags, "sso:linked", True)
        member.save()
        event = self.store_event(data={}, project_id=self.project.id)
        group_id = event.group_id
        auth_provider = AuthProvider.objects.create(
            organization_id=self.organization.id, provider="dummy", flags=0
        )
        AuthIdentity.objects.create(auth_provider=auth_provider, user=self.user)
        self.login_as(self.user)

        self.paths = (
            f"/api/0/organizations/{self.organization.slug}/",
            f"/api/0/projects/{self.organization.slug}/{self.project.slug}/",
            f"/api/0/teams/{self.organization.slug}/{self.team.slug}/",
            f"/api/0/issues/{group_id}/",
            # this uses the internal API, which once upon a time was broken
            f"/api/0/issues/{group_id}/events/latest/",
        )

    def test_sso_auth_required(self):
        # we should be redirecting the user to the authentication form as they
        # haven't verified this specific organization
        self._test_paths_with_status(401)

    def test_sso_superuser_required(self):
        # superuser should still require SSO as they're a member of the org
        self.user.update(is_superuser=True)
        self._test_paths_with_status(401)

    def test_sso_with_expiry_valid(self):
        sso_session = SsoSession.create(self.organization.id)
        self.session[sso_session.session_key] = sso_session.to_dict()
        self.save_session()

        self._test_paths_with_status(200)

    def test_sso_with_expiry_expired(self):
        sso_session_expired = SsoSession(
            self.organization.id,
            datetime.now(tz=timezone.utc) - SSO_EXPIRY_TIME - timedelta(hours=1),
        )
        self.session[sso_session_expired.session_key] = sso_session_expired.to_dict()

        self.save_session()
        self._test_paths_with_status(401)

    def test_sso_redirect_url_internal(self):
        sso_session_expired = SsoSession(
            self.organization.id,
            datetime.now(tz=timezone.utc) - SSO_EXPIRY_TIME - timedelta(hours=1),
        )
        self.session[sso_session_expired.session_key] = sso_session_expired.to_dict()

        self.save_session()
        resp = self.client.get(
            f"/api/0/teams/{self.organization.slug}/{self.team.slug}/",
            HTTP_REFERER=f"/organizations/{self.organization.slug}/teams",
        )

        assert (
            resp.json()["detail"]["extra"]["loginUrl"]
            == "/auth/login/foo/?next=%2Forganizations%2Ffoo%2Fteams"
        )

    def test_sso_redirect_url_internal_with_domain(self):
        sso_session_expired = SsoSession(
            self.organization.id,
            datetime.now(tz=timezone.utc) - SSO_EXPIRY_TIME - timedelta(hours=1),
        )
        self.session[sso_session_expired.session_key] = sso_session_expired.to_dict()

        self.save_session()
        resp = self.client.get(
            f"/api/0/teams/{self.organization.slug}/{self.team.slug}/",
            HTTP_REFERER=f"https://testdomain.com/organizations/{self.organization.slug}/teams",
            SERVER_NAME="testdomain.com",
        )

        assert (
            resp.json()["detail"]["extra"]["loginUrl"]
            == "/auth/login/foo/?next=https%3A%2F%2Ftestdomain.com%2Forganizations%2Ffoo%2Fteams"
        )

    def test_sso_redirect_url_external_removed(self):
        sso_session_expired = SsoSession(
            self.organization.id,
            datetime.now(tz=timezone.utc) - SSO_EXPIRY_TIME - timedelta(hours=1),
        )
        self.session[sso_session_expired.session_key] = sso_session_expired.to_dict()

        self.save_session()
        resp = self.client.get(
            f"/api/0/teams/{self.organization.slug}/{self.team.slug}/",
            HTTP_REFERER="http://example.com",
        )

        assert resp.json()["detail"]["extra"]["loginUrl"] == "/auth/login/foo/"

    def _test_paths_with_status(self, status):
        for path in self.paths:
            resp = self.client.get(path)
            assert resp.status_code == status, (resp.status_code, resp.content)
