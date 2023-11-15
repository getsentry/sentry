import datetime
from typing import List, Optional

from pydantic import Field

from sentry.services.hybrid_cloud import RpcModel


class RpcOrgAuthToken(RpcModel):
    organization_id: int = -1
    id: int = -1
    token_hashed: str = ""
    name: str = ""
    scope_list: List[str] = Field(default_factory=list)
    created_by_id: Optional[int] = None
    date_deactivated: Optional[datetime.datetime] = None
