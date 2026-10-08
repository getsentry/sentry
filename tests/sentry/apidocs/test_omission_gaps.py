"""Where the omit/deprecate declarations cannot reach. Exploratory, not committed.

Each GAP test asserts what we would want to work; each PROBE asserts a case we
expect is already covered. Run it to see which is which.
"""

from __future__ import annotations

from collections.abc import Callable, Sequence
from typing import Any, Literal, TypedDict
from unittest import mock

import pytest
from django.urls import path as url_path
from drf_spectacular.settings import spectacular_settings
from drf_spectacular.utils import extend_schema, extend_schema_field, inline_serializer
from rest_framework import serializers

# Registers the extension that maps a response Serializer through its TypedDict,
# as the docs build does by importing it.
import sentry.apidocs.extensions  # noqa: F401
from sentry.api.base import Endpoint
from sentry.api.serializers.base import Serializer as ResponseSerializer
from sentry.api.serializers.rest_framework.base import CamelSnakeSerializer
from sentry.apidocs.hooks import CustomGenerator
from sentry.apidocs.omissions import sentry_schema_serializer
from sentry.apidocs.utils import SentryApiBuildError
from sentry.conf.server import custom_parameter_sort

Hook = Callable[..., Any]


def _build(*routes: tuple[str, type[Endpoint]], hooks: Sequence[Hook] = ()) -> dict[str, Any]:
    patterns = [url_path(route, view.as_view()) for route, view in routes]
    with (
        mock.patch.object(spectacular_settings, "POSTPROCESSING_HOOKS", list(hooks)),
        mock.patch.object(spectacular_settings, "SORT_OPERATION_PARAMETERS", custom_parameter_sort),
    ):
        return CustomGenerator(patterns=patterns).get_schema(request=None, public=True)


def _query(schema: dict[str, Any], route: str, name: str) -> dict[str, Any]:
    parameters = schema["paths"][f"/{route}"]["get"]["parameters"]
    return next(p for p in parameters if p["name"] == name)


def _component(schema: dict[str, Any], name: str) -> dict[str, Any]:
    # drf-spectacular names a component without the Serializer suffix.
    return schema["components"]["schemas"][name.removesuffix("Serializer")]


def _get_endpoint(**schema_kwargs: Any) -> type[Endpoint]:
    class GapEndpoint(Endpoint):
        permission_classes = ()

        @extend_schema(**schema_kwargs)
        def get(self, request):
            pass

    return GapEndpoint


def _post_endpoint(**schema_kwargs: Any) -> type[Endpoint]:
    class GapEndpoint(Endpoint):
        permission_classes = ()

        @extend_schema(**schema_kwargs)
        def post(self, request):
            pass

    return GapEndpoint


# --- response types built from TypedDicts ---


class LiteralResponse(TypedDict):
    name: str
    kind: Literal["public", "internal"]


class LiteralResponseSerializer(ResponseSerializer):
    def serialize(self, obj: Any, attrs: Any, user: Any, **kwargs: Any) -> LiteralResponse:
        raise NotImplementedError


def test_GAP_a_typed_dict_response_can_withhold_a_literal_choice() -> None:
    sentry_schema_serializer(omit_from_public_schema={"kind.internal": "Internal."})(
        LiteralResponse
    )
    schema = _build(
        (
            "literal/",
            _get_endpoint(operation_id="literal", responses={200: LiteralResponseSerializer}),
        )
    )
    assert _component(schema, "LiteralResponseSerializer")["properties"]["kind"]["enum"] == [
        "public"
    ]


@sentry_schema_serializer(omit_from_public_schema={"secret": "Internal."})
class OmittingResponse(TypedDict):
    name: str
    secret: str


class OmittingResponseSerializer(ResponseSerializer):
    def serialize(self, obj: Any, attrs: Any, user: Any, **kwargs: Any) -> OmittingResponse:
        raise NotImplementedError


