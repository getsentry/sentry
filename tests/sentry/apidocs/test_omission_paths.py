from __future__ import annotations

from typing import Any, TypedDict
from unittest import mock

import pytest
from django.urls import path as url_path
from drf_spectacular.drainage import get_override
from drf_spectacular.settings import spectacular_settings
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers

import sentry.apidocs.omission_apply as omission_apply
from sentry.api.base import Endpoint
from sentry.api.serializers.base import Serializer as ResponseSerializer
from sentry.apidocs.omission_paths import FIELD, VALUE, PathError, Resolved, parse_path, resolve
from sentry.apidocs.omissions import (
    DEPRECATION_REASONS_OVERRIDE,
    OMISSION_REASONS_OVERRIDE,
    sentry_schema_serializer,
)
from sentry.apidocs.utils import SentryApiBuildError
from sentry.conf.server import custom_parameter_sort
from tests.sentry.apidocs import generate_schema


class Inner(serializers.Serializer):
    token = serializers.CharField()
    caption = serializers.CharField()


class Shape(serializers.Serializer):
    name = serializers.CharField()
    data_source = serializers.ChoiceField(choices=("discover", "events", "spans"))
    config = Inner()
    items = serializers.ListField(child=Inner())
    sort = serializers.ListField(child=serializers.ChoiceField(choices=("-age", "age")))
    options = serializers.JSONField()


# --- parsing and resolution ---


def test_a_flat_path_names_a_field() -> None:
    assert resolve(Shape(), "name").kind == FIELD


def test_a_choice_field_resolves_the_next_segment_as_a_value() -> None:
    assert resolve(Shape(), "data_source.discover").kind == VALUE


@pytest.mark.parametrize("path", ("config.token", "items.token"))
def test_a_path_into_a_nested_serializer_must_be_declared_on_that_serializer(path: str) -> None:
    """The nested shape is its own component, shared by everything using it."""
    with pytest.raises(PathError) as exc:
        resolve(Shape(), path)
    assert "declare" in str(exc.value)
    assert "Inner" in str(exc.value)


def test_a_list_of_choices_resolves_a_value() -> None:
    assert resolve(Shape(), "sort.-age").kind == VALUE


@pytest.mark.parametrize(
    "path,expected",
    (
        ("name.nope", "has no addressable parts"),
        ("data_source.nope", "does not accept"),
        ("data_source.discover.deeper", "has no parts to address"),
        ("options.anything", "dynamic mapping"),
        ("config.nope", "declare"),
        ("nope", "names nothing"),
    ),
)
def test_an_unresolvable_path_is_reported(path: str, expected: str) -> None:
    with pytest.raises(PathError) as exc:
        resolve(Shape(), path)
    assert expected in str(exc.value)


@pytest.mark.parametrize("path", ("", "  ", "a..b", ".a", "a."))
def test_a_malformed_path_is_rejected(path: str) -> None:
    with pytest.raises(PathError):
        parse_path(path)


def test_choices_come_from_the_built_field_not_source() -> None:
    computed = [value.upper() for value in ("a", "b")]

    class Computed(serializers.Serializer):
        kind = serializers.ChoiceField(choices=computed)

    assert resolve(Computed(), "kind.A").kind == VALUE


def test_withholding_the_default_value_says_so() -> None:
    class Defaulted(serializers.Serializer):
        kind = serializers.ChoiceField(choices=("a", "b"), default="a")

    resolved = resolve(Defaulted(), "kind.a")
    assert resolved.kind == VALUE
    assert resolved.withholds_default


def test_withholding_a_non_default_does_not_claim_the_default() -> None:
    class Defaulted(serializers.Serializer):
        kind = serializers.ChoiceField(choices=("a", "b"), default="a")

    assert not resolve(Defaulted(), "kind.b").withholds_default


# --- the two verbs on the decorator ---


