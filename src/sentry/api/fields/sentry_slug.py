from __future__ import annotations

from django.utils.translation import gettext_lazy as _
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

# (?![0-9]+$) - Negative lookahead to ensure the slug is not entirely numeric
# [a-z0-9_\-] - Matches lowercase letters, numbers, underscores, and hyphens
MIXED_SLUG_PATTERN = r"^(?![0-9]+$)[a-z0-9_\-]+$"
DEFAULT_SLUG_ERROR_MESSAGE = _(
    "Enter a valid slug consisting of lowercase letters, numbers, underscores or hyphens. "
    "It cannot be entirely numeric."
)


@extend_schema_field(field=OpenApiTypes.STR)
class SentrySlugField(serializers.RegexField):
    """
    A regex field which validates that the input is a valid slug. Allowed
    characters are lowercase letters, numbers, underscores, and hyphens. The
    slug cannot be entirely numeric.
    """

    default_error_messages = {
        "invalid": DEFAULT_SLUG_ERROR_MESSAGE,
    }

    def __init__(
        self,
        regex=MIXED_SLUG_PATTERN,
        error_messages=None,
        *args,
        **kwargs,
    ):
        # Avoid using mutable dict for error_messages defaults b/c all calls to
        # the function reuse this one instance, persisting changes between them.
        if error_messages is None:
            error_messages = self.default_error_messages
        super().__init__(regex=regex, error_messages=error_messages, *args, **kwargs)
