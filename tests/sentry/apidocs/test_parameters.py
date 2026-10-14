from drf_spectacular.utils import OpenApiParameter

from sentry.apidocs.parameters import (
    EXPERIMENTAL_PARAMETER_NOTICE,
    mark_parameter_experimental,
)


def test_mark_parameter_experimental_sets_extension_and_notice() -> None:
    parameter = mark_parameter_experimental(
        OpenApiParameter(
            name="expand",
            location="query",
            type=str,
            description="Optional fields to expand.",
            extensions={"x-other": True},
        )
    )

    assert parameter.extensions == {"x-other": True, "x-sentry-experimental": True}
    assert parameter.description == (
        f"{EXPERIMENTAL_PARAMETER_NOTICE}\n\nOptional fields to expand."
    )


def test_mark_parameter_experimental_does_not_repeat_the_notice() -> None:
    parameter = OpenApiParameter(
        name="expand",
        location="query",
        type=str,
        description=f"{EXPERIMENTAL_PARAMETER_NOTICE}\n\nOptional fields to expand.",
    )

    marked = mark_parameter_experimental(mark_parameter_experimental(parameter))

    assert marked.description == f"{EXPERIMENTAL_PARAMETER_NOTICE}\n\nOptional fields to expand."
    assert marked.extensions == {"x-sentry-experimental": True}