def test_both_verbs_record_their_reasons() -> None:
    @sentry_schema_serializer(
        omit_from_public_schema={"data_source.discover": "Deprecated; use events."},
        deprecate={"name": "Use slug."},
    )
    class Declared(Shape):
        pass

    assert get_override(Declared, OMISSION_REASONS_OVERRIDE) == {
        "data_source.discover": "Deprecated; use events."
    }
    assert get_override(Declared, DEPRECATION_REASONS_OVERRIDE) == {"name": "Use slug."}
    # A one-segment path is handled natively; a choice is not.
    assert get_override(Declared, "deprecate_fields") == ["name"]
    assert get_override(Declared, "exclude_fields", []) == []


def test_a_path_cannot_be_both_withheld_and_deprecated() -> None:
    with pytest.raises(ValueError) as exc:
        sentry_schema_serializer(omit_from_public_schema={"name": "a"}, deprecate={"name": "b"})
    assert "both withheld and deprecated" in str(exc.value)


def test_deprecation_requires_a_reason() -> None:
    with pytest.raises(ValueError) as exc:
        sentry_schema_serializer(deprecate={"name": "   "})
    assert "needs a reason" in str(exc.value)


def test_the_older_list_form_still_works() -> None:
    @sentry_schema_serializer(deprecate_fields=["name"])
    class Legacy(Shape):
        pass

    assert get_override(Legacy, "deprecate_fields") == ["name"]


# --- declarations the decorator refuses outright ---


def test_a_typed_dict_cannot_declare_a_dotted_path() -> None:
    """Only a serializer has fields to resolve the rest of a path against."""

    class Response(TypedDict):
        kind: str

    with pytest.raises(ValueError) as exc:
        sentry_schema_serializer(omit_from_public_schema={"kind.internal": "Internal."})(Response)
    assert "serializer" in str(exc.value)


@pytest.mark.parametrize("path", ("data_source.discover", "config.token"))
def test_deprecation_names_a_whole_field(path: str) -> None:
    with pytest.raises(ValueError) as exc:
        sentry_schema_serializer(deprecate={path: "Use something else."})
    assert "whole field" in str(exc.value)


def test_a_path_is_a_field_or_a_field_and_one_choice() -> None:
    with pytest.raises(ValueError):
        sentry_schema_serializer(omit_from_public_schema={"config.token.more": "Internal."})


@pytest.mark.parametrize("path", ("config.token", "items.token"))
def test_a_parent_cannot_omit_a_field_of_a_nested_serializer(path: str) -> None:
    """Refused when the class is defined, naming the serializer to declare it on."""

    class Parent(Shape):
        pass

    with pytest.raises(ValueError) as exc:
        sentry_schema_serializer(omit_from_public_schema={path: "Internal."})(Parent)
    assert "declare 'token' on Inner" in str(exc.value)


class RefusedResponse(TypedDict):
    name: str
    secret: str


class RefusedResponseSerializer(ResponseSerializer):
    def serialize(self, obj: Any, attrs: Any, user: Any, **kwargs: Any) -> RefusedResponse:
        raise NotImplementedError


def test_a_response_serializer_cannot_declare_omissions() -> None:
    """Its schema is the TypedDict serialize() returns, so its fields are declared there."""
    with pytest.raises(ValueError) as exc:
        sentry_schema_serializer(omit_from_public_schema={"secret": "Internal."})(
            RefusedResponseSerializer
        )
    assert "TypedDict" in str(exc.value)
    assert "RefusedResponse" in str(exc.value)


# --- resolving and withholding a serializer's choices ---


def test_only_choice_paths_become_rules() -> None:
    @sentry_schema_serializer(
        omit_from_public_schema={"name": "Internal.", "data_source.discover": "Deprecated."}
    )
    class Mixed(Shape):
        pass

    assert list(omission_apply.choice_rules(Mixed())) == ["data_source.discover"]
    assert get_override(Mixed, "exclude_fields") == ["name"]


def test_a_serializer_without_declarations_has_no_rules() -> None:
    assert omission_apply.choice_rules(Shape()) == {}


