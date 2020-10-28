from __future__ import absolute_import

import six

from sentry.models import AuthIdentity, AuthProvider
from sentry.testutils import AuthProviderTestCase
from sentry.utils.auth import SSO_SESSION_KEY


class OrganizationAuthLoginTest(AuthProviderTestCase):
    def test_sso_auth_required(self):
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

        path = u"/{}/".format(organization.slug)
        redirect_uri = u"/auth/login/{}/".format(organization.slug)

        # we should be redirecting the user to the authentication form as they
        # haven't verified this specific organization
        resp = self.client.get(path)
        self.assertRedirects(resp, redirect_uri)

        # superuser should still require SSO as they're a member of the org
        user.update(is_superuser=True)
        resp = self.client.get(path)
        self.assertRedirects(resp, redirect_uri)

        # XXX(dcramer): using internal API as exposing a request object is hard
        self.session[SSO_SESSION_KEY] = six.text_type(organization.id)
        self.save_session()

        # now that SSO is marked as complete, we should be able to access dash
        resp = self.client.get(path)
        assert resp.status_code == 200
