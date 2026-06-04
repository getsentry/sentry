# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from datetime import datetime

from django.utils import timezone
from pydantic.fields import Field

from sentry.hybridcloud.rpc import RpcModel


class RpcOrganizationMemberMapping(RpcModel):
    organizationmember_id: int = -1
    organization_id: int = -1
    date_added: datetime = Field(default_factory=timezone.now)

    role: str = ""
    user_id: int | None = None
    email: str | None = None
    inviter_id: int | None = None
    invite_status: int | None = None


class RpcOrganizationMemberMappingUpdate(RpcModel):
    role: str
    user_id: int | None
    email: str | None
    inviter_id: int | None
    invite_status: int | None
