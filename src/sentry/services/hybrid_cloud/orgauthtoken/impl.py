from __future__ import annotations

from typing import TYPE_CHECKING, Optional

from sentry.models.orgauthtoken import OrgAuthToken
from sentry.models.outbox import OutboxCategory, OutboxScope, RegionOutbox
from sentry.services.hybrid_cloud.orgauthtoken.service import OrgAuthTokenService

if TYPE_CHECKING:
    from datetime import datetime


class DatabaseBackedOrgAuthTokenService(OrgAuthTokenService):
    def update_orgauthtoken(
        self,
        *,
        organization_id: int,
        org_auth_token_id: int,
        date_last_used: Optional[datetime] = None,
        project_last_used_id: Optional[int] = None,
    ) -> None:
        token = OrgAuthToken.objects.filter(id=org_auth_token_id).first()

        if token is None:
            return

        token.update(date_last_used=date_last_used, project_last_used_id=project_last_used_id)


class OutboxBackedOrgAuthTokenService(OrgAuthTokenService):
    def update_orgauthtoken(
        self,
        *,
        organization_id: int,
        org_auth_token_id: int,
        date_last_used: Optional[datetime] = None,
        project_last_used_id: Optional[int] = None,
    ) -> None:
        RegionOutbox(
            shard_scope=OutboxScope.ORGANIZATION_SCOPE,
            shard_identifier=organization_id,
            category=OutboxCategory.ORGAUTHTOKEN_UPDATE_USED,
            object_identifier=org_auth_token_id,
            payload={
                "organization_id": organization_id,
                "org_auth_token_id": org_auth_token_id,
                "date_last_used": date_last_used,
                "project_last_used_id": project_last_used_id,
            },  # type:ignore
        ).save()
