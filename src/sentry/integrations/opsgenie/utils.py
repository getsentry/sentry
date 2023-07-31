from typing import Optional

from sentry.services.hybrid_cloud.integration.model import RpcOrganizationIntegration


def get_team(team_id: Optional[str], org_integration: Optional[RpcOrganizationIntegration]):
    if not org_integration:
        return None
    teams = org_integration.config["team_table"]
    for team in teams:
        if team["id"] == team_id:
            return team
    return None
