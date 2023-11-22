from django.urls import reverse

from sentry.models.projectkey import ProjectKey
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class ListProjectKeysTest(APITestCase):
    def test_simple(self):
        project = self.create_project()
        key = ProjectKey.objects.get_or_create(project=project)[0]
        self.login_as(user=self.user)
        url = reverse(
            "sentry-api-0-project-keys",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )
        response = self.client.get(url)
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["public"] == key.public_key


@region_silo_test
class CreateProjectKeyTest(APITestCase):
    def test_simple(self):
        project = self.create_project()
        self.login_as(user=self.user)
        url = reverse(
            "sentry-api-0-project-keys",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )
        resp = self.client.post(
            url, data={"name": "hello world", "rateLimit": {"count": 10, "window": 60}}
        )
        assert resp.status_code == 201, resp.content
        key = ProjectKey.objects.get(public_key=resp.data["public"])
        assert key.label == "hello world"
        assert key.rate_limit_count == 10
        assert key.rate_limit_window == 60
        assert "dynamicSdkLoaderOptions" in key.data
        assert key.data["dynamicSdkLoaderOptions"] == {
            "hasPerformance": True,
            "hasReplay": True,
        }

    def test_minimal_args(self):
        project = self.create_project()
        self.login_as(user=self.user)
        url = reverse(
            "sentry-api-0-project-keys",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )
        resp = self.client.post(url)
        assert resp.status_code == 201, resp.content
        key = ProjectKey.objects.get(public_key=resp.data["public"])
        assert key.label
        assert "dynamicSdkLoaderOptions" in key.data
        assert key.data["dynamicSdkLoaderOptions"] == {
            "hasPerformance": True,
            "hasReplay": True,
        }

    def test_keys(self):
        project = self.create_project()
        self.login_as(user=self.user)
        url = reverse(
            "sentry-api-0-project-keys",
            kwargs={"organization_slug": project.organization.slug, "project_slug": project.slug},
        )
        resp = self.client.post(url, data={"public": "a" * 32, "secret": "b" * 32})
        assert resp.status_code == 201, resp.content
        key = ProjectKey.objects.get(public_key=resp.data["public"])
        assert key.public_key == resp.data["public"] == "a" * 32
        assert key.secret_key == resp.data["secret"] == "b" * 32
