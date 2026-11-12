from unittest import mock

from django.urls import reverse

from sentry import search
from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now
from tests.sentry.issues.test_utils import SearchIssueTestMixin


class OrganizationIssuesCountTest(APITestCase, SnubaTestCase, SearchIssueTestMixin):
    endpoint = "sentry-api-0-organization-issues-count"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.url = reverse(self.endpoint, args=(self.organization.slug,))

    def test_issue_count_flag_query(self) -> None:
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

        response = self.client.get(self.url + "?query=flags[test:flag]:true")
        assert response.status_code == 200
        assert response.json() == {"flags[test:flag]:true": 1}

    def test_dateless_query_searches_without_a_date_range(self) -> None:
        self.store_event(
            data={"timestamp": before_now(seconds=1).isoformat()},
            project_id=self.project.id,
        )

        with mock.patch(
            "sentry.issues.endpoints.organization_issues_count.search.backend.query",
            wraps=search.backend.query,
        ) as mock_query:
            response = self.get_success_response(
                self.organization.slug, qs_params={"query": "is:unresolved"}
            )

        assert response.data == {"is:unresolved": 1}
        assert mock_query.call_args.kwargs["date_from"] is None
        assert mock_query.call_args.kwargs["date_to"] is None
