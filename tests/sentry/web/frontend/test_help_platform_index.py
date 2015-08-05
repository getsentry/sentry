from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import OrganizationMember, OrganizationMemberTeam
from sentry.testutils import TestCase


class HelpPlatformIndexTest(TestCase):
    def test_simple(self):
        path = reverse('sentry-help-platform-list')

        resp = self.client.get(path)
        assert resp.status_code == 200

    def test_logged_in(self):
        org = self.create_organization(owner=self.user)
        team1 = self.create_team(name='foo', organization=org)
        project1 = self.create_project(name='foo', team=team1)
        project2 = self.create_project(name='bar', team=team1)
        team2 = self.create_team(name='bar', organization=org)
        project3 = self.create_project(name='baz', team=team2)

        member = OrganizationMember.objects.get(
            organization=org,
            user=self.user,
        )
        OrganizationMemberTeam.objects.create(
            organizationmember=member,
            team=team2,
            is_active=False,
        )

        path = reverse('sentry-help-platform-list')

        self.login_as(self.user)
        resp = self.client.get(path)
        assert resp.status_code == 200
        assert len(resp.context['org_results']) == 1
        org_results = resp.context['org_results'][0]
        assert org_results[0] == org
        assert len(org_results[1]) == 1
        team_results = org_results[1][0]
        assert team_results[0] == team1
        assert len(team_results[1]) == 2
        assert project1 in team_results[1]
        assert project2 in team_results[1]

    # https://github.com/getsentry/sentry/issues/1673
    def test_correct_project_list_as_global_active(self):
        org = self.create_organization(owner=self.user)
        team1 = self.create_team(name='foo', organization=org)
        project1 = self.create_project(name='foo', team=team1)
        project2 = self.create_project(name='bar', team=team1)
        team2 = self.create_team(name='bar', organization=org)
        project3 = self.create_project(name='baz', team=team2)

        # Our other user
        other_user = self.create_user('other@localhost', is_superuser=True)

        member = OrganizationMember.objects.get(
            organization=org,
            user=self.user,
        )
        OrganizationMemberTeam.objects.create(
            organizationmember=member,
            team=team2,
            is_active=False,
        )

        other_member = OrganizationMember.objects.create(
            organization=org,
            user=other_user,
        )
        OrganizationMemberTeam.objects.create(
            organizationmember=other_member,
            team=team1,
            is_active=False,
        )

        path = reverse('sentry-help-platform-list')

        self.login_as(self.user)
        resp = self.client.get(path)
        assert resp.status_code == 200
        assert len(resp.context['org_results']) == 1
        org_results = resp.context['org_results'][0]
        assert org_results[0] == org
        assert len(org_results[1]) == 1
        team_results = org_results[1][0]
        assert team_results[0] == team1
        assert len(team_results[1]) == 2
        assert project1 in team_results[1]
        assert project2 in team_results[1]

    def test_correct_project_list_not_global_active(self):
        org = self.create_organization(owner=self.user)
        team1 = self.create_team(name='foo', organization=org)
        project1 = self.create_project(name='foo', team=team1)
        project2 = self.create_project(name='bar', team=team1)
        team2 = self.create_team(name='bar', organization=org)
        project3 = self.create_project(name='baz', team=team2)

        # Our other user
        other_user = self.create_user('other@localhost', is_superuser=False)

        member = OrganizationMember.objects.get(
            organization=org,
            user=self.user,
        )
        OrganizationMemberTeam.objects.create(
            organizationmember=member,
            team=team2,
            is_active=False,
        )

        other_member = OrganizationMember.objects.create(
            organization=org,
            user=other_user,
        )
        OrganizationMemberTeam.objects.create(
            organizationmember=other_member,
            team=team1,
            is_active=False,
        )
        OrganizationMemberTeam.objects.create(
            organizationmember=other_member,
            team=team2,
            is_active=True,
        )

        path = reverse('sentry-help-platform-list')

        self.login_as(other_user)
        resp = self.client.get(path)
        assert resp.status_code == 200
        assert len(resp.context['org_results']) == 1
        org_results = resp.context['org_results'][0]
        assert org_results[0] == org
        assert len(org_results[1]) == 1
        team_results = org_results[1][0]
        assert team_results[0] == team2
        assert len(team_results[1]) == 1
        assert project3 in team_results[1]
