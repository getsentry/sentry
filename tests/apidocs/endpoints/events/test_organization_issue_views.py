from django.test.client import RequestFactory

from fixtures.apidocs_test_case import APIDocsTestCase
from sentry.testutils.helpers.features import with_feature


class OrganizationIssueViewsDocs(APIDocsTestCase):
    def setUp(self) -> None:
        self.login_as(user=self.user)
        self.url = f"/api/0/organizations/{self.organization.slug}/group-search-views/"
        self.data = {
            "name": "My Issues",
            "query": "is:unresolved",
            "querySort": "date",
            "projects": [],
            "environments": [],
            "timeFilters": {"period": "14d"},
        }

    @with_feature({"organizations:issue-views": True})
    def test_get(self) -> None:
        create_response = self.client.post(self.url, self.data)
        assert create_response.status_code == 201

        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)

    @with_feature({"organizations:issue-views": True})
    def test_post(self) -> None:
        response = self.client.post(self.url, self.data)
        request = RequestFactory().post(self.url, self.data)

        self.validate_schema(request, response)
