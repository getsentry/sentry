from __future__ import annotations

import orjson

from sentry.models.projectredirect import ProjectRedirect
from sentry.testutils.cases import APITestCase


def first_symbol_source_id(sources_json):
    sources = orjson.loads(sources_json)
    return sources[0]["id"]


class ProjectOverviewTest(APITestCase):
    endpoint = "sentry-api-0-project-overview"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    def test_simple(self):
        response = self.get_success_response(self.project.organization.slug, self.project.slug)
        assert response.data["id"] == str(self.project.id)

    def test_superuser_simple(self):
        superuser = self.create_user(is_superuser=True)
        self.login_as(user=superuser, superuser=True)

        response = self.get_success_response(self.project.organization.slug, self.project.slug)
        assert response.data["id"] == str(self.project.id)

    def test_staff_simple(self):
        staff_user = self.create_user(is_staff=True)
        self.login_as(user=staff_user, staff=True)

        response = self.get_success_response(self.project.organization.slug, self.project.slug)
        assert response.data["id"] == str(self.project.id)

    def test_non_org_rename_403(self):
        org = self.create_organization()
        team = self.create_team(organization=org, name="foo", slug="foo")
        user = self.create_user(is_superuser=False)
        self.create_member(user=user, organization=org, role="member", teams=[team])

        other_org = self.create_organization()
        other_project = self.create_project(organization=other_org)
        ProjectRedirect.record(other_project, "old_slug")
        self.login_as(user=user)

        self.get_error_response(other_org.slug, "old_slug", status_code=403)