def test_PROBE_a_typed_dict_response_can_omit_a_field() -> None:
    schema = _build(
        (
            "omitting/",
            _get_endpoint(operation_id="omitting", responses={200: OmittingResponseSerializer}),
        )
    )
    assert "secret" not in _component(schema, "OmittingResponseSerializer")["properties"]


def test_GAP_the_guard_checks_a_typed_dict_omission() -> None:
    def restore(result: dict[str, Any], **kwargs: Any) -> dict[str, Any]:
        properties = result["components"]["schemas"]["OmittingResponse"]["properties"]
        properties.setdefault("secret", {"type": "string"})
        return result

    with pytest.raises(SentryApiBuildError):
        _build(
            (
                "omitting/",
                _get_endpoint(operation_id="omitting", responses={200: OmittingResponseSerializer}),
            ),
            hooks=[restore],
        )


class PlainResponse(TypedDict):
    name: str
    secret: str


class DeclaredOnResponseSerializer(ResponseSerializer):
    def serialize(self, obj: Any, attrs: Any, user: Any, **kwargs: Any) -> PlainResponse:
        raise NotImplementedError


def test_REFUSED_a_response_serializer_class_names_the_typed_dict_to_declare_on() -> None:
    with pytest.raises(ValueError) as exc:
        sentry_schema_serializer(omit_from_public_schema={"secret": "Internal."})(
            DeclaredOnResponseSerializer
        )
    assert "move this decorator to PlainResponse" in str(exc.value)


# --- enums that do not come from a ChoiceField ---


@extend_schema_field({"type": "string", "enum": ["public", "internal"]})
class KindField(serializers.CharField):
    pass


@sentry_schema_serializer(omit_from_public_schema={"kind.internal": "Internal."})
class CustomFieldParams(serializers.Serializer):
    kind = KindField(help_text="Kind.")


def test_GAP_a_custom_field_schema_can_withhold_a_choice() -> None:
    schema = _build(
        ("custom/", _get_endpoint(operation_id="custom", parameters=[CustomFieldParams]))
    )
    assert _query(schema, "custom/", "kind")["schema"]["enum"] == ["public"]


@sentry_schema_serializer(omit_from_public_schema={"kind.internal": "Internal."})
class ContextChoiceParams(serializers.Serializer):
    kind = serializers.ChoiceField(choices=("public",), help_text="Kind.")

    def get_fields(self):
        fields = super().get_fields()
        # Choices that depend on who is asking, as feature-gated values do.
        if self.context.get("view") is not None:
            fields["kind"].choices = ("public", "internal")
        return fields


def test_GAP_choices_computed_from_context_can_be_withheld() -> None:
    schema = _build(
        ("context/", _get_endpoint(operation_id="context", parameters=[ContextChoiceParams]))
    )
    assert _query(schema, "context/", "kind")["schema"]["enum"] == ["public"]


# --- declarations refused by design ---


def test_GAP_a_single_choice_can_be_deprecated() -> None:
    @sentry_schema_serializer(deprecate={"kind.legacy": "Use current."})
    class DeprecatedChoiceParams(serializers.Serializer):
        kind = serializers.ChoiceField(choices=("legacy", "current"), help_text="Kind.")

    schema = _build(
        (
            "deprecated/",
            _get_endpoint(operation_id="deprecated", parameters=[DeprecatedChoiceParams]),
        )
    )
    kind = _query(schema, "deprecated/", "kind")
    assert "legacy" in kind["schema"]["enum"]
    assert "deprecated" in kind["description"].lower()


class SharedShape(serializers.Serializer):
    token = serializers.CharField(help_text="Token.")
    caption = serializers.CharField(help_text="Caption.")


def test_GAP_a_nested_field_can_be_withheld_for_one_parent_only() -> None:
    @sentry_schema_serializer(omit_from_public_schema={"shape.token": "Internal."})
    class HoldsSharedShape(serializers.Serializer):
        shape = SharedShape(help_text="Shape.")

    schema = _build(
        ("holder/", _post_endpoint(operation_id="holder", request=HoldsSharedShape)),
        ("direct/", _post_endpoint(operation_id="direct", request=SharedShape)),
    )
    assert "token" in _component(schema, "SharedShape")["properties"]
    holder_shape = _component(schema, "HoldsSharedShape")["properties"]["shape"]
    assert "token" not in str(holder_shape)


