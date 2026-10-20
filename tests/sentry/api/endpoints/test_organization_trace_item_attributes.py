from sentry.api.endpoints.organization_trace_item_attributes import (
    as_attribute_key,
    build_sentry_attribute_context,
)
from sentry.search.eap.types import SupportedTraceItemType


def test_as_attribute_key_replacement_uses_tags_syntax() -> None:
    # `thread.id` is a public alias for `sentry.thread.id` (the deprecated
    # attribute), so the replacement is only reachable through the tags syntax.
    attribute_key = as_attribute_key(
        "sentry.thread.id", "number", SupportedTraceItemType.SPANS, include_context=True
    )
    assert attribute_key["key"] == "tags[sentry.thread.id,number]"
    assert attribute_key["context"]["isDeprecated"] is True
    assert attribute_key["context"]["replacementAttribute"] == "tags[thread.id,number]"


def test_as_attribute_key_replacement_uses_its_own_type() -> None:
    # `deviceMemory` is a string, but its replacement is an integer convention.
    attribute_key = as_attribute_key(
        "deviceMemory", "string", SupportedTraceItemType.SPANS, include_context=True
    )
    assert (
        attribute_key["context"]["replacementAttribute"]
        == "tags[device.memory.estimated_capacity,number]"
    )


def test_as_attribute_key_replacement_uses_public_alias() -> None:
    attribute_key = as_attribute_key(
        "http.status_code", "number", SupportedTraceItemType.SPANS, include_context=True
    )
    assert attribute_key["context"]["replacementAttribute"] == "http.response_status_code"


def test_as_attribute_key_replacement_without_definition() -> None:
    # Logs have no definition for the replacement, so a number replacement needs
    # the tags syntax to be queried with the right type.
    attribute_key = as_attribute_key(
        "http.status_code", "number", SupportedTraceItemType.LOGS, include_context=True
    )
    assert attribute_key["key"] == "tags[http.status_code,number]"
    assert (
        attribute_key["context"]["replacementAttribute"] == "tags[http.response.status_code,number]"
    )


def test_as_attribute_key_replacement_with_same_key_is_not_deprecated() -> None:
    # `sentry.segment.name` (the replacement) is also served as `transaction`,
    # so there's nothing to migrate to.
    attribute_key = as_attribute_key(
        "sentry.transaction", "string", SupportedTraceItemType.SPANS, include_context=True
    )
    assert attribute_key["key"] == "transaction"
    assert attribute_key["context"]["isDeprecated"] is False
    assert "replacementAttribute" not in attribute_key["context"]


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
