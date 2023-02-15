from __future__ import annotations

from typing import Any, Callable, Dict, List, Optional, Union, cast

from django.db.models import QuerySet

from sentry.api.serializers import Serializer
from sentry.constants import SentryAppInstallationStatus
from sentry.db.models import BaseQuerySet
from sentry.models import SentryApp, SentryAppInstallation
from sentry.services.hybrid_cloud.app import (
    ApiSentryAppInstallation,
    AppService,
    RpcSentryAppInstallation,
    SentryAppInstallationFilterArgs,
)
from sentry.services.hybrid_cloud.filter_query import FilterQueryDatabaseImpl


class DatabaseBackedAppService(
    FilterQueryDatabaseImpl[
        SentryAppInstallation, SentryAppInstallationFilterArgs, RpcSentryAppInstallation, None
    ],
    AppService,
):
    def _serialize_rpc(self, object: SentryAppInstallation) -> RpcSentryAppInstallation:
        return self.serialize_sentry_app_installation(object)

    def _base_query(self) -> QuerySet:
        return SentryAppInstallation.objects.select_related("sentry_app").prefetch_related(
            "sentry_app__components",
            "sentry_app__application",
        )

    def _filter_arg_validator(self) -> Callable[[SentryAppInstallationFilterArgs], Optional[str]]:
        return self._filter_has_any_key_validator("organization_id", "uuid", "id")

    def _apply_filters(
        self,
        query: BaseQuerySet,
        filters: SentryAppInstallationFilterArgs,
    ) -> List[SentryAppInstallation]:
        query = self._base_query()
        if "status" not in filters:
            filters["status"] = SentryAppInstallationStatus.INSTALLED
        query = query.filter(status=filters["status"])

        if "date_deleted" not in filters:
            filters["date_deleted"] = None
        query = query.filter(date_deleted=filters["date_deleted"])

        if "id" in filters:
            query = query.filter(id=filters["id"])
        if "organization_id" in filters:
            query = query.filter(organization_id=filters["organization_id"])
        if "uuid" in filters:
            query = query.filter(uuid=filters["uuid"])
        if "app_is_alertable" in filters:
            query = query.filter(sentry_app__is_alertable=filters["app_is_alertable"])

        return list(query)

    def _serialize_api(self, serializer: Optional[None]) -> Serializer:
        # SentryAppInstallations should not be serialized in this way
        raise NotImplementedError

    def get_related_sentry_app_components(
        self,
        *,
        organization_ids: List[int],
        type: str,
        # Pass one of sentry_app_ids, sentry_app_uuids
        sentry_app_ids: Optional[List[int]] = None,
        sentry_app_uuids: Optional[List[str]] = None,
        group_by: str = "sentry_app_id",
    ) -> Dict[str | int, Dict[str, Dict[str, Any]]]:
        if sentry_app_uuids is not None:
            sentry_app_ids = (
                SentryAppInstallation.objects.filter(uuid__in=sentry_app_uuids)
                .distinct("sentry_app_id")
                .values_list("sentry_app_id", flat=True)
            )

        return cast(
            Dict[Union[str, int], Dict[str, Dict[str, Any]]],
            SentryAppInstallation.objects.get_related_sentry_app_components(
                organization_ids=organization_ids,
                sentry_app_ids=sentry_app_ids,
                type=type,
                group_by=group_by,
            ),
        )

    def get_installed_for_organization(
        self, *, organization_id: int
    ) -> List[ApiSentryAppInstallation]:
        installations = SentryAppInstallation.objects.get_installed_for_organization(
            organization_id
        ).select_related("sentry_app")
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
