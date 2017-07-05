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
