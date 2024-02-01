# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from datetime import datetime
from typing import Optional

from django.utils import timezone
from pydantic.fields import Field

from sentry.services.hybrid_cloud import RpcModel


class RpcOrganizationMemberMapping(RpcModel):
    organizationmember_id: int = -1
    organization_id: int = -1
    date_added: datetime = Field(default_factory=timezone.now)

    role: str = ""
    user_id: Optional[int] = None
    email: Optional[str] = None
    inviter_id: Optional[int] = None
    invite_status: Optional[int] = None


class RpcOrganizationMemberMappingUpdate(RpcModel):
    role: str
    user_id: Optional[int]
    email: Optional[str]
    inviter_id: Optional[int]
    invite_status: Optional[int]
