from datetime import datetime

from sentry.hybridcloud.rpc import RpcModel


class RpcEffectiveGrantStatus(RpcModel):
    """
    Simplified model for access control - only contains essential, aggregated grant information.
    """

    organization_id: int
    access_start: datetime
    access_end: datetime
