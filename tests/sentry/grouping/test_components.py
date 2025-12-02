from collections import Counter
from typing import Any

import pytest

from sentry.conf.server import FALL_2025_GROUPING_CONFIG, WINTER_2023_GROUPING_CONFIG
from sentry.grouping.component import (
    BaseGroupingComponent,
    ChainedExceptionGroupingComponent,
    ExceptionGroupingComponent,
    FrameGroupingComponent,
    FunctionGroupingComponent,
    StacktraceGroupingComponent,
    ThreadsGroupingComponent,
)
from sentry.services.eventstore.models import Event
from sentry.testutils.cases import TestCase


def find_given_child_component[T](
    parent_component: BaseGroupingComponent[Any], child_component_type: type[T]
) -> T:
    """
    Finds the first instance of the given type of child component in the parent component's `values`
    list. Works best in cases where only one instance of the given type is expected.
    """
    for child_component in parent_component.values:
        if isinstance(child_component, child_component_type):
            return child_component
    else:
        raise AssertionError(f"component not found: {child_component_type}")


class ComponentTest(TestCase):
    def setUp(self) -> None:
        self.contributing_system_frame = {
            "function": "handleRequest",
            "filename": "/node_modules/express/router.js",
            "context_line": "return handler(request);",
        }
        self.non_contributing_system_frame = {
            "function": "runApp",
            "filename": "/node_modules/express/app.js",
            "context_line": "return server.serve(port);",
        }
        self.contributing_in_app_frame = {
            "function": "playFetch",
            "filename": "/dogApp/dogpark.js",
            "context_line": "raise FailedToFetchError('Charlie didn't bring the ball back');",
        }
        self.non_contributing_in_app_frame = {
            "function": "recordMetrics",
            "filename": "/dogApp/metrics.js",
            "context_line": "return withMetrics(handler, metricName, tags);",
        }
        self.exception_value = {
            "type": "FailedToFetchError",
            "value": "Charlie didn't bring the ball back",
        }
        self.event = Event(
            event_id="12312012041520130908201311212012",
            project_id=self.project.id,
            data={
                "title": "FailedToFetchError('Charlie didn't bring the ball back')",
                "exception": {"values": [self.exception_value]},
            },
        )
        self.project.update_option(
            "sentry:grouping_enhancements",
            "\n".join(
                [
                    "stack.function:runApp -app -group",
                    "stack.function:handleRequest -app +group",
                    "stack.function:recordMetrics +app -group",
                    "stack.function:playFetch +app +group",
                ]
            ),
        )

    def test_primitive_wrappers_wrap_at_most_one_value(self) -> None:
        # These run without erroring
        FunctionGroupingComponent(values=[])
        FunctionGroupingComponent(values=["playFetch"])

        # Not so much this one
        with pytest.raises(AssertionError):
            FunctionGroupingComponent(values=["playFetch", "rollOver"])

    def test_component_wrappers_can_wrap_multiple_values(self) -> None:
        get_frame = lambda: FrameGroupingComponent(in_app=True, values=[])

        # Any number of values is fine
        StacktraceGroupingComponent(values=[])
        StacktraceGroupingComponent(values=[get_frame()])
        StacktraceGroupingComponent(values=[get_frame(), get_frame()])

    def test_frame_components_record_in_app(self) -> None:
        self.event.data["exception"]["values"][0]["stacktrace"] = {
            "frames": [
                self.contributing_system_frame,
                self.contributing_in_app_frame,
            ]
        }

        # `normalize_stacktraces=True` forces the custom stacktrace enhancements to run
        variants = self.event.get_grouping_variants(normalize_stacktraces=True)

        for variant_name in ["app", "system"]:
            exception_component = variants[variant_name].root_component.values[0]
            assert isinstance(exception_component, ExceptionGroupingComponent)
            stacktrace_component = find_given_child_component(
                exception_component, StacktraceGroupingComponent
            )
            assert stacktrace_component

            frame_components = stacktrace_component.values
            found = []
            for frame_component in frame_components:
                child_component = find_given_child_component(
                    frame_component, FunctionGroupingComponent
                )
                assert child_component is not None
                found.append(child_component.values[0])
            assert found == ["handleRequest", "playFetch"]

            assert [frame_component.in_app for frame_component in frame_components] == [False, True]

    def test_stacktrace_component_tallies_frame_types_simple(self) -> None:
        self.event.data["exception"]["values"][0]["stacktrace"] = {
            "frames": (
                [self.non_contributing_system_frame] * 11
                + [self.contributing_system_frame] * 21
                + [self.non_contributing_in_app_frame] * 12
                + [self.contributing_in_app_frame] * 31
            )
        }

        # `normalize_stacktraces=True` forces the custom stacktrace enhancements to run
        variants = self.event.get_grouping_variants(normalize_stacktraces=True)

        system_exception_component = variants["system"].root_component.values[0]
        app_exception_component = variants["app"].root_component.values[0]
        assert isinstance(app_exception_component, ExceptionGroupingComponent)
        assert isinstance(system_exception_component, ExceptionGroupingComponent)

        app_stacktrace_component = find_given_child_component(
            app_exception_component, StacktraceGroupingComponent
        )
        system_stacktrace_component = find_given_child_component(
            system_exception_component, StacktraceGroupingComponent
        )
        assert app_stacktrace_component
        assert system_stacktrace_component

        assert (
            app_exception_component.frame_counts
            == system_exception_component.frame_counts
            == app_stacktrace_component.frame_counts
            == system_stacktrace_component.frame_counts
            == Counter(
                system_non_contributing_frames=11,
                system_contributing_frames=21,
                in_app_non_contributing_frames=12,
                in_app_contributing_frames=31,
            )
        )

    def test_stacktrace_component_tallies_frame_types_not_all_types_present(self) -> None:
        self.event.data["exception"]["values"][0]["stacktrace"] = {
            "frames": (
                [self.contributing_system_frame] * 20 + [self.contributing_in_app_frame] * 13
            )
        }

        # `normalize_stacktraces=True` forces the custom stacktrace enhancements to run
        variants = self.event.get_grouping_variants(normalize_stacktraces=True)

        system_exception_component = variants["system"].root_component.values[0]
        app_exception_component = variants["app"].root_component.values[0]
        assert isinstance(app_exception_component, ExceptionGroupingComponent)
        assert isinstance(system_exception_component, ExceptionGroupingComponent)

        app_stacktrace_component = find_given_child_component(
            app_exception_component, StacktraceGroupingComponent
        )
        system_stacktrace_component = find_given_child_component(
            system_exception_component, StacktraceGroupingComponent
        )
        assert app_stacktrace_component
        assert system_stacktrace_component

        assert (
            app_exception_component.frame_counts
            == system_exception_component.frame_counts
            == app_stacktrace_component.frame_counts
            == system_stacktrace_component.frame_counts
            == Counter(
                system_non_contributing_frames=0,
                system_contributing_frames=20,
                in_app_non_contributing_frames=0,
                in_app_contributing_frames=13,
            )
        )

    def test_exception_component_uses_stacktrace_frame_counts(self) -> None:
        self.event.data["exception"]["values"][0]["stacktrace"] = {
            "frames": (
                [self.non_contributing_system_frame] * 4
                + [self.contributing_system_frame] * 15
                + [self.non_contributing_in_app_frame] * 9
                + [self.contributing_in_app_frame] * 8
            )
        }

        # `normalize_stacktraces=True` forces the custom stacktrace enhancements to run
        variants = self.event.get_grouping_variants(normalize_stacktraces=True)

        system_exception_component = variants["system"].root_component.values[0]
        app_exception_component = variants["app"].root_component.values[0]
        assert isinstance(app_exception_component, ExceptionGroupingComponent)
        assert isinstance(system_exception_component, ExceptionGroupingComponent)

        app_stacktrace_component = find_given_child_component(
            app_exception_component, StacktraceGroupingComponent
        )
        system_stacktrace_component = find_given_child_component(
            system_exception_component, StacktraceGroupingComponent
        )
        assert app_stacktrace_component
        assert system_stacktrace_component

        assert (
            app_exception_component.frame_counts
            == system_exception_component.frame_counts
            == app_stacktrace_component.frame_counts
            == system_stacktrace_component.frame_counts
            == Counter(
                system_non_contributing_frames=4,
                system_contributing_frames=15,
                in_app_non_contributing_frames=9,
                in_app_contributing_frames=8,
            )
        )

    def test_threads_component_uses_stacktrace_frame_counts(self) -> None:
        self.event.data["threads"] = self.event.data.pop("exception")
        self.event.data["threads"]["values"][0]["stacktrace"] = {
            "frames": (
                [self.non_contributing_system_frame] * 20
                + [self.contributing_system_frame] * 12
                + [self.non_contributing_in_app_frame] * 20
                + [self.contributing_in_app_frame] * 13
            )
        }

        # `normalize_stacktraces=True` forces the custom stacktrace enhancements to run
        variants = self.event.get_grouping_variants(normalize_stacktraces=True)

        app_threads_component = variants["app"].root_component.values[0]
        system_threads_component = variants["system"].root_component.values[0]
        assert isinstance(app_threads_component, ThreadsGroupingComponent)
        assert isinstance(system_threads_component, ThreadsGroupingComponent)

        app_stacktrace_component = find_given_child_component(
            app_threads_component, StacktraceGroupingComponent
        )
        system_stacktrace_component = find_given_child_component(
            system_threads_component, StacktraceGroupingComponent
        )
        assert app_stacktrace_component
        assert system_stacktrace_component

        assert (
            app_threads_component.frame_counts
            == system_threads_component.frame_counts
            == app_stacktrace_component.frame_counts
            == system_stacktrace_component.frame_counts
            == Counter(
                system_non_contributing_frames=20,
                system_contributing_frames=12,
                in_app_non_contributing_frames=20,
                in_app_contributing_frames=13,
            )
        )

    def test_chained_exception_component_sums_stacktrace_frame_counts(self) -> None:
        self.event.data["exception"]["values"] = [
            {**self.exception_value},
            {**self.exception_value},
        ]
        self.event.data["exception"]["values"][0]["stacktrace"] = {
            "frames": (
                [self.non_contributing_system_frame] * 11
                + [self.contributing_system_frame] * 21
                + [self.non_contributing_in_app_frame] * 12
                + [self.contributing_in_app_frame] * 31
            )
        }
        self.event.data["exception"]["values"][1]["stacktrace"] = {
            "frames": (
                [self.non_contributing_system_frame] * 4
                + [self.contributing_system_frame] * 15
                + [self.non_contributing_in_app_frame] * 9
                + [self.contributing_in_app_frame] * 8
            )
        }

        # `normalize_stacktraces=True` forces the custom stacktrace enhancements to run
        variants = self.event.get_grouping_variants(normalize_stacktraces=True)

        app_chained_exception_component = variants["app"].root_component.values[0]
        system_chained_exception_component = variants["system"].root_component.values[0]
        assert isinstance(app_chained_exception_component, ChainedExceptionGroupingComponent)
        assert isinstance(system_chained_exception_component, ChainedExceptionGroupingComponent)

        app_exception_components = app_chained_exception_component.values
        system_exception_components = system_chained_exception_component.values
        assert (
            [exception_component.frame_counts for exception_component in app_exception_components]
            == [
                exception_component.frame_counts
                for exception_component in system_exception_components
            ]
            == [
                Counter(
                    system_non_contributing_frames=11,
                    system_contributing_frames=21,
                    in_app_non_contributing_frames=12,
                    in_app_contributing_frames=31,
                ),
                Counter(
                    system_non_contributing_frames=4,
                    system_contributing_frames=15,
                    in_app_non_contributing_frames=9,
                    in_app_contributing_frames=8,
                ),
            ]
        )

        assert (
            app_chained_exception_component.frame_counts
            == system_chained_exception_component.frame_counts
            == Counter(
                system_non_contributing_frames=15,
                system_contributing_frames=36,
                in_app_non_contributing_frames=21,
                in_app_contributing_frames=39,
            )
        )

    def test_get_subcomponent(self) -> None:
        root_component = self.event.get_grouping_variants()["app"].root_component

        # When `recursive` isn't specified, it should find direct children but not grandchildren
        exception_component = root_component.get_subcomponent("exception")
        stacktrace_component = root_component.get_subcomponent("stacktrace")
        error_value_component = root_component.get_subcomponent("value")
        assert exception_component
        assert not stacktrace_component
        assert not error_value_component

        # Grandchildren can be found, however, if the search is recursive
        stacktrace_component = root_component.get_subcomponent("stacktrace", recursive=True)
        error_value_component = root_component.get_subcomponent("value", recursive=True)
        assert stacktrace_component
        assert error_value_component

        # The `only_contributing` flag can be used to exclude components which don't contribute
        assert stacktrace_component.contributes is False
        contributing_stacktrace_component = root_component.get_subcomponent(
            "stacktrace", recursive=True, only_contributing=True
        )
        assert not contributing_stacktrace_component

        # Even if a component itself is marked as contributing, if `only_contributing` is set, the
        # component won't be found if it has a non-contributing ancestor
        exception_component.contributes = False
        assert error_value_component.contributes is True
        contributing_error_value_component = root_component.get_subcomponent(
            "value", recursive=True, only_contributing=True
        )
        assert not contributing_error_value_component

    # TODO: Once we're fully transitioned off of the `newstyle:2023-01-11` config, this test can
    # be deleted
    def test_configs_put_exception_subcomponents_in_expected_order(self) -> None:
        self.event.data["exception"]["values"][0]["stacktrace"] = {"frames": []}

        self.project.update_option("sentry:grouping_config", WINTER_2023_GROUPING_CONFIG)
        variants = self.event.get_grouping_variants()
        exception_component = variants["app"].root_component.values[0]
        assert isinstance(exception_component, ExceptionGroupingComponent)
        assert [subcomponent.id for subcomponent in exception_component.values] == [
            "stacktrace",
            "type",
            "value",
        ]

        self.project.update_option("sentry:grouping_config", FALL_2025_GROUPING_CONFIG)
        variants = self.event.get_grouping_variants()
        exception_component = variants["app"].root_component.values[0]
        assert isinstance(exception_component, ExceptionGroupingComponent)
        assert [subcomponent.id for subcomponent in exception_component.values] == [
            "type",
            "value",
            "stacktrace",
        ]
