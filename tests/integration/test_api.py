from __future__ import absolute_import

import six

from django.core.urlresolvers import reverse

from sentry.models import AuthIdentity, AuthProvider
from sentry.testutils import AuthProviderTestCase
from sentry.utils.auth import SSO_SESSION_KEY
from sentry.utils.linksign import generate_signed_link


class AuthenticationTest(AuthProviderTestCase):
    def test_sso_auth_required(self):
        user = self.create_user("foo@example.com", is_superuser=False)
        organization = self.create_organization(name="foo")
        team = self.create_team(name="bar", organization=organization)
        project = self.create_project(name="baz", organization=organization, teams=[team])
        member = self.create_member(user=user, organization=organization, teams=[team])
        setattr(member.flags, "sso:linked", True)
        member.save()
        event = self.store_event(data={}, project_id=project.id)
        group_id = event.group_id
        auth_provider = AuthProvider.objects.create(
            organization=organization, provider="dummy", flags=0
        )

        AuthIdentity.objects.create(auth_provider=auth_provider, user=user)

        self.login_as(user)

        paths = (
            u"/api/0/organizations/{}/".format(organization.slug),
            u"/api/0/projects/{}/{}/".format(organization.slug, project.slug),
            u"/api/0/teams/{}/{}/".format(organization.slug, team.slug),
            u"/api/0/issues/{}/".format(group_id),
            # this uses the internal API, which once upon a time was broken
            u"/api/0/issues/{}/events/latest/".format(group_id),
        )

        for path in paths:
            # we should be redirecting the user to the authentication form as they
            # haven't verified this specific organization
            resp = self.client.get(path)
            assert resp.status_code == 401, (resp.status_code, resp.content)

        # superuser should still require SSO as they're a member of the org
        user.update(is_superuser=True)
        for path in paths:
            resp = self.client.get(path)
            assert resp.status_code == 401, (resp.status_code, resp.content)

        # XXX(dcramer): using internal API as exposing a request object is hard
        self.session[SSO_SESSION_KEY] = six.text_type(organization.id)
        self.save_session()

        # now that SSO is marked as complete, we should be able to access dash
        for path in paths:
            resp = self.client.get(path)
            assert resp.status_code == 200, (path, resp.status_code, resp.content)

    def test_sso_auth_required_signed_link(self):
        user = self.create_user("foo@example.com", is_superuser=False)
        organization = self.create_organization(name="foo")
        team = self.create_team(name="bar", organization=organization)
        project = self.create_project(name="baz", organization=organization, teams=[team])
        member = self.create_member(user=user, organization=organization, teams=[team])
        setattr(member.flags, "sso:linked", True)
        member.save()

        self.store_event(data={}, project_id=project.id)

        auth_provider = AuthProvider.objects.create(
            organization=organization, provider="dummy", flags=0
        )

        AuthIdentity.objects.create(auth_provider=auth_provider, user=user)

        self.login_as(user)

        unsigned_link = reverse(
            "sentry-api-0-project-fix-processing-issues",
            kwargs={"project_slug": project.slug, "organization_slug": organization.slug},
        )

        resp = self.client.get(unsigned_link)
        assert resp.status_code == 401, (resp.status_code, resp.content)

        signed_link = generate_signed_link(
            user,
            "sentry-api-0-project-fix-processing-issues",
            kwargs={"project_slug": project.slug, "organization_slug": organization.slug},
        )

        resp = self.client.get(signed_link)
        assert resp.status_code == 200
