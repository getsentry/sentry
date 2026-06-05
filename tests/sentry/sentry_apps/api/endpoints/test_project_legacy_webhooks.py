from sentry.models.options.project_option import ProjectOption
from sentry.testutils.cases import APITestCase


class ProjectLegacyWebhooksEndpointTest(APITestCase):
    endpoint = "sentry-api-0-project-legacy-webhooks"
    method = "get"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)

    def test_get_returns_configured_urls_and_enabled(self) -> None:
        ProjectOption.objects.set_value(self.project, "webhooks:urls", "http://a.com\nhttp://b.com")
        ProjectOption.objects.set_value(self.project, "webhooks:enabled", True)

        response = self.get_success_response(
            self.organization.slug, self.project.slug, status_code=200
        )

        assert response.data["urls"] == ["http://a.com", "http://b.com"]
        assert response.data["enabled"] is True

    def test_get_returns_empty_when_no_urls(self) -> None:
        response = self.get_success_response(
            self.organization.slug, self.project.slug, status_code=200
        )

        assert response.data["urls"] == []
        assert response.data["enabled"] is False

    def test_post_stores_urls_and_enabled(self) -> None:
        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            method="post",
            urls=["http://example.com/hook", "https://other.com/hook"],
            enabled=True,
            status_code=200,
        )

        assert response.data["urls"] == ["http://example.com/hook", "https://other.com/hook"]
        assert response.data["enabled"] is True
        stored = ProjectOption.objects.get_value(self.project, "webhooks:urls", default="")
        assert stored == "http://example.com/hook\nhttps://other.com/hook"
        assert ProjectOption.objects.get_value(self.project, "webhooks:enabled") is True

    def test_post_can_disable_webhooks(self) -> None:
        ProjectOption.objects.set_value(self.project, "webhooks:enabled", True)

        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            method="post",
            urls=["http://example.com/hook"],
            enabled=False,
            status_code=200,
        )

        assert response.data["enabled"] is False
        assert ProjectOption.objects.get_value(self.project, "webhooks:enabled") is False

    def test_post_only_enabled_preserves_urls(self) -> None:
        ProjectOption.objects.set_value(self.project, "webhooks:urls", "http://example.com/hook")
        ProjectOption.objects.set_value(self.project, "webhooks:enabled", False)

        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            method="post",
            enabled=True,
            status_code=200,
        )

        assert response.data["enabled"] is True
        assert response.data["urls"] == ["http://example.com/hook"]

    def test_post_only_urls_preserves_enabled(self) -> None:
        ProjectOption.objects.set_value(self.project, "webhooks:enabled", True)

        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            method="post",
            urls=["http://new.com/hook"],
            status_code=200,
        )

        assert response.data["urls"] == ["http://new.com/hook"]
        assert response.data["enabled"] is True

    def test_post_rejects_invalid_urls(self) -> None:
        response = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            method="post",
            urls=["ftp://bad.com"],
            enabled=True,
            status_code=400,
        )

        assert "urls" in response.data

    def test_post_rejects_non_list(self) -> None:
        response = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            method="post",
            urls="http://example.com",
            enabled=True,
            status_code=400,
        )

        assert "urls" in response.data

    def test_delete_clears_urls_and_enabled(self) -> None:
        ProjectOption.objects.set_value(self.project, "webhooks:urls", "http://example.com")
        ProjectOption.objects.set_value(self.project, "webhooks:enabled", True)

        self.get_success_response(
            self.organization.slug, self.project.slug, method="delete", status_code=204
        )

        stored = ProjectOption.objects.get_value(self.project, "webhooks:urls", default="")
        assert stored == ""
        assert (
            ProjectOption.objects.get_value(self.project, "webhooks:enabled", default=False)
            is False
        )

    def test_get_requires_project_access(self) -> None:
        self.login_as(self.create_user())

        self.get_error_response(self.organization.slug, self.project.slug, status_code=403)
