from typing import Any
from unittest.mock import MagicMock, patch

from sentry.models.group import Group
from sentry.seer.models import SeerApiError
from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now

SEER_PATH = "sentry.api.endpoints.project_custom_inbound_filter_suggestions.run_oneshot"


def error_type_equals(*types: str) -> dict[str, Any]:
    return {"type": "error_type", "operator": "equals", "value": list(types)}


class CustomInboundFilterSuggestionsTest(APITestCase, SnubaTestCase):
    endpoint = "sentry-api-0-project-custom-inbound-filter-suggestions"
    features = [
        "organizations:inbound-filters-v2",
        "organizations:inbound-filters-in-product-flows",
        "projects:custom-inbound-filters",
    ]

    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.team = self.create_team(organization=self.organization)
        self.project = self.create_project(organization=self.organization, teams=[self.team])
        self.login_as(user=self.user)

    def store_error(self, error_type: str, value: str, **data: Any) -> Group:
        event = self.store_event(
            data={
                "exception": {"values": [{"type": error_type, "value": value}]},
                "fingerprint": [error_type, value],
                "timestamp": before_now(minutes=1).isoformat(),
                **data,
            },
            project_id=self.project.id,
        )
        assert event.group is not None
        return event.group

    def store_message(self, message: str) -> Group:
        event = self.store_event(
            data={
                "message": message,
                "fingerprint": [message],
                "timestamp": before_now(minutes=1).isoformat(),
            },
            project_id=self.project.id,
        )
        assert event.group is not None
        return event.group

    def get_filters(self, *groups: Group) -> list[dict[str, Any]]:
        with self.feature(self.features):
            response = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                qs_params={"group": [group.id for group in groups]},
            )
        return response.data["filters"]

    @patch(SEER_PATH, side_effect=SeerApiError("Seer request failed", 500))
    def test_without_seer_one_filter_lists_every_error_type(self, mock_seer: MagicMock) -> None:
        type_error = self.store_error("TypeError", "x is undefined")
        range_error = self.store_error("RangeError", "Invalid array length")
        same_type = self.store_error("TypeError", "y is not a function")

        assert self.get_filters(type_error, range_error, same_type) == [
            {
                "name": "RangeError, TypeError",
                "dataType": "error",
                "conditions": [error_type_equals("RangeError", "TypeError")],
            }
        ]

    @patch(SEER_PATH, side_effect=SeerApiError("Seer request failed", 500))
    def test_issue_without_error_type_gets_a_message_filter(self, mock_seer: MagicMock) -> None:
        type_error = self.store_error("TypeError", "x is undefined")
        message = self.store_message("Disk is full")

        assert self.get_filters(type_error, message) == [
            {
                "name": "TypeError",
                "dataType": "error",
                "conditions": [error_type_equals("TypeError")],
            },
            {
                "name": "Disk is full",
                "dataType": "error",
                "conditions": [
                    {"type": "error_message", "operator": "equals", "value": ["Disk is full"]}
                ],
            },
        ]

    @patch(SEER_PATH)
    def test_seer_answer_replaces_the_exact_filter(self, mock_seer: MagicMock) -> None:
        mock_seer.return_value = {
            "filters": [
                {
                    "name": "Timeout errors",
                    "conditions": [
                        {"type": "error_type", "operator": "glob", "value": ["*TimeoutError"]}
                    ],
                },
                {
                    "name": "Resize observer loops",
                    "conditions": [
                        {"type": "error_type", "operator": "equals", "value": ["Error"]},
                        {
                            "type": "error_message",
                            "operator": "starts_with",
                            "value": ["ResizeObserver loop"],
                        },
                    ],
                },
            ]
        }
        read_timeout = self.store_error("ReadTimeoutError", "read timed out")
        connect_timeout = self.store_error("ConnectTimeoutError", "connect timed out")
        resize = self.store_error("Error", "ResizeObserver loop limit exceeded")

        assert self.get_filters(read_timeout, connect_timeout, resize) == [
            {
                "name": "Timeout errors",
                "dataType": "error",
                "conditions": [
                    {"type": "error_type", "operator": "glob", "value": ["*TimeoutError"]}
                ],
            },
            {
                "name": "Resize observer loops",
                "dataType": "error",
                "conditions": [
                    error_type_equals("Error"),
                    {
                        "type": "error_message",
                        "operator": "starts_with",
                        "value": ["ResizeObserver loop"],
                    },
                ],
            },
        ]
        payload = mock_seer.call_args.args[1]
        assert sorted(payload["issues"], key=lambda issue: issue["type"]) == [
            {"type": "ConnectTimeoutError", "message": "connect timed out"},
            {"type": "Error", "message": "ResizeObserver loop limit exceeded"},
            {"type": "ReadTimeoutError", "message": "read timed out"},
        ]
        assert payload["common_conditions"] == []

    @patch(SEER_PATH)
    def test_seer_answer_that_misses_an_issue_is_dropped(self, mock_seer: MagicMock) -> None:
        mock_seer.return_value = {
            "filters": [
                {
                    "name": "Timeout errors",
                    "conditions": [
                        {"type": "error_type", "operator": "glob", "value": ["*TimeoutError"]}
                    ],
                }
            ]
        }
        read_timeout = self.store_error("ReadTimeoutError", "read timed out")
        type_error = self.store_error("TypeError", "x is undefined")

        assert self.get_filters(read_timeout, type_error) == [
            {
                "name": "ReadTimeoutError, TypeError",
                "dataType": "error",
                "conditions": [error_type_equals("ReadTimeoutError", "TypeError")],
            }
        ]

    @patch(SEER_PATH)
    def test_seer_answer_with_a_condition_it_may_not_write_is_dropped(
        self, mock_seer: MagicMock
    ) -> None:
        mock_seer.return_value = {
            "filters": [
                {
                    "name": "Everything",
                    "conditions": [{"type": "release", "operator": "glob", "value": ["*"]}],
                }
            ]
        }
        type_error = self.store_error("TypeError", "x is undefined")

        assert self.get_filters(type_error)[0]["conditions"] == [error_type_equals("TypeError")]

    @patch(SEER_PATH)
    def test_field_the_selected_issues_share_becomes_a_condition(
        self, mock_seer: MagicMock
    ) -> None:
        mock_seer.return_value = {
            "filters": [
                {
                    "name": "Type and range errors",
                    "conditions": [{"type": "error_type", "operator": "glob", "value": ["*Error"]}],
                }
            ]
        }
        type_error = self.store_error("TypeError", "x is undefined", release="1.0")
        range_error = self.store_error("RangeError", "Invalid array length", release="1.0")
        self.store_error("SyntaxError", "Unexpected token", release="2.0")
        release_is = {"type": "release", "operator": "equals", "value": ["1.0"]}

        assert self.get_filters(type_error, range_error) == [
            {
                "name": "Type and range errors",
                "dataType": "error",
                "conditions": [
                    {"type": "error_type", "operator": "glob", "value": ["*Error"]},
                    release_is,
                ],
            }
        ]
        assert mock_seer.call_args.args[1]["common_conditions"] == [release_is]

    @patch(SEER_PATH, return_value={})
    def test_field_the_whole_project_shares_is_left_out(self, mock_seer: MagicMock) -> None:
        type_error = self.store_error("TypeError", "x is undefined", release="1.0")
        self.store_error("SyntaxError", "Unexpected token", release="1.0")

        assert self.get_filters(type_error)[0]["conditions"] == [error_type_equals("TypeError")]

    @patch(SEER_PATH, return_value={})
    def test_field_with_several_values_on_the_selected_issues_is_left_out(
        self, mock_seer: MagicMock
    ) -> None:
        type_error = self.store_error("TypeError", "x is undefined", release="1.0")
        range_error = self.store_error("RangeError", "Invalid array length", release="2.0")

        assert self.get_filters(type_error, range_error)[0]["conditions"] == [
            error_type_equals("RangeError", "TypeError")
        ]

    @patch(SEER_PATH)
    def test_hidden_ai_features_skip_seer(self, mock_seer: MagicMock) -> None:
        self.organization.update_option("sentry:hide_ai_features", True)
        type_error = self.store_error("TypeError", "x is undefined")

        assert self.get_filters(type_error)[0]["conditions"] == [error_type_equals("TypeError")]
        mock_seer.assert_not_called()

    @patch(SEER_PATH)
    def test_issue_of_another_project_is_ignored(self, mock_seer: MagicMock) -> None:
        other_project = self.create_project(organization=self.organization)
        other_group = self.create_group(project=other_project)

        with self.feature(self.features):
            response = self.get_error_response(
                self.organization.slug,
                self.project.slug,
                qs_params={"group": [other_group.id]},
                status_code=400,
            )

        assert response.data == {
            "detail": "None of the issues is an error with a type or a message."
        }
        mock_seer.assert_not_called()

    def test_group_must_be_an_issue_id(self) -> None:
        with self.feature(self.features):
            self.get_error_response(
                self.organization.slug,
                self.project.slug,
                qs_params={"group": ["abc"]},
                status_code=400,
            )

    def test_requires_a_group(self) -> None:
        with self.feature(self.features):
            self.get_error_response(self.organization.slug, self.project.slug, status_code=400)

    def test_without_in_product_flows_feature(self) -> None:
        with self.feature(["organizations:inbound-filters-v2", "projects:custom-inbound-filters"]):
            self.get_error_response(
                self.organization.slug,
                self.project.slug,
                qs_params={"group": [1]},
                status_code=404,
            )

    def test_without_custom_inbound_filters_plan_feature(self) -> None:
        with self.feature(
            ["organizations:inbound-filters-v2", "organizations:inbound-filters-in-product-flows"]
        ):
            response = self.get_error_response(
                self.organization.slug,
                self.project.slug,
                qs_params={"group": [1]},
                status_code=400,
            )

        assert response.data == {"detail": "You do not have that feature enabled"}
