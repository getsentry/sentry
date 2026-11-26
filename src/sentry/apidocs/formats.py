import logging
import re
from dataclasses import dataclass
from datetime import datetime
from typing import Annotated, NewType
from urllib.parse import urlsplit
from uuid import UUID

from sentry.utils.env import in_test_environment

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ApiFormat:
    """
    Adds JSON Schema keywords to a TypedDict response field in the public API schema.

    Wrap the field type in ``Annotated``, or use one of the aliases below. Type checkers
    see only the inner type:

        class BuildResponse(TypedDict):
            dateAdded: Annotated[IsoDateTime | None, ApiDescription("When the build was uploaded")]

    Each keyword that is set is added to the field's schema next to its ``type``.
    """

    format: str | None = None
    pattern: str | None = None
    max_length: int | None = None

    def schema(self) -> dict[str, str | int]:
        keywords: dict[str, str | int] = {}
        if self.format is not None:
            keywords["format"] = self.format
        if self.pattern is not None:
            keywords["pattern"] = self.pattern
        if self.max_length is not None:
            keywords["maxLength"] = self.max_length
        return keywords


# A git ref name as `git check-ref-format --allow-onelevel` accepts it, such as `main`,
# `feature/xyz` or `refs/heads/main`, or an empty string, which uploads send when there's
# no ref. The rules, in order: no leading `/`, no trailing `/` or `.`, no `//` or `..`,
# no component that starts with `.` or ends with `.lock`, no `@{`, not `@` alone, and no
# control characters, spaces or `~^:?*[\`.
GIT_REF_PATTERN_OPTIONAL_EMPTY = (
    r"^(?:(?!/)(?!.*/$)(?!.*\.$)(?!.*//)(?!.*\.\.)(?!(?:.*/)?\.)(?!.*\.lock(?:/|$))"
    r"(?!.*@\{)(?!@$)[^\x00-\x20\x7f~^:?*\[\\]+)?$"
)
GIT_REF_MAX_LENGTH = 255

# The string types behind IsoDateTime and Url. They're NewTypes, so mypy rejects a plain
# `str` where a response field expects one: build values with iso_datetime() and
# absolute_url(), which check them.
IsoDateTimeStr = NewType("IsoDateTimeStr", str)
UrlStr = NewType("UrlStr", str)

# The string types behind Uuid, HexId, NumericId and Slug. Like IsoDateTimeStr, they're
# NewTypes: build values with uuid_str(), hex_id(), numeric_id() and slug().
UuidStr = NewType("UuidStr", str)
HexIdStr = NewType("HexIdStr", str)
NumericIdStr = NewType("NumericIdStr", str)
SlugStr = NewType("SlugStr", str)
# The string type behind Email. Build values with email_address().
EmailStr = NewType("EmailStr", str)

UUID_PATTERN = r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
HEX_ID_PATTERN = r"^[0-9a-f]{32}$"
NUMERIC_ID_PATTERN = r"^[0-9]+$"
# Django's validate_slug, which every SlugField runs. Sentry's own slug validators are
# stricter, but slugs saved before they existed weren't checked against them.
SLUG_PATTERN = r"^[-a-zA-Z0-9_]+$"
# One `@` with a non-empty local part and domain, and no whitespace. Django's EmailField
# checks more, but addresses saved before it did, or through other paths, weren't checked.
EMAIL_PATTERN = r"^[^@\s]+@[^@\s]+$"

_UUID_REGEX = re.compile(UUID_PATTERN)
_HEX_ID_REGEX = re.compile(HEX_ID_PATTERN)
_NUMERIC_ID_REGEX = re.compile(NUMERIC_ID_PATTERN)
_SLUG_REGEX = re.compile(SLUG_PATTERN)
_EMAIL_REGEX = re.compile(EMAIL_PATTERN)

# A date and time as an ISO 8601 string with a UTC offset, such as
# `2024-01-01T00:00:00+00:00`. Build it with iso_datetime().
IsoDateTime = Annotated[IsoDateTimeStr, ApiFormat(format="date-time")]
# An absolute URL, such as `https://sentry.io/organizations/org-slug/issues/1/`. Build it
# with absolute_url().
Url = Annotated[UrlStr, ApiFormat(format="uri")]
# A UUID in its hyphenated form, such as `6a2c8b1e-5d4f-4c3b-9a8e-7f6d5c4b3a21`. Build it
# with uuid_str().
Uuid = Annotated[UuidStr, ApiFormat(format="uuid")]
# A 32-character lowercase hex ID, such as an event ID or a UUID without hyphens:
# `9fac2ceed9344f2bbfdd1fdacb0ed9b1`. Build it with hex_id().
HexId = Annotated[HexIdStr, ApiFormat(pattern=HEX_ID_PATTERN)]
# A database ID as a string of digits, such as `4505281256090153`. Build it with
# numeric_id().
NumericId = Annotated[NumericIdStr, ApiFormat(pattern=NUMERIC_ID_PATTERN)]
# A slug of letters, digits, hyphens and underscores, such as `my-project`. Build it with
# slug().
Slug = Annotated[SlugStr, ApiFormat(pattern=SLUG_PATTERN)]
# An email address, such as `user@example.com`. Build it with email_address().
Email = Annotated[EmailStr, ApiFormat(format="email")]


