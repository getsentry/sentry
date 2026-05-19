from sentry.models.options.project_option import ProjectOption
from sentry.testutils.cases import APITestCase


class ProjectLegacyWebhooksEndpointTest(APITestCase):
    endpoint = "sentry-api-0-project-legacy-webhooks"
    method = "get"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)

    def test_get_returns_configured_urls(self) -> None:
        ProjectOption.objects.set_value(self.project, "webhooks:urls", "http://a.com\nhttp://b.com")

        response = self.get_success_response(
            self.organization.slug, self.project.slug, status_code=200
        )

        assert response.data["urls"] == ["http://a.com", "http://b.com"]

    def test_get_returns_empty_when_no_urls(self) -> None:
        response = self.get_success_response(
            self.organization.slug, self.project.slug, status_code=200
        )

        assert response.data["urls"] == []

    def test_post_stores_valid_urls(self) -> None:
        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            method="post",
            urls=["http://example.com/hook", "https://other.com/hook"],
            status_code=200,
        )

        assert response.data["urls"] == ["http://example.com/hook", "https://other.com/hook"]
        stored = ProjectOption.objects.get_value(self.project, "webhooks:urls", default="")
        assert stored == "http://example.com/hook\nhttps://other.com/hook"

    def test_post_rejects_invalid_urls(self) -> None:
        response = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            method="post",
            urls=["ftp://bad.com"],
            status_code=400,
        )

        assert "Invalid URL" in response.data["detail"]

    def test_post_rejects_non_list(self) -> None:
        response = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            method="post",
            urls="http://example.com",
            status_code=400,
        )

        assert response.data["detail"] == "urls must be a list"

    def test_delete_clears_urls(self) -> None:
        ProjectOption.objects.set_value(self.project, "webhooks:urls", "http://example.com")

        self.get_success_response(
            self.organization.slug, self.project.slug, method="delete", status_code=204
        )

        stored = ProjectOption.objects.get_value(self.project, "webhooks:urls", default="")
        assert stored == ""

    def test_get_requires_project_access(self) -> None:
        self.login_as(self.create_user())

        self.get_error_response(self.organization.slug, self.project.slug, status_code=403)