def test_a_withheld_value_is_stripped_from_the_description() -> None:
    holder = {"description": "Pick one.\n\n* `a` - A\n* `b` - B"}
    omission_apply.strip_choice_description(holder, "a")
    assert holder["description"] == "Pick one.\n\n* `b` - B"


def test_withholding_from_a_list_of_choices_edits_its_items() -> None:
    before = {
        "properties": {
            "sort": {"type": "array", "items": {"type": "string", "enum": ["-age", "age"]}}
        }
    }
    rules = {"sort.-age": Resolved(("sort", "-age"), VALUE)}
    after = omission_apply.withhold_values(before, rules)
    omission_apply.check_withheld_values(before, after, rules)
    assert after["properties"]["sort"]["items"]["enum"] == ["age"]


def test_withholding_the_default_requires_the_field_and_passes_the_check() -> None:
    before = {
        "properties": {
            "kind": {"type": "string", "enum": ["legacy", "current"], "default": "legacy"}
        }
    }
    rules = {"kind.legacy": Resolved(("kind", "legacy"), VALUE, withholds_default=True)}
    after = omission_apply.withhold_values(before, rules)
    omission_apply.check_withheld_values(before, after, rules)
    assert after["properties"]["kind"] == {"type": "string", "enum": ["current"]}
    assert after["required"] == ["kind"]


def test_a_value_absent_from_the_generated_enum_is_reported() -> None:
    before = {"properties": {"kind": {"type": "string", "enum": ["public"]}}}
    rules = {"kind.gone": Resolved(("kind", "gone"), VALUE)}
    with pytest.raises(omission_apply.OmissionError) as exc:
        omission_apply.withhold_values(before, rules)
    assert "not in the generated enum" in str(exc.value)


# --- the check that a build changed exactly what was declared ---

WITHHELD = {"kind.internal": Resolved(("kind", "internal"), VALUE)}


def _mapped() -> dict[str, Any]:
    return {
        "type": "object",
        "properties": {
            "kind": {
                "type": "string",
                "enum": ["public", "internal"],
                "description": "Kind.\n\n* `public`\n* `internal`",
            },
            "other": {"type": "string", "enum": ["public", "internal"], "default": "public"},
        },
    }


def test_withholding_leaves_the_input_untouched_and_passes_the_check() -> None:
    before = _mapped()
    after = omission_apply.withhold_values(before, WITHHELD)
    omission_apply.check_withheld_values(before, after, WITHHELD)
    assert after["properties"]["kind"]["enum"] == ["public"]
    assert after["properties"]["kind"]["description"] == "Kind.\n\n* `public`"
    assert before == _mapped()


def test_a_change_to_an_undeclared_field_fails_the_check() -> None:
    after = _mapped()
    after["properties"]["other"]["enum"] = ["public"]
    with pytest.raises(omission_apply.OmissionError) as exc:
        omission_apply.check_withheld_values(_mapped(), after, WITHHELD)
    assert "other" in str(exc.value)


def test_withholding_more_than_was_declared_fails_the_check() -> None:
    after = omission_apply.withhold_values(_mapped(), WITHHELD)
    after["properties"]["kind"]["enum"] = []
    with pytest.raises(omission_apply.OmissionError):
        omission_apply.check_withheld_values(_mapped(), after, WITHHELD)


def test_dropping_a_default_that_was_not_withheld_fails_the_check() -> None:
    after = omission_apply.withhold_values(_mapped(), WITHHELD)
    del after["properties"]["other"]["default"]
    with pytest.raises(omission_apply.OmissionError):
        omission_apply.check_withheld_values(_mapped(), after, WITHHELD)


# --- through schema generation ---


def _build(*routes: tuple[str, type[Endpoint]]) -> dict[str, Any]:
    """Generate a schema for `routes` the way the docs build configures it: the
    project's parameter ordering, and no enum extraction into components."""
    patterns = [url_path(route, view.as_view()) for route, view in routes]
    with (
        mock.patch.object(spectacular_settings, "POSTPROCESSING_HOOKS", []),
        mock.patch.object(spectacular_settings, "SORT_OPERATION_PARAMETERS", custom_parameter_sort),
    ):
        return generate_schema(None, patterns=patterns)


