from __future__ import absolute_import

from sentry.models import (
    Commit, File, OrganizationMember, OrganizationMemberTeam, Project, Release, ReleaseCommit,
    ReleaseEnvironment, ReleaseFile, Team
)
from sentry.testutils import TestCase


class OrganizationTest(TestCase):
    def test_merge_to(self):
        from_owner = self.create_user('foo@example.com')
        from_org = self.create_organization(owner=from_owner)
        from_team = self.create_team(organization=from_org)
        from_team_two = self.create_team(organization=from_org, slug='bizzy')
        from_project_two = self.create_project(
            organization=from_org,
            team=from_team_two,
            slug='bizzy',
        )
        from_release = Release.objects.create(version='abcabcabc', organization=from_org)
        from_release_file = ReleaseFile.objects.create(
            release=from_release,
            organization=from_org,
            file=File.objects.create(name='foo.py', type='.py'),
            ident='abcdefg',
            name='foo.py'
        )
        from_commit = Commit.objects.create(
            organization_id=from_org.id, repository_id=1, key='abcdefg'
        )
        from_release_commit = ReleaseCommit.objects.create(
            release=from_release,
            commit=from_commit,
            order=1,
            organization_id=from_org.id,
        )
        from_release_environment = ReleaseEnvironment.objects.create(
            release_id=from_release.id,
            project_id=from_project_two.id,
            organization_id=from_org.id,
            environment_id=1
        )
        from_user = self.create_user('baz@example.com')
        other_user = self.create_user('bizbaz@example.com')
        self.create_member(organization=from_org, user=from_user)
        other_member = self.create_member(organization=from_org, user=other_user)

        OrganizationMemberTeam.objects.create(
            organizationmember=other_member,
            team=from_team,
        )

        to_owner = self.create_user('bar@example.com')
        to_org = self.create_organization(owner=to_owner)
        to_team = self.create_team(organization=to_org)
        to_team_two = self.create_team(organization=to_org, slug='bizzy')
        to_project_two = self.create_project(
            organization=to_org,
            team=to_team_two,
            slug='bizzy',
        )
        to_member = self.create_member(organization=to_org, user=other_user)
        to_release = Release.objects.create(version='abcabcabc', organization=to_org)

        OrganizationMemberTeam.objects.create(
            organizationmember=to_member,
            team=to_team,
        )

        from_org.merge_to(to_org)

        assert OrganizationMember.objects.filter(
            organization=to_org,
            user=from_owner,
            role='owner',
        ).exists()

        team = Team.objects.get(id=from_team.id)
        assert team.organization == to_org

        member = OrganizationMember.objects.get(
            user=other_user,
            organization=to_org,
        )
        assert OrganizationMemberTeam.objects.filter(
            organizationmember=member,
            team=to_team,
        ).exists()
        assert OrganizationMemberTeam.objects.filter(
            organizationmember=member,
            team=from_team,
        ).exists()

        from_team_two = Team.objects.get(id=from_team_two.id)
        assert from_team_two.slug != 'bizzy'
        assert from_team_two.organization == to_org

        from_project_two = Project.objects.get(id=from_project_two.id)
        assert from_project_two.slug != 'bizzy'
        assert from_project_two.organization == to_org
        assert from_project_two.team == from_team_two

        to_team_two = Team.objects.get(id=to_team_two.id)
        assert to_team_two.slug == 'bizzy'
        assert to_team_two.organization == to_org

        to_project_two = Project.objects.get(id=to_project_two.id)
        assert to_project_two.slug == 'bizzy'
        assert to_project_two.organization == to_org
        assert to_project_two.team == to_team_two

        assert not Release.objects.filter(id=from_release.id).exists()
        assert ReleaseFile.objects.get(id=from_release_file.id).organization == to_org
        assert ReleaseFile.objects.get(id=from_release_file.id).release == to_release
        assert Commit.objects.get(id=from_commit.id).organization_id == to_org.id
        assert ReleaseCommit.objects.get(id=from_release_commit.id).organization_id == to_org.id
        assert ReleaseCommit.objects.get(id=from_release_commit.id).release == to_release
        assert ReleaseEnvironment.objects.get(
            id=from_release_environment.id
        ).organization_id == to_org.id
        assert ReleaseEnvironment.objects.get(
            id=from_release_environment.id
        ).release_id == to_release.id

    def test_get_default_owner(self):
        user = self.create_user('foo@example.com')
        org = self.create_organization(owner=user)
        assert org.get_default_owner() == user
