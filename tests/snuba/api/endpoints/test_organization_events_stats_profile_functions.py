from datetime import timedelta

from sentry.testutils.helpers.datetime import before_now
from tests.snuba.api.endpoints.test_organization_events import OrganizationEventsEndpointTestBase


class OrganizationEventsStatsProfileFunctionsEndpointTest(OrganizationEventsEndpointTestBase):
    dataset = "profile_functions"
    viewname = "sentry-api-0-organization-events-stats"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.start = self.day_ago = before_now(days=1).replace(
            hour=10, minute=0, second=0, microsecond=0
        )
        self.end = self.start + timedelta(hours=4)

    def test_simple(self) -> None:
        function_values = [1, 2, 3, 4]

        profile_functions = [
            self.create_profile_function(
                timestamp=self.start + timedelta(hours=i),
                attributes={"name": function_name, "self_time_ns": function_value},
            )
            for function_name in ["foo", "bar"]
            for i, function_value in enumerate(function_values)
        ]

        self.store_profile_functions(profile_functions)

        response = self.do_request(
            {
                "start": self.start,
                "end": self.end,
                "interval": "1h",
                "yAxis": "sum(function.self_time)",
                "query": "function:foo",
                "project": self.project.id,
                "dataset": self.dataset,
            }
        )
        assert response.status_code == 200, response.content

        assert [bucket for _, bucket in response.data["data"]] == [
            [{"count": value}] for value in function_values
        ]