def _query(schema: dict[str, Any], route: str) -> dict[str, dict[str, Any]]:
    parameters = schema["paths"][f"/{route}"]["get"]["parameters"]
    return {p["name"]: p for p in parameters if p["in"] == "query"}


def test_a_rule_reaches_only_the_operation_whose_serializer_declares_it() -> None:
    """Another endpoint with a same-named parameter must not be touched."""

    @sentry_schema_serializer(omit_from_public_schema={"sort.internal": "Internal."})
    class DeclaringParams(serializers.Serializer):
        sort = serializers.ChoiceField(choices=("age", "internal"))

    class UnrelatedParams(serializers.Serializer):
        sort = serializers.ChoiceField(choices=("age", "internal"))

    class DeclaringEndpoint(Endpoint):
        permission_classes = ()

        @extend_schema(parameters=[DeclaringParams])
        def get(self, request):
            pass

    class UnrelatedEndpoint(Endpoint):
        permission_classes = ()

        @extend_schema(parameters=[UnrelatedParams])
        def get(self, request):
            pass

    schema = _build(("declaring/", DeclaringEndpoint), ("unrelated/", UnrelatedEndpoint))
    assert _query(schema, "declaring/")["sort"]["schema"]["enum"] == ["age"]
    assert _query(schema, "unrelated/")["sort"]["schema"]["enum"] == ["age", "internal"]


def test_a_rule_applies_when_the_operation_drops_one_of_the_serializers_fields() -> None:
    """A rule that cannot find its operation must not quietly publish the value."""

    @sentry_schema_serializer(omit_from_public_schema={"kind.internal": "Internal."})
    class DroppedFieldParams(serializers.Serializer):
        kind = serializers.ChoiceField(choices=("public", "internal"))
        other = serializers.CharField(required=False)

    class DroppedFieldEndpoint(Endpoint):
        permission_classes = ()

        @extend_schema(parameters=[DroppedFieldParams, OpenApiParameter("other", exclude=True)])
        def get(self, request):
            pass

    schema = _build(("dropped/", DroppedFieldEndpoint))
    assert "other" not in _query(schema, "dropped/")
    assert _query(schema, "dropped/")["kind"]["schema"]["enum"] == ["public"]


def test_a_nested_rule_cannot_hide_a_field_from_another_endpoint_using_the_shape() -> None:
    class OwnedShape(serializers.Serializer):
        token = serializers.CharField(help_text="Token.")
        caption = serializers.CharField(help_text="Caption.")

    with pytest.raises(ValueError) as exc:

        @sentry_schema_serializer(omit_from_public_schema={"only.token": "Internal."})
        class HoldsOwnedShape(serializers.Serializer):
            only = OwnedShape(help_text="Only.")

    assert "declare 'token' on OwnedShape" in str(exc.value)


def test_a_withheld_choice_leaves_the_parameter_enum_and_description() -> None:
    @sentry_schema_serializer(omit_from_public_schema={"kind.internal": "Internal."})
    class DescribedParams(serializers.Serializer):
        kind = serializers.ChoiceField(choices=("public", "internal"), help_text="Kind.")

    class DescribedEndpoint(Endpoint):
        permission_classes = ()

        @extend_schema(parameters=[DescribedParams])
        def get(self, request):
            pass

    kind = _query(_build(("described/", DescribedEndpoint)), "described/")["kind"]
    assert kind["schema"]["enum"] == ["public"]
    assert "* `public`" in kind["description"]
    assert "internal" not in kind["description"]


