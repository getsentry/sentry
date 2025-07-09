from datetime import datetime

from sentry.hybridcloud.rpc import RpcModel


class RpcEffectiveWaiverStatus(RpcModel):
    """
    Simplified model for access control - only contains essential waiver information.
    """

    organization_id: int
    access_start: datetime
    access_end: datetime
