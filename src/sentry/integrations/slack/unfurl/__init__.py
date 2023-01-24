from __future__ import annotations

import enum
from typing import Any, Callable, Mapping, NamedTuple, Optional, Pattern

from django.http.request import HttpRequest

from sentry.models import Integration, User

UnfurledUrl = Mapping[Any, Any]
ArgsMapper = Callable[[str, Mapping[str, Optional[str]]], Mapping[str, Any]]


class LinkType(enum.Enum):
    ISSUES = "issues"
    METRIC_ALERT = "metric_alert"
    DISCOVER = "discover"


class UnfurlableUrl(NamedTuple):
    url: str
    args: Mapping[str, Any]


class Handler(NamedTuple):
    matcher: list[Pattern[Any]]
    arg_mapper: ArgsMapper
    fn: Callable[[HttpRequest, Integration, list[UnfurlableUrl], User | None], UnfurledUrl]


def make_type_coercer(type_map: Mapping[str, type]) -> ArgsMapper:
    """
    Given a mapping of argument names to types, construct a function that will
    coerce given arguments into those types.
    """

    def type_coercer(url: str, args: Mapping[str, str | None]) -> Mapping[str, Any]:
        return {k: type_map[k](v) if v is not None else None for k, v in args.items()}

    return type_coercer


from .discover import handler as discover_handler
from .issues import handler as issues_handler
from .metric_alerts import handler as metric_alert_handler

link_handlers = {
    LinkType.DISCOVER: discover_handler,
    LinkType.METRIC_ALERT: metric_alert_handler,
    LinkType.ISSUES: issues_handler,
}


def match_link(link: str) -> tuple[LinkType | None, Mapping[str, Any] | None]:
    for link_type, handler in link_handlers.items():
        match = next(filter(bool, map(lambda matcher: matcher.match(link), handler.matcher)), None)

        if not match:
            continue

        args = handler.arg_mapper(link, match.groupdict())
        return link_type, args
    return None, None
