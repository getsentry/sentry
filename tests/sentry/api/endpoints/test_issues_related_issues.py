from typing import Any

from django.urls import reverse

from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class RelatedIssuesTest(APITestCase):
    endpoint = "sentry-api-0-issues-related-issues"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.organization = self.create_organization(owner=self.user)
        self.error_type = "ApiTimeoutError"
        self.error_value = "Timed out attempting to reach host: api.github.com"
        # You need to set this value in your test before calling the API
        self.group_id = None

    def reverse_url(self):
        return reverse(self.endpoint, kwargs={"issue_id": self.group_id})

    def _data(self, type: str, value: str) -> dict[str, Any]:
        return {"type": "error", "metadata": {"type": type, "value": value}}

    def test_basic_related_issues(self):
        # This is the group we're going to query about
        group = self.create_group(data=self._data(self.error_type, self.error_value))
        self.group_id = group.id

        groups_data = [
            self._data("ApiError", self.error_value),
            self._data(self.error_type, "Unreacheable host: api.github.com"),
            self._data(self.error_type, ""),
            # Only this group will be related
            self._data(self.error_type, self.error_value),
        ]
        for datum in groups_data:
            self.create_group(data=datum)

        response = self.get_success_response()
        assert response.json() == {"groups": [1, 5]}


# XXX: Add a test class that will query an API with the related group IDs