def test_GAP_an_inline_serializer_can_withhold_a_choice() -> None:
    inline = inline_serializer(
        name="InlineParams",
        fields={"kind": serializers.ChoiceField(choices=("public", "internal"), help_text="Kind.")},
    )
    sentry_schema_serializer(omit_from_public_schema={"kind.internal": "Internal."})(inline)
    schema = _build(("inline/", _get_endpoint(operation_id="inline", parameters=[inline])))
    assert _query(schema, "inline/", "kind")["schema"]["enum"] == ["public"]


# --- cases expected to be covered ---


@sentry_schema_serializer(omit_from_public_schema={"kinds.internal": "Internal."})
class MultipleChoiceParams(serializers.Serializer):
    kinds = serializers.MultipleChoiceField(choices=("public", "internal"), help_text="Kinds.")


def test_PROBE_a_multiple_choice_value_can_be_withheld() -> None:
    schema = _build(
        ("multiple/", _get_endpoint(operation_id="multiple", parameters=[MultipleChoiceParams]))
    )
    assert _query(schema, "multiple/", "kinds")["schema"]["items"]["enum"] == ["public"]


@sentry_schema_serializer(omit_from_public_schema={"kind.internal": "Internal."})
class NullableChoiceParams(serializers.Serializer):
    kind = serializers.ChoiceField(
        choices=("public", "internal"), allow_null=True, required=False, help_text="Kind."
    )


def test_PROBE_a_nullable_choice_value_can_be_withheld() -> None:
    schema = _build(
        ("nullable/", _get_endpoint(operation_id="nullable", parameters=[NullableChoiceParams]))
    )
    assert "internal" not in _query(schema, "nullable/", "kind")["schema"]["enum"]


@sentry_schema_serializer(omit_from_public_schema={"status.2": "Internal."})
class IntegerChoiceParams(serializers.Serializer):
    status = serializers.ChoiceField(choices=(1, 2), help_text="Status.")


def test_PROBE_an_integer_choice_value_can_be_withheld() -> None:
    schema = _build(
        ("integer/", _get_endpoint(operation_id="integer", parameters=[IntegerChoiceParams]))
    )
    assert _query(schema, "integer/", "status")["schema"]["enum"] == [1]


@sentry_schema_serializer(omit_from_public_schema={"display_type.internal": "Internal."})
class CamelSnakeBody(CamelSnakeSerializer):
    display_type = serializers.ChoiceField(choices=("line", "internal"), help_text="Display.")


def test_PROBE_a_camel_snake_serializer_choice_can_be_withheld() -> None:
    schema = _build(("camel/", _post_endpoint(operation_id="camel", request=CamelSnakeBody)))
    properties = _component(schema, "CamelSnakeBody")["properties"]
    assert properties["display_type"]["enum"] == ["line"]


@sentry_schema_serializer(omit_from_public_schema={"kind.internal": "Internal."})
class ReusedSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=("public", "internal"), help_text="Kind.")


def test_PROBE_one_declaring_serializer_used_as_parameters_body_and_response() -> None:
    class ReusedEndpoint(Endpoint):
        permission_classes = ()

        @extend_schema(operation_id="reusedGet", parameters=[ReusedSerializer])
        def get(self, request):
            pass

        @extend_schema(
            operation_id="reusedPost",
            request=ReusedSerializer(many=True),
            responses={200: ReusedSerializer},
        )
        def post(self, request):
            pass

    schema = _build(("reused/", ReusedEndpoint))
    assert _query(schema, "reused/", "kind")["schema"]["enum"] == ["public"]
    # drf-spectacular names the component without the Serializer suffix.
    assert _component(schema, "Reused")["properties"]["kind"]["enum"] == ["public"]
