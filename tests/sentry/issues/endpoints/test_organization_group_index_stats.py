from sentry.testutils.cases import APITestCase


class OrganizationGroupIndexStatsTest(APITestCase):
    endpoint = "sentry-api-0-organization-group-index-stats"

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
