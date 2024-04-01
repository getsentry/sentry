from typing import Any

from django.urls import reverse

from sentry.testutils.cases import APITestCase


class RelatedIssuesTest(APITestCase):
    endpoint = "sentry-api-0-issues-related-issues"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.organization = self.create_organization(owner=self.user)
        self.error_type = "ApiTimeoutError"
        self.error_value = "Timed out attempting to reach host: api.github.com"
        # You need to set this value in your test before calling the API
        self.group_id = None

    def reverse_url(self) -> str:
        return reverse(self.endpoint, kwargs={"issue_id": self.group_id})

    def _data(self, type: str, value: str) -> dict[str, Any]:
        return {"type": "error", "metadata": {"type": type, "value": value}}

    def test_same_root_related_issues(self) -> None:
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
        # XXX: See if we can get this code to be closer to how save_event generates groups
        for datum in groups_data:
            self.create_group(data=datum)

        response = self.get_success_response()
        # The UI will then make normal calls to get issues-stats
        # For instance, this URL
        # https://us.sentry.io/api/0/organizations/sentry/issues-stats/?groups=4741828952&groups=4489703641&statsPeriod=24h
        assert response.json() == {"same_root_cause": [1, 5]}
