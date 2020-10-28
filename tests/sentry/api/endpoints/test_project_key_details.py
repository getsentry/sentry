from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import ProjectKey, ProjectKeyStatus
from sentry.testutils import APITestCase


class UpdateProjectKeyTest(APITestCase):
    def test_simple(self):
        project = self.create_project()
        key = ProjectKey.objects.get_or_create(project=project)[0]
        self.login_as(user=self.user)
        url = reverse(
            "sentry-api-0-project-key-details",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "key_id": key.public_key,
            },
        )
        response = self.client.put(url, {"name": "hello world"})
        assert response.status_code == 200
        key = ProjectKey.objects.get(id=key.id)
        assert key.label == "hello world"

    def test_no_rate_limit(self):
        project = self.create_project()
        key = ProjectKey.objects.create(project=project, rate_limit_window=60, rate_limit_count=1)
        self.login_as(user=self.user)
        url = reverse(
            "sentry-api-0-project-key-details",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "key_id": key.public_key,
            },
        )
        response = self.client.put(url, {"rateLimit": None})
        assert response.status_code == 200, response.content
        key = ProjectKey.objects.get(id=key.id)
        assert key.rate_limit_count is None
        assert key.rate_limit_window is None

    def test_unset_rate_limit(self):
        project = self.create_project()
        key = ProjectKey.objects.create(project=project, rate_limit_window=60, rate_limit_count=1)
        self.login_as(user=self.user)
        url = reverse(
            "sentry-api-0-project-key-details",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "key_id": key.public_key,
            },
        )
        response = self.client.put(url)
        assert response.status_code == 200
        key = ProjectKey.objects.get(id=key.id)
        assert key.rate_limit_count == 1
        assert key.rate_limit_window == 60

    def test_remove_rate_limit(self):
        project = self.create_project()
        key = ProjectKey.objects.create(project=project, rate_limit_window=60, rate_limit_count=1)
        self.login_as(user=self.user)
        url = reverse(
            "sentry-api-0-project-key-details",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "key_id": key.public_key,
            },
        )
        response = self.client.put(url, {"rateLimit": {"count": "", "window": 300}})
        assert response.status_code == 200
        key = ProjectKey.objects.get(id=key.id)
        assert key.rate_limit_count is None
        assert key.rate_limit_window is None

    def test_simple_rate_limit(self):
        project = self.create_project()
        key = ProjectKey.objects.create(
            project=project, rate_limit_window=None, rate_limit_count=None
        )
        self.login_as(user=self.user)
        url = reverse(
            "sentry-api-0-project-key-details",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "key_id": key.public_key,
            },
        )
        response = self.client.put(url, {"rateLimit": {"count": 1, "window": 60}})
        assert response.status_code == 200
        key = ProjectKey.objects.get(id=key.id)
        assert key.rate_limit_count == 1
        assert key.rate_limit_window == 60

    def test_deactivate(self):
        project = self.create_project()
        key = ProjectKey.objects.get_or_create(project=project)[0]
        self.login_as(user=self.user)
        url = reverse(
            "sentry-api-0-project-key-details",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "key_id": key.public_key,
            },
        )
        response = self.client.put(url, {"isActive": False, "name": "hello world"})
        assert response.status_code == 200
        key = ProjectKey.objects.get(id=key.id)
        assert key.label == "hello world"
        assert key.status == ProjectKeyStatus.INACTIVE


class DeleteProjectKeyTest(APITestCase):
    def test_simple(self):
        project = self.create_project()
        self.login_as(user=self.user)
        key = ProjectKey.objects.get_or_create(project=project)[0]
        url = reverse(
            "sentry-api-0-project-key-details",
            kwargs={
                "organization_slug": project.organization.slug,
                "project_slug": project.slug,
                "key_id": key.public_key,
            },
        )
        resp = self.client.delete(url)
        assert resp.status_code == 204, resp.content
        assert not ProjectKey.objects.filter(id=key.id).exists()
