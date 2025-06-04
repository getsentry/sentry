from django.utils.translation import gettext_lazy as _

DEFAULT_SLUG_ERROR_MESSAGE = _(
    "Enter a valid slug consisting of lowercase letters, numbers, underscores or hyphens. "
    "It cannot be entirely numeric."
)

ORG_SLUG_ERROR_MESSAGE = _(
    "Enter a valid slug consisting of letters, numbers, or hyphens. "
    "It cannot be entirely numeric or start/end with a hyphen."
)
