from collections.abc import Mapping
from typing import Any

from sentry.integrations.slack.unfurl.discover import discover_handler
from sentry.integrations.slack.unfurl.issues import issues_handler
from sentry.integrations.slack.unfurl.metric_alerts import metric_alert_handler
from sentry.integrations.slack.unfurl.types import Handler, LinkType

link_handlers: dict[LinkType, Handler] = {
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
