from dataclasses import dataclass

from sentry.utils.options import sample_modulo


@dataclass
class SlackRoutingData:
    """
    Slack only allows us one key to encode data on our actions, so to better route requests, we
    need to encode it with enough data to narrow our targeting.

    This type represents the current data we encode for targeting regions or cells.
    """

    action: str  # Should be a member of SlackAction, but we don't care about the value for routing
    organization_slug: str | None = None
    project_slug: str | None = None


def encode_action_id(
    *, action: str, organization_slug: str, project_slug: str, integration_id: int
) -> str:
    """Used to encode routing data into the outbound action_id for a Slack block."""
    if not sample_modulo("hybrid_cloud.integration_region_targeting_rate", integration_id):
        return action

    return f"{action}::{organization_slug}::{project_slug}"


def decode_action_id(encoded_action_id: str) -> SlackRoutingData:
    """Used to decode the routing data from the inbound action_id on a Slack block."""
    action_target_values = encoded_action_id.split("::")

    if len(action_target_values) == 3:
        return SlackRoutingData(
            action=action_target_values[0],
            organization_slug=action_target_values[1],
            project_slug=action_target_values[2],
        )
    elif len(action_target_values) == 2:
        return SlackRoutingData(
            action=action_target_values[0],
            organization_slug=action_target_values[1],
        )
    return SlackRoutingData(action=action_target_values[0])
