from __future__ import annotations

import logging
from dataclasses import dataclass
from urllib.parse import parse_qsl, urlencode

logger = logging.getLogger(__name__)

TRACKING_SEPARATOR = "|"
"""Separates the routing data in an action ID from the tracking data that follows it."""


@dataclass(frozen=True)
class SlackActionTracking:
    """Identifies the notification an action was sent in, so a click on it can be attributed."""

    notification_uuid: str
    source: str

    def encode(self) -> str:
        return urlencode({"n": self.notification_uuid, "s": self.source})

    @classmethod
    def decode(cls, encoded: str) -> SlackActionTracking | None:
        params = dict(parse_qsl(encoded))
        notification_uuid, source = params.get("n"), params.get("s")
        if not notification_uuid or not source:
            return None
        return cls(notification_uuid=notification_uuid, source=source)


@dataclass
class SlackRoutingData:
    """
    Slack only allows us one key to encode data on our actions, so to better route requests, we
    need to encode it with enough data to narrow our targeting.

    This type represents the current data we encode for targeting cells.
    """

    action: str  # Should be a member of SlackAction, but we don't care about the value for routing
    organization_id: int | None = None
    project_id: int | None = None
    tracking: SlackActionTracking | None = None


def encode_action_id(*, action: str, organization_id: int, project_id: int | None) -> str:
    """Used to encode routing data into the outbound action_id for a Slack block."""
    return (
        f"{action}::{organization_id}::{project_id}"
        if project_id
        else f"{action}::{organization_id}"
    )


def decode_action_id(encoded_action_id: str) -> SlackRoutingData:
    """Used to decode the routing data from the inbound action_id on a Slack block."""
    routing, separator, encoded_tracking = encoded_action_id.partition(TRACKING_SEPARATOR)
    tracking = SlackActionTracking.decode(encoded_tracking) if separator else None
    action_target_values = routing.split("::")
    try:
        if len(action_target_values) == 3:
            return SlackRoutingData(
                action=action_target_values[0],
                organization_id=int(action_target_values[1]),
                project_id=int(action_target_values[2]),
                tracking=tracking,
            )
        elif len(action_target_values) == 2:
            return SlackRoutingData(
                action=action_target_values[0],
                organization_id=int(action_target_values[1]),
                tracking=tracking,
            )
    except ValueError as e:
        # If we can't parse the IDs as integers, fail silently since this is just routing
        logger.info("invalid_identifiers", extra={"action_id": encoded_action_id, "error": e})
        pass
    return SlackRoutingData(action=action_target_values[0], tracking=tracking)
