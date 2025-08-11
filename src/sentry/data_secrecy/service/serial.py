from datetime import datetime
from typing import Any

from sentry.data_secrecy.service.model import RpcEffectiveGrantStatus


def serialize_effective_grant_status(
    grant_status: dict[str, Any], organization_id: int
) -> RpcEffectiveGrantStatus:
    """
    Convert cached grant status to simplified RpcGrantStatus model for access control.
    """

    return RpcEffectiveGrantStatus(
        organization_id=organization_id,
        access_start=datetime.fromisoformat(grant_status["access_start"]),
        access_end=datetime.fromisoformat(grant_status["access_end"]),
    )
