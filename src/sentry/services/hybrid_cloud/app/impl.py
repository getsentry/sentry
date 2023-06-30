from __future__ import annotations

from typing import Any, Callable, List, Mapping, Optional

from django.db.models import QuerySet

from sentry.api.serializers import SentryAppAlertRuleActionSerializer, Serializer, serialize
from sentry.constants import SentryAppInstallationStatus
from sentry.mediators import alert_rule_actions
from sentry.models import SentryApp, SentryAppComponent, SentryAppInstallation
from sentry.models.integrations.sentry_app_installation import prepare_sentry_app_components
from sentry.services.hybrid_cloud.app import (
    AppService,
    RpcAlertRuleActionResult,
    RpcSentryApp,
    RpcSentryAppComponent,
    RpcSentryAppEventData,
    RpcSentryAppInstallation,
    RpcSentryAppService,
    SentryAppInstallationFilterArgs,
)
from sentry.services.hybrid_cloud.app.serial import (
    serialize_sentry_app,
    serialize_sentry_app_installation,
)
from sentry.services.hybrid_cloud.auth import AuthenticationContext
from sentry.services.hybrid_cloud.filter_query import (
    FilterQueryDatabaseImpl,
    OpaqueSerializedResponse,
)
from sentry.services.hybrid_cloud.user import RpcUser


class DatabaseBackedAppService(AppService):
    def serialize_many(
        self,
        *,
        filter: SentryAppInstallationFilterArgs,
        as_user: Optional[RpcUser] = None,
        auth_context: Optional[AuthenticationContext] = None,
    ) -> List[OpaqueSerializedResponse]:
        return self._FQ.serialize_many(filter, as_user, auth_context)

    def get_many(
        self, *, filter: SentryAppInstallationFilterArgs
    ) -> List[RpcSentryAppInstallation]:
        return self._FQ.get_many(filter)

    def find_app_components(self, *, app_id: int) -> List[RpcSentryAppComponent]:
        return [
            RpcSentryAppComponent(
                uuid=str(c.uuid),
                sentry_app_id=c.sentry_app_id,
                type=c.type,
                app_schema=c.schema,
            )
            for c in SentryAppComponent.objects.filter(sentry_app_id=app_id)
        ]

    def get_sentry_app_by_slug(self, *, slug: str) -> Optional[RpcSentryApp]:
        try:
            sentry_app = SentryApp.objects.get(slug=slug)
            return serialize_sentry_app(sentry_app)
        except SentryApp.DoesNotExist:
            return None

    def get_installed_for_organization(
        self, *, organization_id: int
    ) -> List[RpcSentryAppInstallation]:
        installations = SentryAppInstallation.objects.get_installed_for_organization(
            organization_id
        ).select_related("sentry_app")
        fq = self._AppServiceFilterQuery()
        return [fq.serialize_rpc(i) for i in installations]

    def find_alertable_services(self, *, organization_id: int) -> List[RpcSentryAppService]:
        result: List[RpcSentryAppService] = []
        for app in SentryApp.objects.filter(
            installations__organization_id=organization_id,
            is_alertable=True,
            installations__status=SentryAppInstallationStatus.INSTALLED,
            installations__date_deleted=None,
        ).distinct():
            if SentryAppComponent.objects.filter(
                sentry_app_id=app.id, type="alert-rule-action"
            ).exists():
                continue
            result.append(
                RpcSentryAppService(
                    title=app.name,
                    slug=app.slug,
                )
            )
        return result

    def get_custom_alert_rule_actions(
        self, *, event_data: RpcSentryAppEventData, organization_id: int, project_slug: str | None
    ) -> List[Mapping[str, Any]]:
        action_list = []
        for install in SentryAppInstallation.objects.get_installed_for_organization(
            organization_id
        ):
            component = prepare_sentry_app_components(install, "alert-rule-action", project_slug)
            if component:
                kwargs = {
                    "install": install,
                    "event_action": event_data,
                }
                action_details = serialize(
                    component, None, SentryAppAlertRuleActionSerializer(), **kwargs
                )
                action_list.append(action_details)

        return action_list

    def get_related_sentry_app_components(
        self,
        *,
        organization_ids: List[int],
        sentry_app_ids: List[int],
        type: str,
        group_by: str = "sentry_app_id",
    ) -> Mapping[str, Any]:
        return SentryAppInstallation.objects.get_related_sentry_app_components(
            organization_ids=organization_ids,
            sentry_app_ids=sentry_app_ids,
            type=type,
            group_by=group_by,
        )

    class _AppServiceFilterQuery(
        FilterQueryDatabaseImpl[
            SentryAppInstallation, SentryAppInstallationFilterArgs, RpcSentryAppInstallation, None
        ]
    ):
        def base_query(self, ids_only: bool = False) -> QuerySet:
            if ids_only:
                return SentryAppInstallation.objects
            return SentryAppInstallation.objects.select_related("sentry_app")

        def filter_arg_validator(
            self,
        ) -> Callable[[SentryAppInstallationFilterArgs], Optional[str]]:
            return self._filter_has_any_key_validator(
                "organization_id", "installation_ids", "app_ids", "uuids"
            )

        def serialize_api(self, serializer: Optional[None]) -> Serializer:
            raise NotImplementedError("Serialization not supported for AppService")

        def apply_filters(
            self, query: QuerySet, filters: SentryAppInstallationFilterArgs
        ) -> QuerySet:
            # filters["status"] = SentryAppInstallationStatus.INSTALLED
            if "installation_ids" in filters:
                query = query.filter(id__in=filters["installation_ids"])
            if "organization_id" in filters:
                query = query.filter(organization_id=filters["organization_id"])
            if "uuids" in filters:
                query = query.filter(uuid__in=filters["uuids"])

            return query

        def serialize_rpc(self, object: SentryAppInstallation) -> RpcSentryAppInstallation:
            return serialize_sentry_app_installation(object)

    _FQ = _AppServiceFilterQuery()

    def find_installation_by_proxy_user(
        self, *, proxy_user_id: int, organization_id: int
    ) -> RpcSentryAppInstallation | None:
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

        return serialize_sentry_app_installation(installation, sentry_app)

    def trigger_sentry_app_action_creators(
        self, *, fields: List[Mapping[str, Any]], install_uuid: str | None
    ) -> RpcAlertRuleActionResult:
        try:
            install = SentryAppInstallation.objects.get(uuid=install_uuid)
        except SentryAppInstallation.DoesNotExist:
            return RpcAlertRuleActionResult(success=False, message="Installation does not exist")
        result = alert_rule_actions.AlertRuleActionCreator.run(install=install, fields=fields)
        return RpcAlertRuleActionResult(success=result["success"], message=result["message"])

    def find_service_hook_sentry_app(self, *, api_application_id: int) -> Optional[RpcSentryApp]:
        try:
            return serialize_sentry_app(SentryApp.objects.get(application_id=api_application_id))
        except SentryApp.DoesNotExist:
            return None
