from __future__ import annotations

from typing import Any, Callable, Dict, List, Optional, Union, cast

from django.db.models import QuerySet

from sentry.api.serializers.base import Serializer
from sentry.constants import SentryAppInstallationStatus
from sentry.db.models.manager.base_query_set import BaseQuerySet
from sentry.models import SentryApp, SentryAppInstallation
from sentry.models.apiapplication import ApiApplication
from sentry.models.integrations.sentry_app_component import SentryAppComponent
from sentry.services.hybrid_cloud.app import (
    ApiApiApplication,
    ApiSentryApp,
    ApiSentryAppComponent,
    ApiSentryAppInstallation,
    AppService,
    SentryAppInstallationFilterArgs,
)
from sentry.services.hybrid_cloud.filter_query import FilterQueryDatabaseImpl


class DatabaseBackedAppService(
    FilterQueryDatabaseImpl[
        SentryAppInstallation, SentryAppInstallationFilterArgs, ApiSentryAppInstallation, None
    ],
    AppService,
):
    def _base_query(self) -> QuerySet:
        return SentryAppInstallation.objects.select_related("sentry_app").prefetch_related(
            "sentry_app__components",
            "sentry_app__application",
        )

    def _filter_arg_validator(self) -> Callable[[SentryAppInstallationFilterArgs], Optional[str]]:
        return self._filter_has_any_key_validator("organization_ids", "uuid", "id")

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
        installations = (
            SentryAppInstallation.objects.get_installed_for_organization(organization_id)
            .select_related("sentry_app")
            .prefetch_related("sentry_app__components")
        )
        return [self._serialize_rpc(i) for i in installations]

    def find_installation_by_proxy_user(
        self, *, proxy_user_id: int, organization_id: int
    ) -> ApiSentryAppInstallation | None:
        try:
            sentry_app = SentryApp.objects.get(proxy_user_id=proxy_user_id)
        except SentryApp.DoesNotExist:
            return None

        try:
            installation = SentryAppInstallation.objects.select_related("sentry_app").get(
                sentry_app_id=sentry_app.id, organization_id=organization_id
            )
        except SentryAppInstallation.DoesNotExist:
            return None

        return self._serialize_rpc(installation)

    def _serialize_sentry_app(self, app: SentryApp) -> ApiSentryApp:
        return ApiSentryApp(
            id=app.id,
            scope_list=app.scope_list,
            application=self._serialize_api_application(app.application),
            proxy_user_id=app.proxy_user_id,
            owner_id=app.owner_id,
            name=app.name,
            slug=app.slug,
            uuid=app.uuid,
            events=app.events,
            is_alertable=app.is_alertable,
            status=app.status,
            components=[self._serialize_sentry_app_component(c) for c in app.components.all()],
            webhook_url=app.webhook_url,
            is_internal=app.is_internal,
            is_unpublished=app.is_unpublished,
        )

    def _serialize_sentry_app_component(
        self, component: SentryAppComponent
    ) -> ApiSentryAppComponent:
        return ApiSentryAppComponent(
            uuid=component.uuid,
            type=component.type,
            schema=component.schema,
        )

    def _serialize_api_application(self, api_app: ApiApplication) -> ApiApiApplication:
        return ApiApiApplication(
            id=api_app.id,
            client_id=api_app.client_id,
            client_secret=api_app.client_secret,
        )

    def _serialize_rpc(self, installation: SentryAppInstallation) -> ApiSentryAppInstallation:
        app = installation.sentry_app

        return ApiSentryAppInstallation(
            id=installation.id,
            organization_id=installation.organization_id,
            status=installation.status,
            uuid=installation.uuid,
            sentry_app=self._serialize_sentry_app(app),
        )

    def close(self) -> None:
        pass
