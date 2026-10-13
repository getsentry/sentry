from unittest.mock import patch

from django.test.client import RequestFactory
from django.urls import reverse

from fixtures.apidocs_test_case import APIDocsTestCase


class ProjectCodeOwnersDocs(APIDocsTestCase):
    def setUp(self) -> None:
        self.login_as(user=self.user)
        self.code_mapping = self.create_code_mapping(project=self.project, default_branch=None)
        self.data = {
            "raw": f"src/* {self.user.email}",
            "codeMappingId": str(self.code_mapping.id),
        }
        self.list_url = reverse(
            "sentry-api-0-project-codeowners",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "project_id_or_slug": self.project.slug,
            },
        )
        self.codeowner_patcher = patch(
            "sentry.integrations.source_code_management.repository.RepositoryIntegration.get_codeowner_file",
            return_value={"html_url": "https://example.com/CODEOWNERS"},
        )
        self.codeowner_patcher.start()
        self.addCleanup(self.codeowner_patcher.stop)

    def create_project_codeowners(self) -> str:
        with self.feature("organizations:integrations-codeowners"):
            response = self.client.post(self.list_url, self.data)
        assert response.status_code == 201, response.content
        codeowners_id = response.data["id"]
        assert isinstance(codeowners_id, str)
        return codeowners_id

    def detail_url(self, codeowners_id: int | str) -> str:
        return reverse(
            "sentry-api-0-project-codeowners-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "project_id_or_slug": self.project.slug,
                "codeowners_id": codeowners_id,
            },
        )

    def test_get_list(self) -> None:
        self.create_project_codeowners()
        url = f"{self.list_url}?expand=codeMapping"
        with self.feature("organizations:integrations-codeowners"):
            response = self.client.get(url)
        request = RequestFactory().get(url)

        self.validate_schema(request, response)

    def test_post(self) -> None:
        with self.feature("organizations:integrations-codeowners"):
            response = self.client.post(self.list_url, self.data)
        request = RequestFactory().post(self.list_url, self.data)

        self.validate_schema(request, response)

    def test_get_detail(self) -> None:
        codeowners_id = self.create_project_codeowners()
        url = self.detail_url(codeowners_id)
        with self.feature("organizations:integrations-codeowners"):
            response = self.client.get(url)
        request = RequestFactory().get(url)

        self.validate_schema(request, response)

    def test_get_detail_with_empty_schema(self) -> None:
        codeowners = self.create_codeowners(
            project=self.project,
            code_mapping=self.code_mapping,
            raw="",
            schema={},
        )
        url = self.detail_url(codeowners.id)
        with self.feature("organizations:integrations-codeowners"):
            response = self.client.get(url)
        request = RequestFactory().get(url)

        self.validate_schema(request, response)

    def test_put(self) -> None:
        codeowners_id = self.create_project_codeowners()
        url = self.detail_url(codeowners_id)
        data = {"raw": f"tests/* {self.user.email}"}
        with self.feature("organizations:integrations-codeowners"):
            response = self.client.put(url, data)
        request = RequestFactory().put(url, data)

        self.validate_schema(request, response)

    def test_delete(self) -> None:
        codeowners_id = self.create_project_codeowners()
        url = self.detail_url(codeowners_id)
        with self.feature("organizations:integrations-codeowners"):
            response = self.client.delete(url)
        request = RequestFactory().delete(url)

        self.validate_schema(request, response)
