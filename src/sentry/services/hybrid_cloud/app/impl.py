from __future__ import annotations

from typing import Any, Dict, List, Optional

from sentry.models import SentryApp, SentryAppInstallation
from sentry.services.hybrid_cloud.app import ApiSentryAppInstallation, AppService


class DatabaseBackedAppService(AppService):
    def get_related_sentry_app_components(
        self,
        *,
        organization_ids: List[int],
        type: str,
        sentry_app_ids: Optional[List[int]] = None,
        sentry_app_uuids: Optional[List[str]] = None,
        group_by="sentry_app_id",
    ) -> Dict[str | int, Dict[str, Dict[str, Any]]]:
        return SentryAppInstallation.objects.get_related_sentry_app_components(
            organization_ids=organization_ids,
            sentry_app_ids=sentry_app_ids,
            sentry_app_uuids=sentry_app_uuids,
            type=type,
            group_by=group_by,
        )

    def get_installed_for_organization(
        self, *, organization_id: int
    ) -> List[ApiSentryAppInstallation]:
        installations = (
            SentryAppInstallation.objects.get_installed_for_organization(organization_id)
            .select_related("sentry_app")
            .prefetch_related("sentry_app__components")
        )
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
