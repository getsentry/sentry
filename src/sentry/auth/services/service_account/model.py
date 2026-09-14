# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from datetime import datetime

from django.utils import timezone
from pydantic import Field

from sentry.hybridcloud.rpc import RpcModel


class RpcServiceAccount(RpcModel):
    id: int = -1
    organization_id: int = -1
    name: str = ""
    is_active: bool = False
    date_added: datetime = Field(default_factory=timezone.now)
    date_updated: datetime = Field(default_factory=timezone.now)


class RpcServiceAccountToken(RpcModel):
    id: int = -1
    token: str = Field(repr=False, default="")


class RpcServiceAccountCreation(RpcModel):
    account: RpcServiceAccount
    token: RpcServiceAccountToken
