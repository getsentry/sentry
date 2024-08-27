from dataclasses import dataclass


@dataclass(frozen=True)
class TeamLinkRequest:
    integration_id: str
    channel_id: str
    channel_name: str
    slack_id: str
    response_url: str


@dataclass(frozen=True)
class TeamUnlinkRequest(TeamLinkRequest):
    organization_id: str
