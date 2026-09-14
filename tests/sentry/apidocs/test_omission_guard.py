from __future__ import annotations

from collections.abc import Callable, Sequence
from typing import Any, TypedDict
from unittest import mock

import pytest
from django.urls import path as url_path
from drf_spectacular.settings import spectacular_settings
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers

# Registers the extension mapping a response Serializer through its TypedDict,
# as the docs build does by importing it.
import sentry.apidocs.extensions  # noqa: F401
from sentry.api.base import Endpoint
from sentry.api.serializers.base import Serializer as ResponseSerializer
from sentry.apidocs.hooks import CustomGenerator
from sentry.apidocs.omissions import sentry_schema_serializer
from sentry.apidocs.utils import SentryApiBuildError
from sentry.conf.server import custom_parameter_sort

Hook = Callable[..., Any]


@sentry_schema_serializer(
    omit_from_public_schema={
        "internal_flag": "Internal.",
        "kind.internal": "Internal.",
        "mode.legacy": "Send mode explicitly.",
    },
    deprecate={"old_name": "Use name."},
)
class GuardedParams(serializers.Serializer):
    kind = serializers.ChoiceField(choices=("public", "internal"), help_text="Kind.")
    mode = serializers.ChoiceField(choices=("legacy", "current"), default="legacy")
    internal_flag = serializers.BooleanField(required=False)
    old_name = serializers.CharField(required=False, help_text="Old name.")


@sentry_schema_serializer(omit_from_public_schema={"kind.internal": "Internal."})
class GuardedBody(serializers.Serializer):
    kind = serializers.ChoiceField(choices=("public", "internal"), help_text="Kind.")
    caption = serializers.CharField(help_text="Caption.")


class UnrelatedParams(serializers.Serializer):
    query = serializers.CharField(required=False, help_text="Query.")


class GuardedEndpoint(Endpoint):
    permission_classes = ()

    @extend_schema(operation_id="guarded", parameters=[GuardedParams])
    def get(self, request):
        pass

    @extend_schema(operation_id="guardedBody", request=GuardedBody)
    def post(self, request):
        pass


class UnrelatedEndpoint(Endpoint):
    permission_classes = ()

    @extend_schema(operation_id="unrelated", parameters=[UnrelatedParams])
    def get(self, request):
        pass


def _build(hooks: Sequence[Hook] = ()) -> dict[str, Any]:
    """Build the way the docs build does, with `hooks` as later postprocessing."""
    patterns = [
        url_path("guarded/", GuardedEndpoint.as_view()),
        url_path("unrelated/", UnrelatedEndpoint.as_view()),
    ]
    with (
        mock.patch.object(spectacular_settings, "POSTPROCESSING_HOOKS", list(hooks)),
        mock.patch.object(spectacular_settings, "SORT_OPERATION_PARAMETERS", custom_parameter_sort),
    ):
        return CustomGenerator(patterns=patterns).get_schema(request=None, public=True)


def _parameters(result: dict[str, Any], route: str) -> list[dict[str, Any]]:
    return result["paths"][f"/{route}"]["get"]["parameters"]


def _parameter(result: dict[str, Any], route: str, name: str) -> dict[str, Any]:
    return next(p for p in _parameters(result, route) if p["name"] == name)


def _withheld(result: dict[str, Any]) -> bool:
    """Whether this build is the one with omissions applied."""
    return "internal" not in _parameter(result, "guarded/", "kind")["schema"]["enum"]


def test_a_build_with_every_kind_of_omission_passes_the_guard() -> None:
    result = _build()
    names = {p["name"] for p in _parameters(result, "guarded/")}
    assert "internal_flag" not in names
    assert _parameter(result, "guarded/", "kind")["schema"]["enum"] == ["public"]
    assert _parameter(result, "guarded/", "mode")["required"] is True
    # OpenAPI marks a deprecated parameter on the parameter, where SDK generators read it.
    old_name = _parameter(result, "guarded/", "old_name")
    assert old_name["deprecated"] is True
    assert "deprecated" not in old_name["schema"]
    body = result["components"]["schemas"]["GuardedBody"]["properties"]["kind"]
    assert body["enum"] == ["public"]


def test_reordering_parameters_is_not_a_difference() -> None:
    def reverse(result: dict[str, Any], **kwargs: Any) -> dict[str, Any]:
        result["paths"]["/guarded/"]["get"]["parameters"].reverse()
        return result

    _build([reverse])


