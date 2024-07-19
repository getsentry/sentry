from django.urls import reverse
from rest_framework.exceptions import ErrorDetail

from sentry.testutils.cases import APITestCase, SnubaTestCase, TraceTestCase


class RelatedIssuesTest(APITestCase, SnubaTestCase, TraceTestCase):
    endpoint = "sentry-api-0-issues-related-issues"
    FEATURES: list[str] = []

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.organization = self.create_organization(owner=self.user)
        # You need to set this value in your test before calling the API
        self.group_id: int | None = None

    def reverse_url(self) -> str:
        return reverse(self.endpoint, kwargs={"issue_id": self.group_id})

    def _data(self, type: str, value: str) -> dict[str, object]:
        return {"type": "error", "metadata": {"type": type, "value": value}}

    def test_same_root_related_issues(self) -> None:
        # This is the group we're going to query about
        error_type = "ApiTimeoutError"
        error_value = "Timed out attempting to reach host: api.github.com"
        group = self.create_group(data=self._data(error_type, error_value))
        self.group_id = group.id

        groups_data = [
            self._data("ApiError", error_value),
            self._data(error_type, "Unreacheable host: api.github.com"),
            self._data(error_type, ""),
            # Only this group will be related
            self._data(error_type, error_value),
        ]
        # XXX: See if we can get this code to be closer to how save_event generates groups
        for datum in groups_data:
            self.create_group(data=datum)

        response = self.get_success_response(qs_params={"type": "same_root_cause"})
        # The UI will then make normal calls to get issues-stats
        # For instance, this URL
        # https://us.sentry.io/api/0/organizations/sentry/issues-stats/?groups=4741828952&groups=4489703641&statsPeriod=24h
        assert response.json() == {"type": "same_root_cause", "data": [5], "meta": {}}

    def test_trace_connected_errors(self) -> None:
        error_event, _, another_proj_event = self.load_errors(self.project)
        assert error_event.group is not None
        group = error_event.group
        recommended_event = group.get_recommended_event_for_environments()
        assert recommended_event is not None  # It helps with typing
        # This assertion ensures that the behaviour is different from the next test
        assert recommended_event.event_id != another_proj_event.event_id

        # This asserts that there are two issues which belong to the same trace
        assert error_event.group_id != another_proj_event.group_id
        assert error_event.project.id != another_proj_event.project.id
        assert error_event.trace_id == another_proj_event.trace_id

        # This sets the group_id to the one we want to query about
        self.group_id = error_event.group_id
        response = self.get_success_response(qs_params={"type": "trace_connected"})
        assert response.json() == {
            "type": "trace_connected",
            # This is the other issue in the trace that it is not itself
            "data": [another_proj_event.group_id],
            "meta": {
                "event_id": recommended_event.event_id,
                "trace_id": error_event.trace_id,
            },
        }

    def test_trace_connected_errors_specific_event(self) -> None:
        error_event, _, another_proj_event = self.load_errors(self.project)

        # This sets the group_id to the one we want to query about
        self.group_id = another_proj_event.group_id
        response = self.get_success_response(
            qs_params={
                "type": "trace_connected",
                "event_id": another_proj_event.event_id,
                "project_id": another_proj_event.project_id,
            }
        )
        assert response.json() == {
            "type": "trace_connected",
            # This is the other issue in the trace that it is not itself
            "data": [error_event.group_id],
            "meta": {
                "event_id": another_proj_event.event_id,
                "trace_id": another_proj_event.trace_id,
            },
        }

    def test_validation(self) -> None:
        error_event, _, _ = self.load_errors(self.project)
        self.group_id = error_event.group_id
        response = self.get_response(qs_params={"type": "foo"})
        assert response.data == {
            "type": [ErrorDetail(string='"foo" is not a valid choice.', code="invalid_choice")]
        }
        response = self.get_response(
            qs_params={"type": "same_root_cause", "event_id": 123, "project_id": "should be an int"}
        )
        assert response.data == {
            "project_id": [ErrorDetail(string="A valid integer is required.", code="invalid")]
        }
