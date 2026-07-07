from sentry.api.endpoints.organization_trace_item_attributes import (
    build_sentry_attribute_context,
)
from sentry.search.eap.types import SupportedTraceItemType


def test_build_sentry_attribute_context_brief() -> None:
    # `span.description` is a Sentry-defined attribute (not a convention); its
    # context comes from the definition and is marked isConvention=False.
    context = build_sentry_attribute_context(
        "span.description", "string", SupportedTraceItemType.SPANS
    )
    assert context is not None
    assert context["isConvention"] is False
    assert context["brief"] == "Description of the span's operation."
    assert context["isDeprecated"] is False
    assert "examples" not in context


def test_build_sentry_attribute_context_examples() -> None:
    # Enumerated values carried on the definition surface as `examples`.
    context = build_sentry_attribute_context("severity", "string", SupportedTraceItemType.LOGS)
    assert context is not None
    assert context["examples"] == ["error", "warn", "info"]


def test_build_sentry_attribute_context_project_id_string_type() -> None:
    # `project.id`'s EAP column is string-typed; its context must still resolve
    # when requested with attributeType=string. Guards against type drift between
    # the context and the definition's search_type (they share one source now).
    context = build_sentry_attribute_context("project.id", "string", SupportedTraceItemType.SPANS)
    assert context is not None
    assert context["brief"] == "The id of the project."


def test_build_sentry_attribute_context_type_mismatch_returns_none() -> None:
    # A request whose type doesn't match the definition (e.g. a string tag that
    # merely shares the `span.duration` alias) must not be labeled with the
    # definition's context.
    assert (
        build_sentry_attribute_context("span.duration", "string", SupportedTraceItemType.SPANS)
        is None
    )


def test_build_sentry_attribute_context_unknown_returns_none() -> None:
    assert (
        build_sentry_attribute_context(
            "definitely.not.an.attribute", "string", SupportedTraceItemType.SPANS
        )
        is None
    )
