import itertools
from datetime import datetime
from typing import TYPE_CHECKING, Any, Counter, Mapping, Optional

from django.utils import dateformat

from sentry.notifications.types import ActionTargetType
from sentry.plugins.base import Notification

if TYPE_CHECKING:
    from sentry.models import Group


def get_digest_subject(group: "Group", counts: Counter["Group"], date: datetime) -> str:
    return "{short_id} - {count} new {noun} since {date}".format(
        short_id=group.qualified_short_id,
        count=len(counts),
        noun="alert" if len(counts) == 1 else "alerts",
        date=dateformat.format(date, "N j, Y, P e"),
    )


def should_send_as_alert_notification(context: Mapping[str, Any]) -> bool:
    """
    If there is only one group in this digest (regardless of how many rules it
    appears in), then short-circuit and just render this using the single
    notification template.
    """
    return len(context["counts"]) == 1


def get_timestamp(record_param: Any) -> float:
    # Explicitly typing to satisfy mypy.
    time: float = record_param.timestamp
    return time


def send_as_alert_notification(
    context: Mapping[str, Any],
    target_type: ActionTargetType,
    target_identifier: Optional[int] = None,
) -> None:
    """If there is more than one record for a group, just choose the most recent one."""
    from sentry.mail import mail_adapter

    record = max(
        itertools.chain.from_iterable(
            groups.get(context["group"], []) for groups in context["digest"].values()
        ),
        key=get_timestamp,
    )
    notification = Notification(record.value.event, rules=record.value.rules)
    mail_adapter.notify(notification, target_type, target_identifier)
