from django.test.client import RequestFactory
from django.urls import reverse

from fixtures.apidocs_test_case import APIDocsTestCase

FEATURES = ["organizations:inbound-filters-v2", "projects:custom-inbound-filters"]


class ProjectCustomInboundFiltersDocs(APIDocsTestCase):
    def setUp(self) -> None:
        self.create_project_custom_inbound_filter(
            project=self.project,
            name="Release filter",
            data_type="error",
            conditions=[{"type": "release", "value": ["1.*"]}],
        )
        self.url = reverse(
            "sentry-api-0-project-custom-inbound-filters",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "project_id_or_slug": self.project.slug,
            },
        )
        self.login_as(user=self.user)

    def test_get(self) -> None:
        with self.feature(FEATURES):
            response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)

    def test_post(self) -> None:
        data = {
            "name": "Drop TypeErrors",
            "dataType": "error",
            "conditions": [{"type": "error_type", "value": ["TypeError"]}],
        }
        with self.feature(FEATURES):
            response = self.client.post(self.url, data, format="json")
        request = RequestFactory().post(self.url, data, content_type="application/json")

        self.validate_schema(request, response)


class ProjectCustomInboundFilterDetailsDocs(APIDocsTestCase):
    def setUp(self) -> None:
        custom_filter = self.create_project_custom_inbound_filter(
            project=self.project,
            name="Release filter",
            data_type="error",
            conditions=[{"type": "release", "value": ["1.*"]}],
        )
        self.url = reverse(
            "sentry-api-0-project-custom-inbound-filter-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "project_id_or_slug": self.project.slug,
                "filter_id": custom_filter.id,
            },
        )
        self.login_as(user=self.user)

    def test_get(self) -> None:
        with self.feature(FEATURES):
            response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)

    def test_put(self) -> None:
        data = {"active": False}
        with self.feature(FEATURES):
            response = self.client.put(self.url, data, format="json")
        request = RequestFactory().put(self.url, data, content_type="application/json")

        self.validate_schema(request, response)

    def test_delete(self) -> None:
        with self.feature(FEATURES):
            response = self.client.delete(self.url)
        request = RequestFactory().delete(self.url)

        self.validate_schema(request, response)
