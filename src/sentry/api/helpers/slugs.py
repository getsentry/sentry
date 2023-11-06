from django.core.validators import RegexValidator
from django.utils.regex_helper import _lazy_re_compile

from sentry.api.fields.sentry_slug import DEFAULT_SLUG_ERROR_MESSAGE, MIXED_SLUG_PATTERN


def validate_sentry_slug(slug: str) -> None:
    """
    Validates a sentry slug matches MIXED_SLUG_PATTERN. Raises ValidationError if it does not.
    """
    validator = RegexValidator(
        _lazy_re_compile(MIXED_SLUG_PATTERN),
        DEFAULT_SLUG_ERROR_MESSAGE,
        "invalid",
    )
    validator(slug)
