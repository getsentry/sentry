from django.core.validators import RegexValidator

from sentry.slug.errors import DEFAULT_SLUG_ERROR_MESSAGE, ORG_SLUG_ERROR_MESSAGE
from sentry.slug.patterns import MIXED_SLUG_REGEX, ORG_SLUG_REGEX

no_numeric_validator = RegexValidator(
    regex=MIXED_SLUG_REGEX,
    message=DEFAULT_SLUG_ERROR_MESSAGE,
)

org_slug_validator = RegexValidator(
    regex=ORG_SLUG_REGEX,
    message=ORG_SLUG_ERROR_MESSAGE,
)
