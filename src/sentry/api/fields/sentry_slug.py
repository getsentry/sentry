from __future__ import annotations

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from sentry.slug.errors import DEFAULT_SLUG_ERROR_MESSAGE, ORG_SLUG_ERROR_MESSAGE
from sentry.slug.patterns import MIXED_SLUG_PATTERN, ORG_SLUG_PATTERN


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
        error_messages=None,
        org_slug: bool = False,
        *args,
        **kwargs,
    ):
        # Avoid using mutable dict for error_messages defaults b/c all calls to
        # the function reuse this one instance, persisting changes between them.
        if error_messages is None:
            error_messages = self.default_error_messages.copy()

        pattern = MIXED_SLUG_PATTERN
        if org_slug:
            pattern = ORG_SLUG_PATTERN
            error_messages["invalid"] = ORG_SLUG_ERROR_MESSAGE

        super().__init__(pattern, error_messages=error_messages, *args, **kwargs)
