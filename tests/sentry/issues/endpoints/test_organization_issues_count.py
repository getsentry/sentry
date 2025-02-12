from django.urls import reverse

from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now
from tests.sentry.issues.test_utils import SearchIssueTestMixin


class OrganizationIssuesCountTest(APITestCase, SnubaTestCase, SearchIssueTestMixin):
    endpoint = "sentry-api-0-organization-issues-count"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.url = reverse(self.endpoint, args=(self.organization.slug,))

    def test_issue_count_flag_query(self):
        # Found event.
        self.store_event(
            data={
                "timestamp": before_now(seconds=1).isoformat(),
                "contexts": {"flags": {"values": [{"flag": "test:flag", "result": True}]}},
            },
            project_id=self.project.id,
        )
        # Filtered event.
        self.store_event(
            data={"timestamp": before_now(seconds=1).isoformat()},
            project_id=self.project.id,
        )

        response = self.client.get(self.url + '?query=flags["test:flag"]:true')
        assert response.status_code == 200
        assert response.json() == {'flags["test:flag"]:true': 1}
