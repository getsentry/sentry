from unittest import mock

import orjson
from django.urls import reverse

from sentry.conf.server import DEFAULT_GROUPING_CONFIG
from sentry.grouping.api import _load_default_grouping_config, load_grouping_config
from sentry.grouping.grouping_info import get_grouping_info
from sentry.interfaces.stacktrace import StacktraceOrder
from sentry.testutils.cases import APITestCase, PerformanceIssueTestCase
from sentry.testutils.silo import assume_test_silo_mode_of
from sentry.testutils.skips import requires_snuba
from sentry.users.models.user_option import UserOption
from sentry.utils.samples import load_data

pytestmark = [requires_snuba]


class EventGroupingInfoEndpointTestCase(APITestCase, PerformanceIssueTestCase):
    def setUp(self) -> None:
        self.login_as(user=self.user)

        self.team = self.create_team(
            organization=self.organization, slug="tiger-team", members=[self.user]
        )

        self.project = self.create_project(
            organization=self.organization, teams=[self.team], slug="bengal"
        )

    def test_error_event(self) -> None:
        data = load_data(platform="javascript")
        event = self.store_event(data=data, project_id=self.project.id)

        url = reverse(
            "sentry-api-0-event-grouping-info",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "project_id_or_slug": self.project.slug,
                "event_id": event.event_id,
            },
        )

        response = self.client.get(url, format="json")
        content = orjson.loads(response.content)

        assert response.status_code == 200
        assert content["variants"]["system_exception_stacktrace"]["type"] == "component"

    def test_error_event_stacktrace_order(self) -> None:
        """Test that the response stacktrace order matches the user's stacktrace order preference"""
        data = load_data(platform="javascript")

        # Grab the context lines, in order, to compare to what we get back from the endpoint
        frames = data["exception"]["values"][0]["stacktrace"]["frames"]
        orig_context_lines = [frame["context_line"].strip() for frame in frames]

        event = self.store_event(data=data, project_id=self.project.id)

        for option_value, expect_reversed_frames in [
            ("", True),  # TODO: We should remove these faulty values from the DB
            (StacktraceOrder.DEFAULT, True),
            (StacktraceOrder.MOST_RECENT_LAST, False),
            (StacktraceOrder.MOST_RECENT_FIRST, True),
        ]:
            with assume_test_silo_mode_of(UserOption):
                UserOption.objects.set_value(
                    user=self.user, key="stacktrace_order", value=option_value
                )

            url = reverse(
                "sentry-api-0-event-grouping-info",
                kwargs={
                    "organization_id_or_slug": self.organization.slug,
                    "project_id_or_slug": self.project.slug,
                    "event_id": event.event_id,
                },
            )
            response = self.client.get(url, format="json")
            content = orjson.loads(response.content)

            # Dig into the JSON to grab the context lines, in order
            response_context_lines = []
            exception_component = content["variants"]["app_exception_stacktrace"]["component"][
                "values"
            ][0]
            for exception_component_subcomponent in exception_component["values"]:
                if exception_component_subcomponent["id"] == "stacktrace":
                    stacktrace_component = exception_component_subcomponent
                    for frame_component in stacktrace_component["values"]:
                        for frame_component_subcomponent in frame_component["values"]:
                            if frame_component_subcomponent["id"] == "context_line":
                                context_line_component = frame_component_subcomponent
                                response_context_lines.append(context_line_component["values"][0])

            assert response.status_code == 200
            if expect_reversed_frames:
                assert response_context_lines == list(reversed(orig_context_lines))
            else:
                assert response_context_lines == orig_context_lines

    def test_error_event_exception_order(self) -> None:
        """Test that the response exception order matches the user's stacktrace order preference"""
        data = load_data(platform="javascript")

        # Replace the single exception in `data` with two exceptions
        exceptions = [
            {"type": "FetchError", "value": "Charlie didn't bring the ball back!"},
            {"type": "ShoeError", "value": "Oh, no! Charlie ate the flip-flops!"},
        ]
        data["exception"]["values"] = exceptions

        # Grab the error types, in order, to compare to what we get back from the endpoint
        orig_exception_types = [exception["type"] for exception in exceptions]

        event = self.store_event(data=data, project_id=self.project.id)

        for option_value, expect_reversed_exceptions in [
            ("", True),  # TODO: We should remove these faulty values from the DB
            (StacktraceOrder.DEFAULT, True),
            (StacktraceOrder.MOST_RECENT_LAST, False),
            (StacktraceOrder.MOST_RECENT_FIRST, True),
        ]:
            with assume_test_silo_mode_of(UserOption):
                UserOption.objects.set_value(
                    user=self.user, key="stacktrace_order", value=option_value
                )

            url = reverse(
                "sentry-api-0-event-grouping-info",
                kwargs={
                    "organization_id_or_slug": self.organization.slug,
                    "project_id_or_slug": self.project.slug,
                    "event_id": event.event_id,
                },
            )
            response = self.client.get(url, format="json")
            content = orjson.loads(response.content)

            # Dig into the JSON to grab the error types, in order
            response_error_types = []
            chained_exception_component = content["variants"]["app_chained_exception_message"][
                "component"
            ]["values"][0]
            for exception_component in chained_exception_component["values"]:
                for exception_component_subcomponent in exception_component["values"]:
                    if exception_component_subcomponent["id"] == "type":
                        error_type_component = exception_component_subcomponent
                        response_error_types.append(error_type_component["values"][0])

            assert response.status_code == 200
            if expect_reversed_exceptions:
                assert response_error_types == list(reversed(orig_exception_types))
            else:
                assert response_error_types == orig_exception_types

    def test_no_event(self) -> None:
        url = reverse(
            "sentry-api-0-event-grouping-info",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "project_id_or_slug": self.project.slug,
                "event_id": "fake-event-id",
            },
        )

        response = self.client.get(url, format="json")

        assert response.exception is True
        assert response.status_code == 404
        assert response.status_text == "Not Found"

    def test_get_grouping_info_unkown_grouping_config(self) -> None:
        """Show we use the default config when the config we're given is unrecognized"""

        data = load_data(platform="javascript")
        event = self.store_event(data=data, project_id=self.project.id)

        with mock.patch(
            "sentry.grouping.api.get_grouping_variants_for_event"
        ) as mock_get_grouping_variants:
            event.data["grouping_config"]["id"] = "fake-config"
            grouping_config = load_grouping_config(event.get_grouping_config())

            get_grouping_info(grouping_config, self.project, event)

            mock_get_grouping_variants.assert_called_once()
            assert mock_get_grouping_variants.call_args.args[0] == event
            assert mock_get_grouping_variants.call_args.args[1].id == DEFAULT_GROUPING_CONFIG

    @mock.patch("sentry.grouping.grouping_info.logger")
    @mock.patch("sentry.grouping.grouping_info.metrics")
    def test_get_grouping_info_hash_mismatch(
        self, mock_metrics: mock.MagicMock, mock_logger: mock.MagicMock
    ) -> None:
        # Make a Python event
        data = load_data(platform="python")
        python_event = self.store_event(data=data, project_id=self.project.id)
        python_grouping_variants = python_event.get_grouping_variants(
            force_config=None, normalize_stacktraces=True
        )
        # Delete all grouping variants but system
        del python_grouping_variants["app"]
        del python_grouping_variants["default"]

        # Make a Javascript event
        data = load_data(platform="javascript")
        javascript_event = self.store_event(data=data, project_id=self.project.id)
        # Force a hash mismatch by setting the variants to be for the python event
        with mock.patch(
            "sentry.services.eventstore.models.BaseEvent.get_grouping_variants"
        ) as mock_get_grouping_variants:
            mock_get_grouping_variants.return_value = python_grouping_variants
            default_grouping_config = _load_default_grouping_config()

            get_grouping_info(default_grouping_config, self.project, javascript_event)

        mock_metrics.incr.assert_called_with("event_grouping_info.hash_mismatch")
        mock_logger.error.assert_called_with(
            "event_grouping_info.hash_mismatch",
            extra={"project_id": self.project.id, "event_id": javascript_event.event_id},
        )
