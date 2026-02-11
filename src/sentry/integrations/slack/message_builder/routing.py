import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class SlackRoutingData:
    """
    Slack only allows us one key to encode data on our actions, so to better route requests, we
    need to encode it with enough data to narrow our targeting.

    This type represents the current data we encode for targeting regions or cells.
    """

    action: str  # Should be a member of SlackAction, but we don't care about the value for routing
    organization_id: int | None = None
    project_id: int | None = None


def encode_action_id(*, action: str, organization_id: int, project_id: int | None) -> str:
    """Used to encode routing data into the outbound action_id for a Slack block."""
    return (
        f"{action}::{organization_id}::{project_id}"
        if project_id
        else f"{action}::{organization_id}"
    )


def decode_action_id(encoded_action_id: str) -> SlackRoutingData:
    """Used to decode the routing data from the inbound action_id on a Slack block."""
    action_target_values = encoded_action_id.split("::")
    try:
        if len(action_target_values) == 3:
            return SlackRoutingData(
                action=action_target_values[0],
                organization_id=int(action_target_values[1]),
                project_id=int(action_target_values[2]),
            )
        elif len(action_target_values) == 2:
            return SlackRoutingData(
                action=action_target_values[0],
                organization_id=int(action_target_values[1]),
            )
    except ValueError as e:
        # If we can't parse the IDs as integers, fail silently since this is just routing
        logger.info("invalid_identifiers", extra={"action_id": encoded_action_id, "error": e})
        pass
    return SlackRoutingData(action=action_target_values[0])
