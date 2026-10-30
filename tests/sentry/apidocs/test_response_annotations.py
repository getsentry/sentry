from __future__ import annotations

from typing import TYPE_CHECKING, Any, TypedDict

from rest_framework.response import Response

from sentry.apidocs.response_annotations import (
    annotated_response,
    inferred_response_serializer,
    response_type,
)
from sentry.apidocs.response_types import DetailResponse, ValidationErrorResponse
from sentry.apidocs.utils import inline_sentry_response_serializer

if TYPE_CHECKING:
    from sentry.apidocs.response_types import DetailResponse as OnlyTypeChecked


class AnnotatedItem(TypedDict):
    id: str


class AnnotatedOther(TypedDict):
    name: str


def single(request: Any) -> Response[AnnotatedItem]:
    raise NotImplementedError


def with_error_arms(
    request: Any,
) -> Response[AnnotatedItem] | Response[DetailResponse] | Response[ValidationErrorResponse]:
    raise NotImplementedError


def two_success_arms(request: Any) -> Response[AnnotatedItem] | Response[AnnotatedOther]:
    raise NotImplementedError


def only_error_arms(request: Any) -> Response[DetailResponse]:
    raise NotImplementedError


def no_content(request: Any) -> Response[None]:
    raise NotImplementedError


def bare_member(request: Any) -> Response | Response[list[AnnotatedItem]]:
    raise NotImplementedError


def bare(request: Any) -> Response:
    raise NotImplementedError


def unannotated(request: Any):
    raise NotImplementedError


def type_checking_only(request: Any) -> Response[OnlyTypeChecked]:
    raise NotImplementedError


class Handlers:
    def get(self, request: Any) -> Response[AnnotatedItem]:
        message = """
less indented than the method
"""
        raise NotImplementedError(message)


def test_single_arm() -> None:
    annotated = annotated_response(single, "GET /single/")
    assert annotated is not None
    assert annotated.types == (AnnotatedItem,)


def test_error_arms_are_ignored() -> None:
    annotated = annotated_response(with_error_arms, "GET /errors/")
    assert annotated is not None
    assert annotated.types == (AnnotatedItem,)


def test_every_success_arm_is_kept() -> None:
    annotated = annotated_response(two_success_arms, "GET /two/")
    assert annotated is not None
    assert annotated.types == (AnnotatedItem, AnnotatedOther)
    assert response_type(annotated.types) == AnnotatedItem | AnnotatedOther


def test_only_error_arms_declare_nothing() -> None:
    assert annotated_response(only_error_arms, "GET /only-errors/") is None


def test_no_content() -> None:
    annotated = annotated_response(no_content, "DELETE /no-content/")
    assert annotated is not None
    assert annotated.types == ()


def test_bare_member_is_ignored() -> None:
    annotated = annotated_response(bare_member, "GET /bare-member/")
    assert annotated is not None
    assert annotated.types == (list[AnnotatedItem],)


def test_untyped_handlers_declare_nothing() -> None:
    assert annotated_response(bare, "GET /bare/") is None
    assert annotated_response(unannotated, "GET /unannotated/") is None


def test_argument_imported_only_for_type_checking_declares_nothing() -> None:
    assert annotated_response(type_checking_only, "GET /type-checking/") is None


def test_method_holding_less_indented_string() -> None:
    annotated = annotated_response(Handlers().get, "GET /handlers/")
    assert annotated is not None
    assert annotated.types == (AnnotatedItem,)


class InferredNamed(TypedDict):
    id: str


class InferredReused(TypedDict):
    id: str


class InferredClash(TypedDict):
    id: str


def test_inferred_serializer_names() -> None:
    assert inferred_response_serializer(InferredNamed).__name__ == "InferredNamed"
    assert inferred_response_serializer(list[InferredNamed]).__name__ == "ListInferredNamedResponse"
    assert (
        inferred_response_serializer(dict[str, InferredNamed]).__name__
        == "DictInferredNamedResponse"
    )
    assert (
        inferred_response_serializer(InferredNamed | AnnotatedOther).__name__
        == "InferredNamedOrAnnotatedOtherResponse"
    )


def test_inferred_serializer_reuses_declared_one() -> None:
    declared = inline_sentry_response_serializer("ListInferredReusedResponse", list[InferredReused])

    assert inferred_response_serializer(list[InferredReused]) is declared


def test_inferred_serializer_avoids_a_clashing_name() -> None:
    inline_sentry_response_serializer("InferredClash", list[InferredClash])

    inferred = inferred_response_serializer(InferredClash)

    assert inferred.__name__ == "InferredClash2"
    assert inferred.typeSchema is InferredClash  # type: ignore[attr-defined]