def test_withholding_the_default_requires_the_parameter_and_orders_it_first() -> None:
    @sentry_schema_serializer(omit_from_public_schema={"kind.legacy": "Send kind explicitly."})
    class DefaultedParams(serializers.Serializer):
        a_optional = serializers.CharField(required=False)
        kind = serializers.ChoiceField(choices=("legacy", "current"), default="legacy")

    class DefaultedEndpoint(Endpoint):
        permission_classes = ()

        @extend_schema(parameters=[DefaultedParams])
        def get(self, request):
            pass

    schema = _build(("defaulted/", DefaultedEndpoint))
    parameters = schema["paths"]["/defaulted/"]["get"]["parameters"]
    assert [p["name"] for p in parameters] == ["kind", "a_optional"]
    assert parameters[0]["required"] is True
    assert "default" not in parameters[0]["schema"]


def test_a_withheld_choice_leaves_a_request_body_component() -> None:
    @sentry_schema_serializer(omit_from_public_schema={"kind.internal": "Internal."})
    class WithheldBody(serializers.Serializer):
        kind = serializers.ChoiceField(choices=("public", "internal"), help_text="Kind.")

    class BodyEndpoint(Endpoint):
        permission_classes = ()

        @extend_schema(request=WithheldBody)
        def post(self, request):
            pass

    schema = _build(("body/", BodyEndpoint))
    assert schema["components"]["schemas"]["WithheldBody"]["properties"]["kind"]["enum"] == [
        "public"
    ]


def test_a_rule_naming_nothing_fails_the_build() -> None:
    @sentry_schema_serializer(omit_from_public_schema={"kind.missing": "Internal."})
    class GhostParams(serializers.Serializer):
        kind = serializers.ChoiceField(choices=("public",))

    class GhostEndpoint(Endpoint):
        permission_classes = ()

        @extend_schema(parameters=[GhostParams])
        def get(self, request):
            pass

    with pytest.raises(SentryApiBuildError) as exc:
        _build(("ghost/", GhostEndpoint))
    assert "missing" in str(exc.value)


def test_a_parameter_given_explicitly_is_not_marked_required_by_the_serializer() -> None:
    """The explicit parameter replaced the serializer's field, so the rule is not its."""

    @sentry_schema_serializer(omit_from_public_schema={"kind.legacy": "Send kind explicitly."})
    class OverriddenParams(serializers.Serializer):
        kind = serializers.ChoiceField(choices=("legacy", "current"), default="legacy")

    class OverriddenEndpoint(Endpoint):
        permission_classes = ()

        @extend_schema(
            parameters=[OverriddenParams, OpenApiParameter("kind", str, description="Kind.")]
        )
        def get(self, request):
            pass

    kind = _query(_build(("overridden/", OverriddenEndpoint)), "overridden/")["kind"]
    assert kind["description"] == "Kind."
    assert "required" not in kind


# --- the check that marking parameters required changed nothing else ---

KIND = ("kind", "query")
OTHER = ("other", "query")


def _parameters() -> dict[tuple[str, str], Any]:
    return {
        KIND: {"name": "kind", "in": "query", "schema": {"type": "string", "enum": ["current"]}},
        OTHER: {"name": "other", "in": "query", "schema": {"type": "string"}},
    }


def test_marking_the_declared_parameter_passes_the_check() -> None:
    after = _parameters()
    after[KIND]["required"] = True
    omission_apply.check_required_parameters(_parameters(), after, {KIND})


def test_marking_an_undeclared_parameter_fails_the_check() -> None:
    after = _parameters()
    after[KIND]["required"] = True
    after[OTHER]["required"] = True
    with pytest.raises(omission_apply.OmissionError) as exc:
        omission_apply.check_required_parameters(_parameters(), after, {KIND})
    assert "other" in str(exc.value)


def test_changing_more_than_required_on_a_declared_parameter_fails_the_check() -> None:
    after = _parameters()
    after[KIND]["required"] = True
    after[KIND]["schema"] = {"type": "string"}
    with pytest.raises(omission_apply.OmissionError):
        omission_apply.check_required_parameters(_parameters(), after, {KIND})


def test_leaving_a_declared_parameter_optional_fails_the_check() -> None:
    with pytest.raises(omission_apply.OmissionError) as exc:
        omission_apply.check_required_parameters(_parameters(), _parameters(), {KIND})
    assert "kind" in str(exc.value)
