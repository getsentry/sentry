import datetime

from pydantic import Field

from sentry.hybridcloud.rpc import RpcModel


class RpcOrgAuthToken(RpcModel):
    organization_id: int = -1
    id: int = -1
    token_hashed: str = ""
    name: str = ""
    scope_list: list[str] = Field(default_factory=list)
    created_by_id: int | None = None
    date_deactivated: datetime.datetime | None = None
