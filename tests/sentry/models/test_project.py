# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry.models import OrganizationMember, OrganizationMemberTeam, Project
from sentry.testutils import TestCase
from sentry.utils import tenants


class ProjectTest(TestCase):
    def test_member_set_simple(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        team = self.create_team(organization=org)
        project = self.create_project(team=team)
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
        project = self.create_project(team=team)
        OrganizationMember.objects.get(
            user=user,
            organization=org,
        )

        assert list(project.member_set.all()) == []

    def test_query_bound_to_organization(self):
        # anonymous
        tenants.set_current_tenant(tenants.Tenant())

        user = self.create_user()
        org = self.create_organization(owner=user)
        team = self.create_team(organization=org)
        project = self.create_project(team=team)

        queryset = Project.objects.all()
        assert list(queryset) == []

        # member
        tenants.set_current_tenant(tenants.Tenant.from_user(user))

        queryset = Project.objects.all()
        assert list(queryset) == [project]

    def test_transfer_to(self):
        from_org = self.create_organization()
        from_team = self.create_team(organization=from_org)
        project = self.create_project(team=from_team)
        to_org = self.create_organization()
        to_team = self.create_team(organization=to_org)

        project.transfer_to(to_team)

        project = Project.objects.unrestricted_unsafe().get(id=project.id)

        assert project.team_id == to_team.id
        assert project.organization_id == to_org.id

    def test_transfer_to_slug_collision(self):
        from_org = self.create_organization()
        from_team = self.create_team(organization=from_org)
        project = self.create_project(team=from_team, slug='matt')
        to_org = self.create_organization()
        to_team = self.create_team(organization=to_org)
        # conflicting project slug
        self.create_project(team=to_team, slug='matt')

        assert Project.objects.unrestricted_unsafe().filter(organization=to_org).count() == 1

        project.transfer_to(to_team)

        project = Project.objects.unrestricted_unsafe().get(id=project.id)

        assert project.team_id == to_team.id
        assert project.organization_id == to_org.id
        assert project.slug != 'matt'
        assert Project.objects.unrestricted_unsafe().filter(organization=to_org).count() == 2
        assert Project.objects.unrestricted_unsafe().filter(organization=from_org).count() == 0
