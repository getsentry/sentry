# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

import datetime
from typing import cast

from sentry.models import LostPasswordHash
from sentry.services.hybrid_cloud import RpcModel


class RpcLostPasswordHash(RpcModel):
    id: int = -1
    user_id: int = -1
    hash: str = ""
    date_added = datetime.datetime

    def get_absolute_url(self, mode: str = "recover") -> str:
        return cast(str, LostPasswordHash.get_lostpassword_url(self.user_id, self.hash, mode))
