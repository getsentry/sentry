from __future__ import annotations

from typing import TYPE_CHECKING, TypedDict, Unpack

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from sentry.db.models.fields.slug import DEFAULT_SLUG_MAX_LENGTH
from sentry.utils.slug import (
    DEFAULT_SLUG_ERROR_MESSAGE,
    MIXED_SLUG_PATTERN,
    ORG_SLUG_ERROR_MESSAGE,
    ORG_SLUG_PATTERN,
)

if TYPE_CHECKING:
    from collections.abc import Sequence

    from django_stubs_ext import StrOrPromise
    from rest_framework.fields import _DefaultInitial
    from rest_framework.validators import Validator


class _SentrySerializerSlugFieldKwargs(TypedDict, total=False):
    read_only: bool
    write_only: bool
    required: bool | None
    default: _DefaultInitial[StrOrPromise]
    initial: _DefaultInitial[str]
    source: str | None
    label: StrOrPromise | None
    help_text: StrOrPromise | None
    style: dict[str, object] | None
    validators: Sequence[Validator[str]] | None
    allow_null: bool
    allow_blank: bool
    trim_whitespace: bool
    min_length: int | None


@extend_schema_field(field=OpenApiTypes.STR)
class SentrySerializerSlugField(serializers.RegexField):
    """
    A regex field which validates that the input is a valid slug. Default
    allowed characters are lowercase letters, numbers, underscores, and hyphens.
    The slug cannot be entirely numeric.
    """

    default_error_messages = {
        "invalid": DEFAULT_SLUG_ERROR_MESSAGE,
    }

    def __init__(
        self,
        error_messages: dict[str, StrOrPromise] | None = None,
        org_slug: bool = False,
        max_length: int = DEFAULT_SLUG_MAX_LENGTH,
        **kwargs: Unpack[_SentrySerializerSlugFieldKwargs],
    ) -> None:
        # Avoid using mutable dict for error_messages defaults b/c all calls to
        # the function reuse this one instance, persisting changes between them.
        if error_messages is None:
            error_messages = self.default_error_messages.copy()

        pattern = MIXED_SLUG_PATTERN
        if org_slug:
            pattern = ORG_SLUG_PATTERN
            error_messages["invalid"] = ORG_SLUG_ERROR_MESSAGE

        super().__init__(pattern, error_messages=error_messages, max_length=max_length, **kwargs)
