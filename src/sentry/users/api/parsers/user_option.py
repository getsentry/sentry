"""Types and storage keys for the display-preference contract.

`UserOptionsSerializer` stays in `endpoints.user_details`, where it has always
lived and where `users.models.user_option` and getsentry both import it from.
This module holds only what is new: the payload type, the storage-key map, and
the shared write helper, so `UserDetailsEndpoint` and `UserOptionsEndpoint`
agree on all three.
"""

from collections.abc import Mapping
from typing import TYPE_CHECKING, Literal, TypedDict

from django.utils.translation import gettext_lazy as _

from sentry.users.models.user import User
from sentry.utils.dates import get_timezone_choices

if TYPE_CHECKING:
    from django.utils.functional import _StrPromise  # fake type added by django-stubs

TIMEZONE_CHOICES = get_timezone_choices()

StacktraceOrderValue = Literal["-1", "1", "2"]
Theme = Literal["light", "dark", "system"]
DefaultIssueEvent = Literal["recommended", "latest", "oldest"]

# Annotating the choices ties them to the Literal types above: a choice value that is
# not part of the Literal fails type checking. The reverse does not hold, so a Literal
# member with no matching choice passes silently.
STACKTRACE_ORDER_CHOICES: "tuple[tuple[StacktraceOrderValue, _StrPromise], ...]" = (
    ("-1", _("Default (let Sentry decide)")),
    ("1", _("Most recent call last")),
    ("2", _("Most recent call first")),
)
THEME_CHOICES: "tuple[tuple[Theme, _StrPromise], ...]" = (
    ("light", _("Light")),
    ("dark", _("Dark")),
    ("system", _("Default to system")),
)
DEFAULT_ISSUE_EVENT_CHOICES: "tuple[tuple[DefaultIssueEvent, _StrPromise], ...]" = (
    ("recommended", _("Recommended")),
    ("latest", _("Latest")),
    ("oldest", _("Oldest")),
)

# Every field name on UserOptionsSerializer. Keeping this as a Literal lets both
# UserOptionsData and OPTION_KEY_MAP below be checked against one another.
UserOptionField = Literal[
    "language",
    "stacktraceOrder",
    "timezone",
    "clock24Hours",
    "theme",
    "defaultIssueEvent",
    "prefersIssueDetailsStreamlinedUI",
]


class UserOptionsData(TypedDict, total=False):
    """The validated display-preference payload.

    Mirrors the fields on UserOptionsSerializer. Every field is optional because
    the serializer is always used with partial=True.
    """

    language: str
    stacktraceOrder: StacktraceOrderValue
    timezone: str
    clock24Hours: bool
    theme: Theme
    defaultIssueEvent: DefaultIssueEvent
    prefersIssueDetailsStreamlinedUI: bool


# Maps each API field to the key the value is stored under in UserOption. An entry whose
# key is not a UserOptionsData field fails type checking. An entry that is *missing* does
# not: DRF declares serializer fields at runtime, so type checking cannot see them. A
# field added to the serializer but not to this map validates and is then never written.
OPTION_KEY_MAP: Mapping[UserOptionField, str] = {
    "theme": "theme",
    "language": "language",
    "timezone": "timezone",
    "stacktraceOrder": "stacktrace_order",
    "defaultIssueEvent": "default_issue_event",
    "clock24Hours": "clock_24_hours",
    "prefersIssueDetailsStreamlinedUI": "prefers_issue_details_streamlined_ui",
}


def write_user_options(user: User, options: UserOptionsData) -> None:
    """Persist the supplied display preferences. Fields absent from `options` are left alone."""
    # Imported lazily: UserOption.write_relocation_import imports UserOptionsSerializer
    # from here, so a module-level import would close the cycle.
    from sentry.users.models.user_option import UserOption

    for api_field, option_key in OPTION_KEY_MAP.items():
        if api_field in options:
            UserOption.objects.set_value(user=user, key=option_key, value=options[api_field])
