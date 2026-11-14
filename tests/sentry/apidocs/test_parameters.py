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
