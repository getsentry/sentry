# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry.models import (
    Environment, OrganizationMember, OrganizationMemberTeam,
    Project, EnvironmentProject, ProjectOption, ProjectOwnership, ProjectTeam,
    Release, ReleaseProject, ReleaseProjectEnvironment, Rule
)
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


class ProjectCopyTest(TestCase):
    def setUp(self):
        self.project = Project.objects.create(
            slug='project',
            organization_id=self.organization,
        )
        self.team = self.create_team()
        self.add_project_environment(self.project, 'environment-1', True)
        self.add_project_environment(self.project, 'environment-2')

        self.add_project_option(self.project, 'project-option-1', {'stuff': 'stuff'})
        self.add_project_option(self.project, 'project-option-2', {})

        ProjectTeam.objects.create(
            project_id=self.project.id,
            team_id=self.team,
        )
        ProjectOwnership.objects.create(
            project_id=self.project.id,
            raw='some text',
            schema={'json': 'json'},
            fallthrough=True,
            is_active=True,
        )

        self.add_project_rule(self.project, 'rule-1')
        self.add_project_rule(self.project, 'rule-2')

    def add_project_option(self, project, key, value=None):
        ProjectOption.objects.create(
            project_id=project.id,
            key=key,
            value=value
        )

    def add_project_environment(self, project, env_name, is_hidden=False):
        EnvironmentProject.objects.create(
            project_id=project.id,
            environment=Environment.objects.create(
                organization_id=project.organization_id,
                name=env_name,
            ),
            is_hidden=is_hidden,
        )

    def add_project_rule(self, project, label, env=None, data=None, status=0):
        Rule.objects.create(
            project_id=project,
            environment=env,
            label=label,
            data=data,
            status=status,
        )

    def assert_project_environments(self, project, expected):
        # expected = [(environement_name, is_hidden)]
        project_envs = EnvironmentProject.objects.filter(
            project_id=project.id
        ).select_related('environment')
        assert len(project_envs) == len(expected)
        for project_env, (name, is_hidden) in zip(project_envs, expected):
            assert project_env.environment.name == name
            assert project_env.environment.is_hidden == is_hidden

    def assert_project_options(self, project, expected):
        # expected = [(key, value)]
        project_options = ProjectOption.objects.filter(
            project_id=project.id
        )
        assert len(project_options) == len(expected)
        for project_option, (key, value) in zip(project_options, expected):
            assert project_option.key == key
            assert project_option.value == value

    def assert_project_teams(self, project, expected):
        project_teams = ProjectTeam.objects.filter(
            project_id=project.id,
            team_id__in=expected,
        )
        assert len(project_teams) == len(expected)

    def assert_project_ownership(self, project, expected):
        ownership = ProjectOwnership.objects.get(
            project_id=project.id
        )
        assert ownership.raw == expected['raw']
        assert ownership.schema == expected['schema']
        assert ownership.fallthrough == expected['fallthrough']
        assert ownership.is_active == expected['is_active']

    def assert_project_rule(self, project, expected):
        project_rules = Rule.objects.filter(
            project_id=project.id
        )
        for rule, label in zip(project_rules, expected):
            assert rule.label == label

    def copy_project_settings(self):
        project = self.create_project()

        project.copy_settings_from(self.project)

        # assert the settings were copied
        expected_env = [('environment-1', True), ('environment-2', False)]
        self.assert_project_environments(project, expected_env)
        expected_option = [('project-option-1', {'stuff': 'stuff'}), ('project-option-2', {})]
        self.assert_project_options(project, expected_option)
        self.assert_project_teams(project, [self.team.id])
        self.assert_project_ownership(project, {
            'raw': 'some text', 'schema': {'json': 'json'},
            'fallthrough': True, 'is_active': True
        })
        self.assert_project_rules(project, ['rule-1', 'rule-2'])

        # assert the settings of the copied from were not changed
        self.assert_project_environments(
            self.project, [
                ('environment-1', True), ('environment-2', False)])
        expected_option = [('project-option-1', {'stuff': 'stuff'}), ('project-option-2', {})]
        self.assert_project_options(self.project, expected_option)
        self.assert_project_teams(self.project, [self.team.id])
        self.assert_project_ownership(self.project, {
            'raw': 'some text', 'schema': {'json': 'json'},
            'fallthrough': True, 'is_active': True
        })
        self.assert_project_rules(self.project, ['rule-1', 'rule-2'])
