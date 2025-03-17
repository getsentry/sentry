from collections import Counter
from typing import Any

from sentry.eventstore.models import Event
from sentry.grouping.component import (
    BaseGroupingComponent,
    ChainedExceptionGroupingComponent,
    ExceptionGroupingComponent,
    FunctionGroupingComponent,
    StacktraceGroupingComponent,
    ThreadsGroupingComponent,
)
from sentry.testutils.cases import TestCase


def find_given_child_component[
    T
](parent_component: BaseGroupingComponent[Any], child_component_type: type[T]) -> T:
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
    def setUp(self):
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

    def test_frame_components_record_in_app(self):
        self.event.data["exception"]["values"][0]["stacktrace"] = {
            "frames": [
                self.contributing_system_frame,
                self.contributing_in_app_frame,
            ]
        }

        # `normalize_stacktraces=True` forces the custom stacktrace enhancements to run
        variants = self.event.get_grouping_variants(normalize_stacktraces=True)

        for variant_name in ["app", "system"]:
            exception_component = variants[variant_name].component.values[0]
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

    def test_stacktrace_component_tallies_frame_types_simple(self):
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

        system_exception_component = variants["system"].component.values[0]
        assert isinstance(system_exception_component, ExceptionGroupingComponent)
        system_stacktrace_component = find_given_child_component(
            system_exception_component, StacktraceGroupingComponent
        )
        assert system_stacktrace_component

        assert system_stacktrace_component.frame_counts == Counter(
            system_non_contributing_frames=11,
            system_contributing_frames=21,
            in_app_non_contributing_frames=12,
            in_app_contributing_frames=31,
        )

        # In the app variant, there's no such thing as a contributing system frame, so all the
        # system frames count as non-contributing
        app_exception_component = variants["app"].component.values[0]
        assert isinstance(app_exception_component, ExceptionGroupingComponent)
        app_stacktrace_component = find_given_child_component(
            app_exception_component, StacktraceGroupingComponent
        )
        assert app_stacktrace_component

        assert app_stacktrace_component.frame_counts == Counter(
            system_non_contributing_frames=32,
            system_contributing_frames=0,
            in_app_non_contributing_frames=12,
            in_app_contributing_frames=31,
        )

    def test_stacktrace_component_tallies_frame_types_not_all_types_present(self):
        self.event.data["exception"]["values"][0]["stacktrace"] = {
            "frames": (
                [self.contributing_system_frame] * 20 + [self.contributing_in_app_frame] * 13
            )
        }

        # `normalize_stacktraces=True` forces the custom stacktrace enhancements to run
        variants = self.event.get_grouping_variants(normalize_stacktraces=True)

        system_exception_component = variants["system"].component.values[0]
        assert isinstance(system_exception_component, ExceptionGroupingComponent)
        system_stacktrace_component = find_given_child_component(
            system_exception_component, StacktraceGroupingComponent
        )
        assert system_stacktrace_component

        assert system_stacktrace_component.frame_counts == Counter(
            system_non_contributing_frames=0,
            system_contributing_frames=20,
            in_app_non_contributing_frames=0,
            in_app_contributing_frames=13,
        )

        # In the app variant, there's no such thing as a contributing system frame, so all the
        # system frames count as non-contributing
        app_exception_component = variants["app"].component.values[0]
        assert isinstance(app_exception_component, ExceptionGroupingComponent)
        app_stacktrace_component = find_given_child_component(
            app_exception_component, StacktraceGroupingComponent
        )
        assert app_stacktrace_component

        assert app_stacktrace_component.frame_counts == Counter(
            system_non_contributing_frames=20,
            system_contributing_frames=0,
            in_app_non_contributing_frames=0,
            in_app_contributing_frames=13,
        )

    def test_exception_component_uses_stacktrace_frame_counts(self):
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

        system_exception_component = variants["system"].component.values[0]
        assert isinstance(system_exception_component, ExceptionGroupingComponent)
        system_stacktrace_component = find_given_child_component(
            system_exception_component, StacktraceGroupingComponent
        )
        assert system_stacktrace_component

        assert system_stacktrace_component.frame_counts == Counter(
            system_non_contributing_frames=4,
            system_contributing_frames=15,
            in_app_non_contributing_frames=9,
            in_app_contributing_frames=8,
        )
        assert system_exception_component.frame_counts == system_stacktrace_component.frame_counts

        # In the app variant, there's no such thing as a contributing system frame, so all the
        # system frames count as non-contributing
        app_exception_component = variants["app"].component.values[0]
        assert isinstance(app_exception_component, ExceptionGroupingComponent)
        app_stacktrace_component = find_given_child_component(
            app_exception_component, StacktraceGroupingComponent
        )
        assert app_stacktrace_component

        assert app_stacktrace_component.frame_counts == Counter(
            system_non_contributing_frames=19,
            system_contributing_frames=0,
            in_app_non_contributing_frames=9,
            in_app_contributing_frames=8,
        )
        assert app_exception_component.frame_counts == app_stacktrace_component.frame_counts

    def test_threads_component_uses_stacktrace_frame_counts(self):
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

        system_threads_component = variants["system"].component.values[0]
        assert isinstance(system_threads_component, ThreadsGroupingComponent)
        system_stacktrace_component = find_given_child_component(
            system_threads_component, StacktraceGroupingComponent
        )
        assert system_stacktrace_component

        assert system_stacktrace_component.frame_counts == Counter(
            system_non_contributing_frames=20,
            system_contributing_frames=12,
            in_app_non_contributing_frames=20,
            in_app_contributing_frames=13,
        )
        assert system_threads_component.frame_counts == system_stacktrace_component.frame_counts

        # In the app variant, there's no such thing as a contributing system frame, so all the
        # system frames count as non-contributing
        app_threads_component = variants["app"].component.values[0]
        assert isinstance(app_threads_component, ThreadsGroupingComponent)
        app_stacktrace_component = find_given_child_component(
            app_threads_component, StacktraceGroupingComponent
        )
        assert app_stacktrace_component

        assert app_stacktrace_component.frame_counts == Counter(
            system_non_contributing_frames=32,
            system_contributing_frames=0,
            in_app_non_contributing_frames=20,
            in_app_contributing_frames=13,
        )
        assert app_threads_component.frame_counts == app_stacktrace_component.frame_counts

    def test_chained_exception_component_sums_stacktrace_frame_counts(self):
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

        system_chained_exception_component = variants["system"].component.values[0]
        assert isinstance(system_chained_exception_component, ChainedExceptionGroupingComponent)
        system_exception_components = system_chained_exception_component.values
        assert [
            exception_component.frame_counts for exception_component in system_exception_components
        ] == [
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

        assert system_chained_exception_component.frame_counts == Counter(
            system_non_contributing_frames=15,
            system_contributing_frames=36,
            in_app_non_contributing_frames=21,
            in_app_contributing_frames=39,
        )

        # In the app variant, there's no such thing as a contributing system frame, so all the
        # system frames count as non-contributing
        app_chained_exception_component = variants["app"].component.values[0]
        assert isinstance(app_chained_exception_component, ChainedExceptionGroupingComponent)
        app_exception_components = app_chained_exception_component.values
        assert [
            exception_component.frame_counts for exception_component in app_exception_components
        ] == [
            Counter(
                system_non_contributing_frames=32,
                system_contributing_frames=0,
                in_app_non_contributing_frames=12,
                in_app_contributing_frames=31,
            ),
            Counter(
                system_non_contributing_frames=19,
                system_contributing_frames=0,
                in_app_non_contributing_frames=9,
                in_app_contributing_frames=8,
            ),
        ]

        assert app_chained_exception_component.frame_counts == Counter(
            system_non_contributing_frames=51,
            system_contributing_frames=0,
            in_app_non_contributing_frames=21,
            in_app_contributing_frames=39,
        )
