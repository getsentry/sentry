# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry.api.serializers import OrganizationMemberWithProjectsSerializer, serialize
from sentry.testutils import TestCase


class OrganizationMemberWithProjectsSerializerTest(TestCase):
    def setUp(self):
        self.owner_user = self.create_user("foo@localhost", username="foo")
        self.user_2 = self.create_user("bar@localhost", username="bar")

        self.org = self.create_organization(owner=self.owner_user)
        self.org.member_set.create(user=self.user_2)
        self.team = self.create_team(organization=self.org, members=[self.owner_user, self.user_2])
        self.team_2 = self.create_team(organization=self.org, members=[self.user_2])
        self.project = self.create_project(teams=[self.team])
        self.project_2 = self.create_project(teams=[self.team_2])

    def test_simple(self):
        projects_ids = [self.project.id, self.project_2.id]
        org_members = list(
            self.org.member_set.filter(user__in=[self.owner_user, self.user_2]).order_by(
                "user__email"
            )
        )
        result = serialize(
            org_members,
            self.user_2,
            OrganizationMemberWithProjectsSerializer(project_ids=projects_ids),
        )
        expected_projects = [[self.project.slug, self.project_2.slug], [self.project.slug]]
        expected_projects[0].sort()
        assert [r["projects"] for r in result] == expected_projects

        projects_ids = [self.project_2.id]
        result = serialize(
            org_members,
            self.user_2,
            OrganizationMemberWithProjectsSerializer(project_ids=projects_ids),
        )
        expected_projects = [[self.project_2.slug], []]
        assert [r["projects"] for r in result] == expected_projects
