from __future__ import absolute_import

import six

from django.conf import settings
from sentry.models import AuthIdentity, AuthProvider
from sentry.testutils import AuthProviderTestCase
from sentry.utils.auth import SSO_SESSION_KEY


class AuthenticationTest(AuthProviderTestCase):
    def test_sso_auth_required(self):
        user = self.create_user('foo@example.com', is_superuser=False)
        organization = self.create_organization(name='foo')
        team = self.create_team(name='bar', organization=organization)
        project = self.create_project(name='baz', organization=organization,
                                      team=team)
        member = self.create_member(user=user, organization=organization,
                                    teams=[team])
        setattr(member.flags, 'sso:linked', True)
        member.save()
        group = self.create_group(project=project)
        self.create_event(group=group)

        auth_provider = AuthProvider.objects.create(
            organization=organization,
            provider='dummy',
            flags=0,
        )

        AuthIdentity.objects.create(
            auth_provider=auth_provider,
            user=user,
        )

        self.login_as(user)

        paths = (
            '/api/0/organizations/{}/'.format(organization.slug),
            '/api/0/projects/{}/{}/'.format(organization.slug, project.slug),
            '/api/0/teams/{}/{}/'.format(organization.slug, team.slug),
            '/api/0/issues/{}/'.format(group.id),
            # this uses the internal API, which once upon a time was broken
            '/api/0/issues/{}/events/latest/'.format(group.id),
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


class ScopeTest(AuthProviderTestCase):
    def test_order(self):
        assert settings.SENTRY_SCOPES[0] == 'project:read'
        assert settings.SENTRY_SCOPES[1] == 'project:write'
        assert settings.SENTRY_SCOPES[2] == 'project:admin'
        assert settings.SENTRY_SCOPES[3] == 'project:releases'
        assert settings.SENTRY_SCOPES[4] == 'team:read'
        assert settings.SENTRY_SCOPES[5] == 'team:write'
        assert settings.SENTRY_SCOPES[6] == 'team:admin'
        assert settings.SENTRY_SCOPES[7] == 'event:read'
        assert settings.SENTRY_SCOPES[8] == 'event:write'
        assert settings.SENTRY_SCOPES[9] == 'event:admin'
        assert settings.SENTRY_SCOPES[10] == 'org:read'
        assert settings.SENTRY_SCOPES[11] == 'org:write'
        assert settings.SENTRY_SCOPES[12] == 'org:admin'
        assert settings.SENTRY_SCOPES[13] == 'member:read'
        assert settings.SENTRY_SCOPES[14] == 'member:write'
        assert settings.SENTRY_SCOPES[15] == 'member:admin'
