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
        self.matching_title = "title"
        self.matching_error_type = "error_type"

    def reverse_url(self):
        return reverse(self.endpoint, kwargs={"issue_id": 1})

    def _data(self, title: str, error_type: str) -> dict[str, Any]:
        return {"type": "error", "title": title, "metadata": {"type": error_type}}

    def test_basic_related_issues(self):
        groups_data = [
            self._data(self.matching_title, self.matching_error_type),
            self._data("non matching title", self.matching_error_type),
            self._data(self.matching_title, "some error type"),
            self._data(self.matching_title, self.matching_error_type),
        ]
        for datum in groups_data:
            self.create_group(data=datum)
        response = self.get_success_response()
        # XXX: This should only be two groups
        assert response.json() == {"groups": [1, 4]}
