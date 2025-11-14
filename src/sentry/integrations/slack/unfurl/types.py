from __future__ import annotations

import enum
from collections.abc import Callable, Mapping
from re import Pattern
from typing import Any, NamedTuple, Optional, Protocol, int

from sentry.integrations.models.integration import Integration
from sentry.integrations.services.integration import RpcIntegration
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser

UnfurledUrl = Mapping[Any, Any]
ArgsMapper = Callable[[str, Mapping[str, Optional[str]]], Mapping[str, Any]]


class LinkType(enum.Enum):
    ISSUES = "issues"
    METRIC_ALERT = "metric_alert"
    DISCOVER = "discover"


class UnfurlableUrl(NamedTuple):
    url: str
    args: Mapping[str, Any]


class HandlerCallable(Protocol):
    def __call__(
        self,
        integration: Integration | RpcIntegration,
        links: list[UnfurlableUrl],
        user: User | RpcUser | None = None,
    ) -> UnfurledUrl: ...


class Handler(NamedTuple):
    matcher: list[Pattern[Any]]
    arg_mapper: ArgsMapper
    fn: HandlerCallable


def make_type_coercer(type_map: Mapping[str, type]) -> ArgsMapper:
    """
    Given a mapping of argument names to types, construct a function that will
    coerce given arguments into those types.
    """

    def type_coercer(url: str, args: Mapping[str, str | None]) -> Mapping[str, Any]:
        return {k: type_map[k](v) if v is not None else None for k, v in args.items()}

    return type_coercer
