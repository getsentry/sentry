import enum
from typing import Any, Callable, List, Mapping, NamedTuple, Optional, Pattern, Tuple

from django.http.request import HttpRequest

from sentry.models import Integration, User

UnfurledUrl = Mapping[Any, Any]
ArgsMapper = Callable[[str, Mapping[str, str]], Mapping[str, Any]]


class LinkType(enum.Enum):
    ISSUES = "issues"
    INCIDENTS = "incidents"
    DISCOVER = "discover"


class UnfurlableUrl(NamedTuple):
    url: str
    args: Mapping[str, Any]


class Handler(NamedTuple):
    matcher: Pattern[Any]
    arg_mapper: ArgsMapper
    fn: Callable[[HttpRequest, Integration, List[UnfurlableUrl], Optional["User"]], UnfurledUrl]


def make_type_coercer(type_map: Mapping[str, type]) -> ArgsMapper:
    """
    Given a mapping of argument names to types, construct a function that will
    coerce given arguments into those types.
    """

    def type_coercer(url: str, args: Mapping[str, str]) -> Mapping[str, Any]:
        return {k: type_map[k](v) if v is not None else None for k, v in args.items()}

    return type_coercer


from .discover import handler as discover_handler
from .incidents import handler as incidents_handler
from .issues import handler as issues_handler

link_handlers = {
    LinkType.DISCOVER: discover_handler,
    LinkType.INCIDENTS: incidents_handler,
    LinkType.ISSUES: issues_handler,
}


def match_link(link: str) -> Tuple[Optional[LinkType], Optional[Mapping[str, Any]]]:
    for link_type, handler in link_handlers.items():
        match = handler.matcher.match(link)
        if not match:
            continue

        args = handler.arg_mapper(link, match.groupdict())
        return link_type, args
    return None, None
