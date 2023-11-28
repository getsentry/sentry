# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from typing import Optional

from sentry.services.hybrid_cloud import RpcModel
from sentry.types.integrations import ExternalProviders


class RpcExternalActor(RpcModel):
    id: int = -1
    team_id: Optional[int] = None
    user_id: Optional[int] = None
    organization_id: int = -1
    integration_id: int = -1

    provider: int = int(ExternalProviders.UNUSED_GH.value)
    # The display name i.e. username, team name, channel name.
    external_name: str = ""
    # The unique identifier i.e user ID, channel ID.
    external_id: Optional[str] = None
