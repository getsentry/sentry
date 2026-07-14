from __future__ import annotations

from enum import StrEnum
from typing import TYPE_CHECKING, Any, Literal

from django.utils.translation import gettext_lazy as _

if TYPE_CHECKING:
    from django.utils.functional import _StrPromise  # fake type added by django-stubs


class SortOptions(StrEnum):
    DATE = "date"
    NEW = "new"
    TRENDS = "trends"
    FREQ = "freq"
    USER = "user"
    INBOX = "inbox"
    RECOMMENDED = "recommended"

    @classmethod
    def as_choices(cls) -> tuple[tuple[SortOptions, _StrPromise], ...]:
        return (
            (cls.DATE, _("Last Seen")),
            (cls.NEW, _("First Seen")),
            (cls.TRENDS, _("Trends")),
            (cls.FREQ, _("Events")),
            (cls.USER, _("Users")),
            (cls.INBOX, _("Date Added")),
            (cls.RECOMMENDED, _("Recommended")),
        )


SORT_LITERALS = Literal["date", "new", "trends", "freq", "user", "inbox", "recommended"]


class Visibility:
    ORGANIZATION = "organization"
    OWNER = "owner"
    OWNER_PINNED = "owner_pinned"

    @classmethod
    def as_choices(cls) -> list[tuple[str, Any]]:
        # Note that the pinned value may not always be a visibility we want to
        # expose. The pinned search API explicitly will set this visibility,
        # but the saved search API should not allow it to be set
        return [
            (cls.ORGANIZATION, _("Organization")),
            (cls.OWNER, _("Only for me")),
            (cls.OWNER_PINNED, _("My Pinned Search")),
        ]
