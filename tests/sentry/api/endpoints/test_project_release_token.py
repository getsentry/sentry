# -*- coding: utf-8 -*-

from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import ProjectOption
from sentry.testutils import APITestCase


class ReleaseTokenGetTest(APITestCase):
    def test_simple(self):
        project = self.create_project(name="foo")
        token = "abcdefghijklmnop"

        ProjectOption.objects.set_value(project, "sentry:release-token", token)

        url = reverse(
            "sentry-api-0-project-releases-token",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )

        self.login_as(user=self.user)

        response = self.client.get(url)

        assert response.status_code == 200, response.content
        assert response.data["token"] == "abcdefghijklmnop"

    def test_generates_token(self):
        project = self.create_project(name="foo")

        url = reverse(
            "sentry-api-0-project-releases-token",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )

        self.login_as(user=self.user)

        response = self.client.get(url)

        assert response.status_code == 200, response.content
        assert response.data["token"] is not None
        assert ProjectOption.objects.get_value(project, "sentry:release-token") is not None

    def test_regenerates_token(self):
        project = self.create_project(name="foo")
        token = "abcdefghijklmnop"

        ProjectOption.objects.set_value(project, "sentry:release-token", token)

        url = reverse(
            "sentry-api-0-project-releases-token",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )

        self.login_as(user=self.user)

        response = self.client.post(url, {"project": project.slug})

        assert response.status_code == 200, response.content
        assert response.data["token"] is not None
        assert response.data["token"] != "abcdefghijklmnop"
