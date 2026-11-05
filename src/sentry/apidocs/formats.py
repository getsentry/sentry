from dataclasses import dataclass
from typing import Annotated


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

# A date and time as an ISO 8601 string with a UTC offset, such as the output of an
# aware datetime's `isoformat()` or a datetime that the API renders.
IsoDateTime = Annotated[str, ApiFormat(format="date-time")]
# An absolute URL, such as `https://sentry.io/organizations/org-slug/issues/1/`.
Url = Annotated[str, ApiFormat(format="uri")]
# A git branch or ref name, or an empty string. Uploads are validated against the same
# pattern; refs stored before that validation existed weren't checked.
GitRef = Annotated[
    str,
    ApiFormat(pattern=GIT_REF_PATTERN_OPTIONAL_EMPTY, max_length=GIT_REF_MAX_LENGTH),
]
