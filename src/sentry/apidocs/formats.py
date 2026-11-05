import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Annotated, NewType
from urllib.parse import urlsplit

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

# A date and time as an ISO 8601 string with a UTC offset, such as
# `2024-01-01T00:00:00+00:00`. Build it with iso_datetime().
IsoDateTime = Annotated[IsoDateTimeStr, ApiFormat(format="date-time")]
# An absolute URL, such as `https://sentry.io/organizations/org-slug/issues/1/`. Build it
# with absolute_url().
Url = Annotated[UrlStr, ApiFormat(format="uri")]


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


# A git branch or ref name, or an empty string. Uploads are validated against the same
# pattern; refs stored before that validation existed weren't checked.
GitRef = Annotated[
    str,
    ApiFormat(pattern=GIT_REF_PATTERN_OPTIONAL_EMPTY, max_length=GIT_REF_MAX_LENGTH),
]