def _invalid(format: str, problem: str) -> None:
    # Tests fail on a value that doesn't match its format. Elsewhere, the value is
    # returned unchanged and logged, so a bad value doesn't break the endpoint. The log
    # leaves out the value, which can hold a DSN secret.
    if in_test_environment():
        raise ValueError(f"Response value isn't a valid {format}: {problem}")
    logger.warning("apidocs.invalid_format", extra={"format": format, "problem": problem})


def iso_datetime(value: datetime) -> IsoDateTime:
    """
    Returns ``value.isoformat()`` as the value of a ``date-time`` field.

    A naive datetime is invalid, because its ISO string has no UTC offset.
    """
    if value.utcoffset() is None:
        _invalid("date-time", "the datetime has no UTC offset")
    return IsoDateTimeStr(value.isoformat())


def absolute_url(value: str) -> Url:
    """
    Returns ``value`` unchanged as the value of a ``uri`` field.

    A value without a scheme and a host, such as a path or an empty string, is invalid.
    """
    parts = urlsplit(value)
    if not parts.scheme or not parts.netloc:
        _invalid("uri", "the URL has no scheme or host")
    return UrlStr(value)


@dataclass(frozen=True)
class ApiJsonValue:
    """
    Marks a TypedDict response field whose value can be any JSON value. Use ``JsonValue``.
    """


# Any JSON value: an object, an array, a string, a number, a boolean or null. The
# response coverage check accepts it as typed, so use it only for data whose shape
# Sentry doesn't define, such as the contexts an SDK sent. Type everything else exactly.
JsonValue = Annotated[object, ApiJsonValue()]


def uuid_str(value: UUID | str) -> Uuid:
    """
    Returns ``value`` as the value of a ``uuid`` field. A ``UUID`` becomes its hyphenated
    string; a string is returned unchanged.

    A string that isn't a hyphenated UUID, such as one without hyphens, is invalid.
    """
    if isinstance(value, UUID):
        return UuidStr(str(value))
    if not _UUID_REGEX.fullmatch(value):
        _invalid("uuid", "the value isn't a hyphenated UUID")
    return UuidStr(value)


def hex_id(value: str) -> HexId:
    """
    Returns ``value`` unchanged as the value of a 32-character hex ID field.

    A value that isn't 32 lowercase hex characters is invalid.
    """
    if not _HEX_ID_REGEX.fullmatch(value):
        _invalid("hex ID", "the value isn't 32 lowercase hex characters")
    return HexIdStr(value)


def numeric_id(value: int | str) -> NumericId:
    """
    Returns ``value`` as a string, the value of a numeric ID field.

    A negative number, or a string with anything other than digits, is invalid.
    """
    text = str(value)
    if not _NUMERIC_ID_REGEX.fullmatch(text):
        _invalid("numeric ID", "the value isn't a string of digits")
    return NumericIdStr(text)


def slug(value: str) -> Slug:
    """
    Returns ``value`` unchanged as the value of a slug field.

    A value with characters other than letters, digits, hyphens and underscores, or an
    empty string, is invalid.
    """
    if not _SLUG_REGEX.fullmatch(value):
        _invalid("slug", "the value has characters other than letters, digits, - and _")
    return SlugStr(value)


def email_address(value: str) -> Email:
    """
    Returns ``value`` unchanged as the value of an ``email`` field.

    A value without exactly one ``@`` between a non-empty local part and domain, or with
    whitespace, such as an empty string, is invalid.
    """
    if not _EMAIL_REGEX.fullmatch(value):
        _invalid("email", "the value isn't an email address")
    return EmailStr(value)


# A git branch or ref name, or an empty string. Uploads are validated against the same
# pattern; refs stored before that validation existed weren't checked.
GitRef = Annotated[
    str,
    ApiFormat(pattern=GIT_REF_PATTERN_OPTIONAL_EMPTY, max_length=GIT_REF_MAX_LENGTH),
]
