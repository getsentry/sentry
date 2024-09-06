# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from datetime import datetime

from django.utils import timezone
from pydantic import Field

from sentry.hybridcloud.rpc import RpcModel
from sentry.users.models.lostpasswordhash import LostPasswordHash


class RpcLostPasswordHash(RpcModel):
    id: int = -1
    user_id: int = -1
    hash: str = ""
    date_added: datetime = Field(default_factory=timezone.now)

    def get_absolute_url(self, mode: str = "recover") -> str:
        return LostPasswordHash.get_lostpassword_url(self.user_id, self.hash, mode)