def test_a_withheld_choice_restored_by_a_later_step_fails_the_build() -> None:
    def restore(result: dict[str, Any], **kwargs: Any) -> dict[str, Any]:
        _parameter(result, "guarded/", "kind")["schema"]["enum"] = ["public", "internal"]
        return result

    with pytest.raises(SentryApiBuildError) as exc:
        _build([restore])
    assert "internal" in str(exc.value)


def test_an_omitted_field_restored_by_a_later_step_fails_the_build() -> None:
    def restore(result: dict[str, Any], **kwargs: Any) -> dict[str, Any]:
        parameters = _parameters(result, "guarded/")
        if not any(p["name"] == "internal_flag" for p in parameters):
            parameters.append(
                {"in": "query", "name": "internal_flag", "schema": {"type": "boolean"}}
            )
        return result

    with pytest.raises(SentryApiBuildError) as exc:
        _build([restore])
    assert "internal_flag" in str(exc.value)


def test_an_omission_that_changes_another_operation_fails_the_build() -> None:
    def spill(result: dict[str, Any], **kwargs: Any) -> dict[str, Any]:
        if _withheld(result):
            _parameter(result, "unrelated/", "query")["description"] = "Changed."
        return result

    with pytest.raises(SentryApiBuildError) as exc:
        _build([spill])
    assert "unrelated" in str(exc.value)


def test_an_omission_that_changes_another_field_of_its_component_fails_the_build() -> None:
    def spill(result: dict[str, Any], **kwargs: Any) -> dict[str, Any]:
        if _withheld(result):
            result["components"]["schemas"]["GuardedBody"]["properties"]["caption"]["maxLength"] = 1
        return result

    with pytest.raises(SentryApiBuildError) as exc:
        _build([spill])
    assert "caption" in str(exc.value)


def test_marking_a_parameter_required_that_no_default_rule_covers_fails_the_build() -> None:
    def spill(result: dict[str, Any], **kwargs: Any) -> dict[str, Any]:
        if _withheld(result):
            _parameter(result, "guarded/", "old_name")["required"] = True
        return result

    with pytest.raises(SentryApiBuildError) as exc:
        _build([spill])
    assert "old_name" in str(exc.value)


@sentry_schema_serializer(omit_from_public_schema={"secret": "Internal."})
class OnlyRequiredFieldOmittedBody(serializers.Serializer):
    secret = serializers.CharField(help_text="Secret.")
    note = serializers.CharField(required=False, help_text="Note.")


class OnlyRequiredFieldOmittedEndpoint(Endpoint):
    permission_classes = ()

    @extend_schema(operation_id="onlyRequiredOmitted", request=OnlyRequiredFieldOmittedBody)
    def put(self, request):
        pass


def _build_body(hooks: Sequence[Hook] = ()) -> dict[str, Any]:
    patterns = [url_path("body/", OnlyRequiredFieldOmittedEndpoint.as_view())]
    with mock.patch.object(spectacular_settings, "POSTPROCESSING_HOOKS", list(hooks)):
        return CustomGenerator(patterns=patterns).get_schema(request=None, public=True)


def test_omitting_a_bodys_only_required_field_leaves_the_body_optional() -> None:
    """drf-spectacular requires a body only while its serializer has a required field."""
    result = _build_body()
    assert "required" not in result["paths"]["/body/"]["put"]["requestBody"]
    assert (
        "secret"
        not in result["components"]["schemas"]["OnlyRequiredFieldOmittedBody"]["properties"]
    )


def test_a_body_made_optional_without_an_omission_behind_it_fails_the_build() -> None:
    def spill(result: dict[str, Any], **kwargs: Any) -> dict[str, Any]:
        properties = result["components"]["schemas"]["OnlyRequiredFieldOmittedBody"]["properties"]
        body = result["paths"]["/body/"]["put"]["requestBody"]
        if "secret" not in properties:
            body.pop("required", None)
            body["description"] = "Changed."
        return result

    with pytest.raises(SentryApiBuildError) as exc:
        _build_body([spill])
    assert "description" in str(exc.value)


