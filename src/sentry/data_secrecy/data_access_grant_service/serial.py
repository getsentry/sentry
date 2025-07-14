from datetime import datetime

from sentry.data_secrecy.data_access_grant_service.model import RpcEffectiveGrantStatus


def serialize_effective_grant_status(
    grant_status: dict, organization_id: int
) -> RpcEffectiveGrantStatus:
    """
    Convert cached grant status to simplified RpcGrantStatus model for access control.
    """

    return RpcEffectiveGrantStatus(
        organization_id=organization_id,
        access_start=datetime.fromisoformat(grant_status["access_start"]),
        access_end=datetime.fromisoformat(grant_status["access_end"]),
    )
