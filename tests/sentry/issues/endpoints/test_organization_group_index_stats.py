from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now


class OrganizationGroupIndexStatsTest(APITestCase, SnubaTestCase):
    endpoint = "sentry-api-0-organization-group-index-stats"

    def test_sessions_with_disabled_stats(self) -> None:
        event = self.store_event(
            data={"timestamp": before_now(minutes=1).isoformat()}, project_id=self.project.id
        )
        self.login_as(user=self.user)

        response = self.get_success_response(
            self.organization.slug,
            groups=[event.group_id],
            groupStatsPeriod="",
            expand="sessions",
        )

        assert len(response.data) == 1
        assert response.data[0]["id"] == str(event.group_id)
        assert "stats" not in response.data[0]
        assert "sessionCount" not in response.data[0]

    def test_invalid_search_query(self) -> None:
        group = self.create_group()
        self.login_as(user=self.user)

        response = self.get_error_response(
            self.organization.slug,
            query="title:hello OR title:goodbye",
            groups=[group.id],
            status_code=400,
        )

        assert response.data["detail"] == "Invalid request parameters."
