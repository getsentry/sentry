from typing import Any
from unittest.mock import patch

from django.urls import reverse

from sentry.models.options.project_option import ProjectOption
from sentry.testutils.cases import APITestCase
from sentry.types.region import get_local_locality


class ReleaseTokenGetTest(APITestCase):
    def test_simple(self) -> None:
        project = self.create_project(name="foo")
        token = "abcdefghijklmnop"

        ProjectOption.objects.set_value(project, "sentry:release-token", token)

        url = reverse(
            "sentry-api-0-project-releases-token",
            kwargs={
                "organization_id_or_slug": project.organization.slug,
                "project_id_or_slug": project.slug,
            },
        )

        self.login_as(user=self.user)

        response = self.client.get(url)

        assert response.status_code == 200, response.content
        assert response.data["token"] == "abcdefghijklmnop"

    def test_generates_token(self) -> None:
        project = self.create_project(name="foo")

        url = reverse(
            "sentry-api-0-project-releases-token",
            kwargs={
                "organization_id_or_slug": project.organization.slug,
                "project_id_or_slug": project.slug,
            },
        )

        self.login_as(user=self.user)

        response = self.client.get(url)

        assert response.status_code == 200, response.content
        assert response.data["token"] is not None
        assert ProjectOption.objects.get_value(project, "sentry:release-token") is not None

    def test_generate_region_webhookurl(self) -> None:
        project = self.create_project(name="foo")

        url = reverse(
            "sentry-api-0-project-releases-token",
            kwargs={
                "organization_id_or_slug": project.organization.slug,
                "project_id_or_slug": project.slug,
            },
        )

        self.login_as(user=self.user)

        response = self.client.get(url)
        assert response.status_code == 200, response.content

        assert response.data["webhookUrl"].startswith(get_local_locality().to_url("/"))

    def test_regenerates_token(self) -> None:
        project = self.create_project(name="foo")
        token = "abcdefghijklmnop"

        ProjectOption.objects.set_value(project, "sentry:release-token", token)

        url = reverse(
            "sentry-api-0-project-releases-token",
            kwargs={
                "organization_id_or_slug": project.organization.slug,
                "project_id_or_slug": project.slug,
            },
        )

        self.login_as(user=self.user)

        response = self.client.post(url, {"project": project.slug})

        assert response.status_code == 200, response.content
        assert response.data["token"] is not None
        assert response.data["token"] != "abcdefghijklmnop"


class ReleaseTokenImpersonationTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.impersonator = self.create_user(is_superuser=True)

    def _simulate_impersonation(self) -> Any:
        from sentry.api.base import Endpoint

        original = Endpoint.initialize_request

        def patched(endpoint_self: Any, request: Any, *args: Any, **kwargs: Any) -> Any:
            drf_request = original(endpoint_self, request, *args, **kwargs)
            drf_request.actual_user = self.impersonator  # type: ignore[attr-defined]
            return drf_request

        return patch.object(Endpoint, "initialize_request", patched)

    def test_impersonated_post_blocked(self) -> None:
        project = self.create_project(name="foo")
        token = "abcdefghijklmnop"
        ProjectOption.objects.set_value(project, "sentry:release-token", token)

        url = reverse(
            "sentry-api-0-project-releases-token",
            kwargs={
                "organization_id_or_slug": project.organization.slug,
                "project_id_or_slug": project.slug,
            },
        )
        self.login_as(user=self.user)
        with self._simulate_impersonation():
            response = self.client.post(url, {"project": project.slug})
        assert response.status_code == 403
        assert ProjectOption.objects.get_value(project, "sentry:release-token") == token

    def test_impersonated_get_allowed_when_token_exists(self) -> None:
        project = self.create_project(name="foo")
        ProjectOption.objects.set_value(project, "sentry:release-token", "abcdefghijklmnop")

        url = reverse(
            "sentry-api-0-project-releases-token",
            kwargs={
                "organization_id_or_slug": project.organization.slug,
                "project_id_or_slug": project.slug,
            },
        )
        self.login_as(user=self.user)
        with self._simulate_impersonation():
            response = self.client.get(url)
        assert response.status_code == 200

    def test_impersonated_get_blocked_when_no_token_exists(self) -> None:
        project = self.create_project(name="foo")

        url = reverse(
            "sentry-api-0-project-releases-token",
            kwargs={
                "organization_id_or_slug": project.organization.slug,
                "project_id_or_slug": project.slug,
            },
        )
        self.login_as(user=self.user)
        with self._simulate_impersonation():
            response = self.client.get(url)
        assert response.status_code == 404
        assert ProjectOption.objects.get_value(project, "sentry:release-token") is None
