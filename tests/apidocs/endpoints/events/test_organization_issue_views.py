from django.test.client import RequestFactory

from fixtures.apidocs_test_case import APIDocsTestCase
from sentry.testutils.helpers.features import with_feature


class OrganizationIssueViewsDocs(APIDocsTestCase):
    def setUp(self) -> None:
        self.login_as(user=self.user)
        self.url = f"/api/0/organizations/{self.organization.slug}/group-search-views/"

    @with_feature({"organizations:issue-views": True})
    def test_post(self) -> None:
        data = {
            "name": "My Issues",
            "query": "is:unresolved",
            "querySort": "date",
            "projects": [],
            "environments": [],
            "timeFilters": {"period": "14d"},
        }

        response = self.client.post(self.url, data)
        request = RequestFactory().post(self.url, data)

        self.validate_schema(request, response)
