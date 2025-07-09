from datetime import datetime

from sentry.data_secrecy.data_access_grant_service.model import RpcEffectiveWaiverStatus


def serialize_effective_waiver_status(
    waiver_status: dict, organization_id: int
) -> RpcEffectiveWaiverStatus:
    """
    Convert cached waiver status to simplified RpcWaiverStatus model for access control.
    """

    return RpcEffectiveWaiverStatus(
        organization_id=organization_id,
        access_start=datetime.fromisoformat(waiver_status["access_start"]),
        access_end=datetime.fromisoformat(waiver_status["access_end"]),
    )
