from datetime import datetime, timedelta, timezone

from sentry.auth import superuser
from sentry.models import AuthIdentity, AuthProvider
from sentry.testutils import AuthProviderTestCase
from sentry.testutils.silo import exempt_from_silo_limits
from sentry.utils.auth import SSO_EXPIRY_TIME, SsoSession


# @control_silo_test(stable=True)
class OrganizationAuthLoginTest(AuthProviderTestCase):
    def test_sso_auth_required(self):
        with exempt_from_silo_limits():
            user = self.create_user("foo@example.com", is_superuser=False)
            organization = self.create_organization(name="foo")
            member = self.create_member(user=user, organization=organization)
            setattr(member.flags, "sso:linked", True)
            member.save()

            auth_provider = AuthProvider.objects.create(
                organization=organization, provider="dummy", flags=0
            )

            AuthIdentity.objects.create(auth_provider=auth_provider, user=user)

        self.login_as(user)

        path = f"/{organization.slug}/"
        redirect_uri = f"/auth/login/{organization.slug}/?next=%2Ffoo%2F"

        # we should be redirecting the user to the authentication form as they
        # haven't verified this specific organization
        resp = self.client.get(path)
        self.assertRedirects(resp, redirect_uri)

        # superuser should still require SSO as they're a member of the org
        user.update(is_superuser=True)
        resp = self.client.get(path)
        self.assertRedirects(resp, redirect_uri)

        # XXX(dcramer): using internal API as exposing a request object is hard
        sso_session = SsoSession.create(organization.id)
        self.session[sso_session.session_key] = sso_session.to_dict()
        self.save_session()

        # now that SSO is marked as complete, we should be able to access dash
        resp = self.client.get(path)
        assert resp.status_code == 200

    def test_foo(self):

        with exempt_from_silo_limits():
            user = self.create_user("foo@example.com", is_superuser=True)
            organization = self.create_organization(name="foo")
            other_org = self.create_organization(slug="albertos-apples")
            member = self.create_member(user=user, organization=organization)
            setattr(member.flags, "sso:linked", True)
            member.save()

            auth_provider = AuthProvider.objects.create(
                organization=organization, provider="dummy", flags=0
            )

            AuthIdentity.objects.create(auth_provider=auth_provider, user=user)

        # Login with active superuser session
        self.login_as(user)

        with self.feature(["organizations:customer-domains"]):
            # Induce valid SSO session
            sso_session = SsoSession.create(organization.id)
            self.session[sso_session.session_key] = sso_session.to_dict()
            self.save_session()

            # Induce activeorg
            response = self.client.get(
                f"/",
                HTTP_HOST=f"{organization.slug}.testserver",
                follow=True,
            )
            assert response.status_code == 200
            assert response.redirect_chain == [
                (f"http://{organization.slug}.testserver/issues/", 302)
            ]
            assert self.client.session["activeorg"] == organization.slug

            # Access another org as inactive superuser on customer domain
            response = self.client.get("/", HTTP_HOST=f"{other_org.slug}.testserver", follow=True)
            assert response.status_code == 200
            assert response.redirect_chain == [
                (f"http://{other_org.slug}.testserver/issues/", 302),
            ]

            # Expire SSO session
            sso_session_expired = SsoSession(
                organization.id,
                datetime.now(tz=timezone.utc) - SSO_EXPIRY_TIME - timedelta(hours=1),
            )
            self.session[sso_session_expired.session_key] = sso_session_expired.to_dict()
            sso_session_expired = SsoSession(
                other_org.id,
                datetime.now(tz=timezone.utc) - SSO_EXPIRY_TIME - timedelta(hours=1),
            )
            self.session[sso_session_expired.session_key] = sso_session_expired.to_dict()
            self.save_session()

            # Access another org as inactive superuser on customer domain
            response = self.client.get("/", HTTP_HOST=f"{other_org.slug}.testserver", follow=True)
            assert response.status_code == 200
            assert response.redirect_chain == [
                (f"http://{other_org.slug}.testserver/issues/", 302),
            ]
