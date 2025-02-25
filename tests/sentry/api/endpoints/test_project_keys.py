from django.urls import reverse

from sentry.models.projectkey import ProjectKey, UseCase
from sentry.testutils.cases import APITestCase


class ListProjectKeysTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.user = self.create_user(is_superuser=False)

    def test_simple(self):
        project = self.create_project()
        key = ProjectKey.objects.get_or_create(project=project)[0]
        self.login_as(user=self.user)
        url = reverse(
            "sentry-api-0-project-keys",
            kwargs={
                "organization_id_or_slug": project.organization.slug,
                "project_id_or_slug": project.slug,
            },
        )
        response = self.client.get(url)
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["public"] == key.public_key

    def test_use_case(self):
        """Regular user can access user DSNs but not internal DSNs"""
        project = self.create_project()
        user_key = ProjectKey.objects.get_or_create(project=project)[0]
        internal_key = ProjectKey.objects.get_or_create(
            use_case=UseCase.PROFILING.value, project=project
        )[0]
        self.login_as(user=self.user)
        url = reverse(
            "sentry-api-0-project-keys",
            kwargs={
                "organization_id_or_slug": project.organization.slug,
                "project_id_or_slug": project.slug,
            },
        )
        response = self.client.get(url)
        assert response.status_code == 200
        assert len(response.data) == 1
        response_data = response.data[0]
        assert "useCase" not in response_data
        assert response_data["public"] == user_key.public_key
        assert response_data["public"] != internal_key.public_key

    def test_use_case_superuser(self):
        """Superuser can access both user DSNs and internal DSNs"""
        project = self.create_project()
        user_key = ProjectKey.objects.get_or_create(project=project)[0]
        internal_key = ProjectKey.objects.get_or_create(
            use_case=UseCase.PROFILING.value, project=project
        )[0]
        superuser = self.create_user(is_superuser=True)
        self.login_as(superuser, superuser=True)
        url = reverse(
            "sentry-api-0-project-keys",
            kwargs={
                "organization_id_or_slug": project.organization.slug,
                "project_id_or_slug": project.slug,
            },
        )
        response = self.client.get(url)
        assert response.status_code == 200
        assert len(response.data) == 2

        response.data.sort(key=lambda k: k["useCase"])

        response_data = response.data[0]
        assert response_data["useCase"] == "profiling"
        assert response_data["public"] == internal_key.public_key

        response_data = response.data[1]
        assert response_data["useCase"] == "user"
        assert response_data["public"] == user_key.public_key


class CreateProjectKeyTest(APITestCase):
    def test_simple(self):
        project = self.create_project()
        self.login_as(user=self.user)
        url = reverse(
            "sentry-api-0-project-keys",
            kwargs={
                "organization_id_or_slug": project.organization.slug,
                "project_id_or_slug": project.slug,
            },
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
            kwargs={
                "organization_id_or_slug": project.organization.slug,
                "project_id_or_slug": project.slug,
            },
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
            kwargs={
                "organization_id_or_slug": project.organization.slug,
                "project_id_or_slug": project.slug,
            },
        )
        resp = self.client.post(url, data={"public": "a" * 32, "secret": "b" * 32})
        assert resp.status_code == 201, resp.content
        key = ProjectKey.objects.get(public_key=resp.data["public"])
        assert key.public_key == resp.data["public"] == "a" * 32
        assert key.secret_key == resp.data["secret"] == "b" * 32

    def test_cannot_create_internal(self):
        """POST request ignores use case field"""
        project = self.create_project()
        self.login_as(user=self.user)
        url = reverse(
            "sentry-api-0-project-keys",
            kwargs={
                "organization_id_or_slug": project.organization.slug,
                "project_id_or_slug": project.slug,
            },
        )
        resp = self.client.post(
            url, data={"public": "a" * 32, "secret": "b" * 32, "useCase": "profiling"}
        )
        assert resp.status_code == 201, resp.content
        key = ProjectKey.objects.get(public_key=resp.data["public"])
        assert key.use_case == "user"

    def test_superuser_can_create_internal(self):
        project = self.create_project()
        self.user = self.create_user(is_superuser=True)
        self.login_as(user=self.user, superuser=True)
        url = reverse(
            "sentry-api-0-project-keys",
            kwargs={
                "organization_id_or_slug": project.organization.slug,
                "project_id_or_slug": project.slug,
            },
        )
        resp = self.client.post(
            url, data={"public": "a" * 32, "secret": "b" * 32, "useCase": "demo"}
        )
        assert resp.status_code == 201, resp.content
        key = ProjectKey.objects.get(public_key=resp.data["public"])
        assert key.use_case == "demo"