def test_an_explicit_parameter_is_outside_the_guard() -> None:
    """A hand-written parameter is identical in both builds, so nothing to claim."""

    class ExplicitEndpoint(Endpoint):
        permission_classes = ()

        @extend_schema(
            operation_id="explicit",
            parameters=[OpenApiParameter("kind", str, enum=["public", "internal"])],
        )
        def get(self, request):
            pass

    patterns = [url_path("explicit/", ExplicitEndpoint.as_view())]
    with mock.patch.object(spectacular_settings, "POSTPROCESSING_HOOKS", []):
        result = CustomGenerator(patterns=patterns).get_schema(request=None, public=True)
    enum = result["paths"]["/explicit/"]["get"]["parameters"][0]["schema"]["enum"]
    assert sorted(enum) == ["internal", "public"]


class NestedShape(serializers.Serializer):
    token = serializers.CharField(help_text="Token.")


@sentry_schema_serializer(deprecate={"shape": "Use token directly."})
class DeprecatedNestedBody(serializers.Serializer):
    # No help_text: a bare $ref, which only the deprecated build wraps in allOf.
    shape = NestedShape()
    name = serializers.CharField(help_text="Name.")


class DeprecatedNestedEndpoint(Endpoint):
    permission_classes = ()

    @extend_schema(operation_id="deprecatedNested", request=DeprecatedNestedBody)
    def post(self, request):
        pass


@sentry_schema_serializer(omit_from_public_schema={"secret": "Internal."})
class GuardedItem(TypedDict):
    name: str
    secret: str


class GuardedTypedResponse(TypedDict):
    title: str
    owner: GuardedItem
    items: list[GuardedItem]


class GuardedTypedResponseSerializer(ResponseSerializer):
    def serialize(self, obj: Any, attrs: Any, user: Any, **kwargs: Any) -> GuardedTypedResponse:
        raise NotImplementedError


class GuardedTypedEndpoint(Endpoint):
    permission_classes = ()

    @extend_schema(operation_id="typed", responses={200: GuardedTypedResponseSerializer})
    def get(self, request):
        pass


def _build_typed(hooks: Sequence[Hook] = ()) -> dict[str, Any]:
    patterns = [url_path("typed/", GuardedTypedEndpoint.as_view())]
    with mock.patch.object(spectacular_settings, "POSTPROCESSING_HOOKS", list(hooks)):
        return CustomGenerator(patterns=patterns).get_schema(request=None, public=True)


def _typed_item(result: dict[str, Any], where: str) -> dict[str, Any]:
    """The GuardedItem object inside the response, as the owner or a list item."""
    response = result["components"]["schemas"]["GuardedTypedResponse"]["properties"]
    return response["owner"] if where == "owner" else response["items"]["items"]


def test_a_typed_dict_omission_passes_the_guard_wherever_it_is_nested() -> None:
    result = _build_typed()
    assert "secret" not in _typed_item(result, "owner")["properties"]
    assert "secret" not in _typed_item(result, "items")["properties"]


@pytest.mark.parametrize("where", ("owner", "items"))
def test_a_typed_dict_omission_restored_by_a_later_step_fails_the_build(where: str) -> None:
    def restore(result: dict[str, Any], **kwargs: Any) -> dict[str, Any]:
        _typed_item(result, where)["properties"].setdefault("secret", {"type": "string"})
        return result

    with pytest.raises(SentryApiBuildError) as exc:
        _build_typed([restore])
    assert "secret" in str(exc.value)


def test_a_typed_dict_omission_that_changes_a_sibling_field_fails_the_build() -> None:
    def spill(result: dict[str, Any], **kwargs: Any) -> dict[str, Any]:
        owner = _typed_item(result, "owner")["properties"]
        if "secret" not in owner:
            owner["name"]["maxLength"] = 1
        return result

    with pytest.raises(SentryApiBuildError) as exc:
        _build_typed([spill])
    assert "name" in str(exc.value)


def test_deprecating_a_nested_serializer_field_passes_the_guard() -> None:
    """drf-spectacular wraps a deprecated $ref as allOf, so it is not a leaf change."""
    patterns = [url_path("nested/", DeprecatedNestedEndpoint.as_view())]
    with mock.patch.object(spectacular_settings, "POSTPROCESSING_HOOKS", []):
        result = CustomGenerator(patterns=patterns).get_schema(request=None, public=True)
    shape = result["components"]["schemas"]["DeprecatedNestedBody"]["properties"]["shape"]
    assert shape["deprecated"] is True
    assert shape["allOf"] == [{"$ref": "#/components/schemas/NestedShape"}]
