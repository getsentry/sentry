from datetime import datetime

from django.utils import timezone
from pydantic import Field

from sentry.hybridcloud.rpc import RpcModel


class RpcDataSecrecyWaiver(RpcModel):
    organization_id: int = -1
    access_start: datetime = Field(default_factory=timezone.now)
    access_end: datetime = Field(default_factory=timezone.now)
    zendesk_tickets: list[str] = Field(default_factory=list)
