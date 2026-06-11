from django.test.client import RequestFactory
from django.urls import reverse

from fixtures.apidocs_test_case import APIDocsTestCase


class OrganizationTraceItemAttributesDocs(APIDocsTestCase):
    feature_flags = {
        "organizations:ourlogs-enabled": True,
        "organizations:visibility-explore-view": True,
        "organizations:tracemetrics-enabled": True,
    }

    def setUp(self) -> None:
        self.login_as(user=self.user)
        self.url = reverse(
            "sentry-api-0-organization-trace-item-attributes",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )

    def test_get(self) -> None:
        with self.feature(self.feature_flags):
            response = self.client.get(
                f"{self.url}?dataset=spans&attributeType=string&statsPeriod=1h&project={self.project.id}"
            )
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)
