from typing import cast

from sentry.models import LostPasswordHash
from sentry.services.hybrid_cloud.lost_password_hash import RpcLostPasswordHash


def serialize_lostpasswordhash(lph: LostPasswordHash) -> RpcLostPasswordHash:
    return cast(RpcLostPasswordHash, RpcLostPasswordHash.serialize_by_field_name(lph))
