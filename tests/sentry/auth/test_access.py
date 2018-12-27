from __future__ import absolute_import

from django.contrib.auth.models import AnonymousUser
from mock import Mock

from sentry.auth import access
from sentry.models import AuthProvider, AuthIdentity, Organization
from sentry.mediators.sentry_app_installations import Creator as \
    SentryAppInstallationCreator
from sentry.testutils import TestCase


class FromUserTest(TestCase):
    def test_no_access(self):
        organization = self.create_organization()
        team = self.create_team(organization=organization)
        user = self.create_user()

        result = access.from_user(user, organization)
        assert not result.sso_is_valid
        assert not result.requires_sso
        assert not result.scopes
        assert not result.has_team_access(team)
        assert not result.has_team_membership(team)

    def test_owner_all_teams(self):
        user = self.create_user()
        organization = self.create_organization(owner=self.user)
        member = self.create_member(
            organization=organization,
            user=user,
            role='owner',
        )
        team = self.create_team(organization=organization)

        result = access.from_user(user, organization)
        assert result.sso_is_valid
        assert not result.requires_sso
        assert result.scopes == member.get_scopes()
        assert result.has_team_access(team)
        assert result.has_team_membership(team)

    def test_member_no_teams_closed_membership(self):
        user = self.create_user()
        organization = self.create_organization(
            owner=self.user,
            flags=0,  # disable default allow_joinleave
        )
        member = self.create_member(
            organization=organization,
            user=user,
            role='member',
        )
        team = self.create_team(organization=organization)

        result = access.from_user(user, organization)
        assert result.sso_is_valid
        assert not result.requires_sso
        assert result.scopes == member.get_scopes()
        assert not result.has_team_access(team)
        assert not result.has_team_membership(team)

    def test_member_no_teams_open_membership(self):
        user = self.create_user()
        organization = self.create_organization(
            owner=self.user,
            flags=Organization.flags.allow_joinleave,
        )
        member = self.create_member(
            organization=organization,
            user=user,
            role='member',
            teams=(),
        )
        team = self.create_team(organization=organization)

        result = access.from_user(user, organization)
        assert result.sso_is_valid
        assert not result.requires_sso
        assert result.scopes == member.get_scopes()
        assert result.has_team_access(team)
        assert not result.has_team_membership(team)

    def test_team_restricted_org_member_access(self):
        user = self.create_user()
        organization = self.create_organization()
        team = self.create_team(organization=organization)
        member = self.create_member(
            organization=organization,
            user=user,
            teams=[team],
        )

        result = access.from_user(user, organization)
        assert result.sso_is_valid
        assert not result.requires_sso
        assert result.scopes == member.get_scopes()
        assert result.has_team_access(team)
        assert result.has_team_membership(team)

    def test_unlinked_sso(self):
        user = self.create_user()
        organization = self.create_organization(owner=user)
        self.create_team(organization=organization)
        ap = AuthProvider.objects.create(
            organization=organization,
            provider='dummy',
        )
        AuthIdentity.objects.create(
            auth_provider=ap,
            user=user,
        )

        result = access.from_user(user, organization)
        assert not result.sso_is_valid
        assert result.requires_sso

    def test_unlinked_sso_with_no_owners(self):
        user = self.create_user()
        organization = self.create_organization(owner=user)
        self.create_team(organization=organization)
        AuthProvider.objects.create(
            organization=organization,
            provider='dummy',
        )

        result = access.from_user(user, organization)
        assert not result.sso_is_valid
        assert not result.requires_sso

    def test_sso_without_link_requirement(self):
        user = self.create_user()
        organization = self.create_organization(owner=user)
        self.create_team(organization=organization)
        AuthProvider.objects.create(
            organization=organization,
            provider='dummy',
            flags=AuthProvider.flags.allow_unlinked,
        )

        result = access.from_user(user, organization)
        assert result.sso_is_valid
        assert not result.requires_sso

    def test_anonymous_user(self):
        user = self.create_user()
        anon_user = AnonymousUser()
        organization = self.create_organization(owner=user)
        result = access.from_user(anon_user, organization)
        assert result is access.DEFAULT

    def test_inactive_user(self):
        user = self.create_user(is_active=False)
        organization = self.create_organization(owner=user)
        result = access.from_user(user, organization)
        assert result is access.DEFAULT


class FromSentryAppTest(TestCase):
    def setUp(self):
        super(FromSentryAppTest, self).setUp()

        # Partner's normal Sentry account.
        self.user = self.create_user('integration@example.com')

        self.org = self.create_organization()
        self.out_of_scope_org = self.create_organization()

        self.team = self.create_team(organization=self.org)
        self.out_of_scope_team = self.create_team(
            organization=self.out_of_scope_org
        )

        self.sentry_app = self.create_sentry_app(
            name='SlowDB',
            organization=self.org,
        )

        self.proxy_user = self.sentry_app.proxy_user

        self.install = SentryAppInstallationCreator.run(
            organization=self.org,
            slug=self.sentry_app.slug,
            user=self.user,
        )

    def test_has_access(self):
        result = access.from_sentry_app(self.proxy_user, self.org)
        assert result.is_active
        assert result.has_team_access(self.team)

    def test_no_access(self):
        result = access.from_sentry_app(self.proxy_user, self.out_of_scope_org)
        assert not result.has_team_access(self.out_of_scope_team)


class DefaultAccessTest(TestCase):
    def test_no_access(self):
        result = access.DEFAULT
        assert not result.is_active
        assert result.sso_is_valid
        assert not result.scopes
        assert not result.has_team_access(Mock())
        assert not result.has_team_membership(Mock())
