from __future__ import annotations

import datetime
from typing import List, Optional

from sentry.constants import SentryAppInstallationStatus
from sentry.models import SentryApp, SentryAppInstallation
from sentry.services.hybrid_cloud.app import ApiSentryAppInstallation, AppService


class DatabaseBackedAppService(AppService):
    def get_many(
        self,
        *,
        organization_id: Optional[int] = None,
        status: SentryAppInstallationStatus = SentryAppInstallationStatus.INSTALLED,
        date_deleted: Optional[datetime.datetime] = None,
        api_token_id: Optional[int] = None,
    ) -> List[ApiSentryAppInstallation]:
        installations = SentryAppInstallation.objects.select_related("sentry_app")
        if organization_id is not None:
            installations = installations.filter(
                {
                    "organization_id": organization_id,
                    "date_deleted": date_deleted,
                }
            )
        if api_token_id is not None:
            installations = installations.filter(api_token_id=api_token_id)
        if status is not None:
            installations = installations.filter(status=status)
        return [self.serialize_sentry_app_installation(i, i.sentry_app) for i in installations]

    def find_installation_by_proxy_user(
        self, *, proxy_user_id: int, organization_id: int
    ) -> ApiSentryAppInstallation | None:
        try:
            sentry_app = SentryApp.objects.get(proxy_user_id=proxy_user_id)
        except SentryApp.DoesNotExist:
            return None

        try:
            installation = SentryAppInstallation.objects.get(
                sentry_app_id=sentry_app.id, organization_id=organization_id
            )
        except SentryAppInstallation.DoesNotExist:
            return None

        return self.serialize_sentry_app_installation(installation, sentry_app)

    def close(self) -> None:
        pass
