from unittest import mock

from tests.snuba.api.endpoints.test_organization_events import OrganizationEventsEndpointTestBase


class OrganizationEventsProfileFunctionsEndpointTest(OrganizationEventsEndpointTestBase):
    dataset = "profile_functions"

    def test_simple(self) -> None:
        profile_functions = [
            self.create_profile_function(attributes={"name": "foo", "self_time_ns": 1}),
            self.create_profile_function(attributes={"name": "bar", "self_time_ns": 2}),
        ]
        self.store_profile_functions(profile_functions)

        response = self.do_request(
            {
                "field": ["function", "function.self_time"],
                "orderby": "function.self_time",
                "query": "function:foo",
                "dataset": self.dataset,
            }
        )
        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            {
                "id": mock.ANY,
                "project.name": self.project.slug,
                "function": "foo",
                "function.self_time": 1,
            },
        ]

    def test_simple_aggregation(self) -> None:
        profile_functions = [
            self.create_profile_function(attributes={"name": "foo", "self_time_ns": 1}),
            self.create_profile_function(attributes={"name": "bar", "self_time_ns": 2}),
        ]
        self.store_profile_functions(profile_functions)

        response = self.do_request(
            {
                "field": ["function", "sum(function.self_time)"],
                "query": "function:foo",
                "orderby": "sum(function.self_time)",
                "dataset": self.dataset,
            }
        )

        assert response.status_code == 200, response.content
        assert response.data["data"] == [
            {
                "function": "foo",
                "sum(function.self_time)": 1,
            },
        ]
