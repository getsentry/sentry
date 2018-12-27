# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry.models import Environment, OrganizationMember, OrganizationMemberTeam, Project, Release, ReleaseProject, ReleaseProjectEnvironment, Rule
from sentry.testutils import TestCase


class ProjectTest(TestCase):
    def test_member_set_simple(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        team = self.create_team(organization=org)
        project = self.create_project(teams=[team])
        member = OrganizationMember.objects.get(
            user=user,
            organization=org,
        )
        OrganizationMemberTeam.objects.create(
            organizationmember=member,
            team=team,
        )

        assert list(project.member_set.all()) == [member]

    def test_inactive_global_member(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        team = self.create_team(organization=org)
        project = self.create_project(teams=[team])
        OrganizationMember.objects.get(
            user=user,
            organization=org,
        )

        assert list(project.member_set.all()) == []

    def test_transfer_to_team(self):
        from_org = self.create_organization()
        from_team = self.create_team(organization=from_org)
        to_org = self.create_organization()
        to_team = self.create_team(organization=to_org)

        project = self.create_project(teams=[from_team])

        rule = Rule.objects.create(
            project=project,
            environment_id=Environment.get_or_create(project, 'production').id,
            label='Golden Rule',
            data={},
        )

        project.transfer_to(team=to_team)

        project = Project.objects.get(id=project.id)

        assert project.teams.count() == 1
        assert project.teams.first() == to_team
        assert project.organization_id == to_org.id

        updated_rule = project.rule_set.get(label='Golden Rule')
        assert updated_rule.id == rule.id
        assert updated_rule.environment_id != rule.environment_id
        assert updated_rule.environment_id == Environment.get_or_create(project, 'production').id

    def test_transfer_to_team_slug_collision(self):
        from_org = self.create_organization()
        from_team = self.create_team(organization=from_org)
        project = self.create_project(teams=[from_team], slug='matt')
        to_org = self.create_organization()
        to_team = self.create_team(organization=to_org)
        # conflicting project slug
        self.create_project(teams=[to_team], slug='matt')

        assert Project.objects.filter(organization=to_org).count() == 1

        project.transfer_to(team=to_team)

        project = Project.objects.get(id=project.id)

        assert project.teams.count() == 1
        assert project.teams.first() == to_team
        assert project.organization_id == to_org.id
        assert project.slug != 'matt'
        assert Project.objects.filter(organization=to_org).count() == 2
        assert Project.objects.filter(organization=from_org).count() == 0

    def test_transfer_to_team_releases(self):
        from_org = self.create_organization()
        from_team = self.create_team(organization=from_org)
        to_org = self.create_organization()
        to_team = self.create_team(organization=to_org)

        project = self.create_project(teams=[from_team])

        environment = Environment.get_or_create(project, 'production')
        release = Release.get_or_create(project=project, version='1.0')

        ReleaseProjectEnvironment.objects.create(
            project=project,
            release=release,
            environment=environment,
        )

        assert ReleaseProjectEnvironment.objects.filter(
            project=project,
            release=release,
            environment=environment,
        ).exists()
        assert ReleaseProject.objects.filter(
            project=project,
            release=release,
        ).exists()

        project.transfer_to(team=to_team)

        project = Project.objects.get(id=project.id)

        assert project.teams.count() == 1
        assert project.teams.first() == to_team
        assert project.organization_id == to_org.id

        assert not ReleaseProjectEnvironment.objects.filter(
            project=project,
            release=release,
            environment=environment,
        ).exists()
        assert not ReleaseProject.objects.filter(
            project=project,
            release=release,
        ).exists()

    def test_transfer_to_organization(self):
        from_org = self.create_organization()
        team = self.create_team(organization=from_org)
        to_org = self.create_organization()

        project = self.create_project(teams=[team])

        rule = Rule.objects.create(
            project=project,
            environment_id=Environment.get_or_create(project, 'production').id,
            label='Golden Rule',
            data={},
        )

        project.transfer_to(organization=to_org)

        project = Project.objects.get(id=project.id)

        assert project.teams.count() == 0
        assert project.organization_id == to_org.id

        updated_rule = project.rule_set.get(label='Golden Rule')
        assert updated_rule.id == rule.id
        assert updated_rule.environment_id != rule.environment_id
        assert updated_rule.environment_id == Environment.get_or_create(project, 'production').id

    def test_transfer_to_organization_slug_collision(self):
        from_org = self.create_organization()
        team = self.create_team(organization=from_org)
        project = self.create_project(teams=[team], slug='matt')
        to_org = self.create_organization()
        # conflicting project slug
        self.create_project(slug='matt', organization=to_org)

        assert Project.objects.filter(organization=to_org).count() == 1

        project.transfer_to(organization=to_org)

        project = Project.objects.get(id=project.id)

        assert project.teams.count() == 0
        assert project.organization_id == to_org.id
        assert project.slug != 'matt'
        assert Project.objects.filter(organization=to_org).count() == 2
        assert Project.objects.filter(organization=from_org).count() == 0

    def test_transfer_to_organization_releases(self):
        from_org = self.create_organization()
        team = self.create_team(organization=from_org)
        to_org = self.create_organization()

        project = self.create_project(teams=[team])

        environment = Environment.get_or_create(project, 'production')
        release = Release.get_or_create(project=project, version='1.0')

        ReleaseProjectEnvironment.objects.create(
            project=project,
            release=release,
            environment=environment,
        )

        assert ReleaseProjectEnvironment.objects.filter(
            project=project,
            release=release,
            environment=environment,
        ).exists()
        assert ReleaseProject.objects.filter(
            project=project,
            release=release,
        ).exists()

        project.transfer_to(organization=to_org)

        project = Project.objects.get(id=project.id)

        assert project.teams.count() == 0
        assert project.organization_id == to_org.id

        assert not ReleaseProjectEnvironment.objects.filter(
            project=project,
            release=release,
            environment=environment,
        ).exists()
        assert not ReleaseProject.objects.filter(
            project=project,
            release=release,
        ).exists()
