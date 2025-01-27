from __future__ import annotations

import logging
from collections.abc import Iterable
from typing import TYPE_CHECKING, Any

import sentry_sdk
from django.utils import timezone

from sentry import analytics
from sentry.api.paginator import OffsetPaginator
from sentry.constants import SentryAppInstallationStatus
from sentry.hybridcloud.rpc.pagination import RpcPaginationArgs, RpcPaginationResult
from sentry.incidents.models.incident import INCIDENT_STATUS, IncidentStatus
from sentry.integrations.messaging.metrics import (
    MessagingInteractionEvent,
    MessagingInteractionType,
)
from sentry.integrations.mixins import NotifyBasicMixin
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.integration_external_project import IntegrationExternalProject
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.msteams import MsTeamsClient
from sentry.integrations.msteams.spec import MsTeamsMessagingSpec
from sentry.integrations.services.integration import (
    IntegrationService,
    RpcIntegration,
    RpcOrganizationIntegration,
)
from sentry.integrations.services.integration.model import (
    RpcIntegrationExternalProject,
    RpcIntegrationIdentityContext,
    RpcOrganizationContext,
    RpcOrganizationContextList,
)
from sentry.integrations.services.integration.serial import (
    serialize_integration,
    serialize_integration_external_project,
    serialize_organization_integration,
)
from sentry.rules.actions.notify_event_service import find_alert_rule_action_ui_component
from sentry.sentry_apps.api.serializers.app_platform_event import AppPlatformEvent
from sentry.sentry_apps.models.sentry_app import SentryApp
from sentry.sentry_apps.models.sentry_app_installation import SentryAppInstallation
from sentry.utils import json, metrics
from sentry.utils.sentry_apps import send_and_save_webhook_request

if TYPE_CHECKING:
    from datetime import datetime


logger = logging.getLogger(__name__)


class DatabaseBackedIntegrationService(IntegrationService):
    def send_message(
        self, *, integration_id: int, organization_id: int, channel: str, message: str
    ) -> bool:
        try:
            integration = Integration.objects.get(id=integration_id)
        except Integration.DoesNotExist:
            return False
        install = integration.get_installation(organization_id=organization_id)
        if isinstance(install, NotifyBasicMixin):
            install.send_message(channel_id=channel, message=message)
            return True

        return False

    def page_integration_ids(
        self,
        *,
        provider_keys: list[str],
        organization_id: int,
        args: RpcPaginationArgs,
    ) -> RpcPaginationResult:
        return args.do_hybrid_cloud_pagination(
            description="page_integration_ids",
            paginator_cls=OffsetPaginator,
            order_by="name",
            queryset=Integration.objects.filter(
                organizationintegration__organization_id=organization_id,
                provider__in=provider_keys,
            ),
        )

    def get_integrations(
        self,
        *,
        integration_ids: Iterable[int] | None = None,
        organization_id: int | None = None,
        status: int | None = None,
        providers: list[str] | None = None,
        org_integration_status: int | None = None,
        organization_integration_id: int | None = None,
        limit: int | None = None,
    ) -> list[RpcIntegration]:
        integration_kwargs: dict[str, Any] = {}
        if integration_ids is not None:
            integration_kwargs["id__in"] = integration_ids
        if organization_id is not None:
            integration_kwargs["organizationintegration__organization_id"] = organization_id
        if status is not None:
            integration_kwargs["status"] = status
        if providers is not None:
            integration_kwargs["provider__in"] = providers
        if org_integration_status is not None:
            integration_kwargs["organizationintegration__status"] = org_integration_status
        if organization_integration_id is not None:
            integration_kwargs["organizationintegration__id"] = organization_integration_id

        if not integration_kwargs:
            return []

        integrations = Integration.objects.filter(**integration_kwargs)

        if limit is not None:
            integrations = integrations[:limit]

        return [serialize_integration(integration) for integration in integrations]

    def get_integration(
        self,
        *,
        integration_id: int | None = None,
        provider: str | None = None,
        external_id: str | None = None,
        organization_id: int | None = None,
        organization_integration_id: int | None = None,
        status: int | None = None,
    ) -> RpcIntegration | None:
        integration_kwargs: dict[str, Any] = {}
        if integration_id is not None:
            integration_kwargs["id"] = integration_id
        if provider is not None:
            integration_kwargs["provider"] = provider
        if external_id is not None:
            integration_kwargs["external_id"] = external_id
        if organization_id is not None:
            integration_kwargs["organizationintegration__organization_id"] = organization_id
        if organization_integration_id is not None:
            integration_kwargs["organizationintegration__id"] = organization_integration_id
        if status is not None:
            integration_kwargs["status"] = status
        if not integration_kwargs:
            return None

        try:
            integration = Integration.objects.get(**integration_kwargs)
        except Integration.DoesNotExist:
            return None
        except Integration.MultipleObjectsReturned:
            return None
        return serialize_integration(integration)

    def get_organization_integrations(
        self,
        *,
        org_integration_ids: list[int] | None = None,
        integration_id: int | None = None,
        organization_id: int | None = None,
        organization_ids: list[int] | None = None,
        status: int | None = None,
        providers: list[str] | None = None,
        has_grace_period: bool | None = None,
        grace_period_expired: bool | None = None,
        limit: int | None = None,
    ) -> list[RpcOrganizationIntegration]:
        oi_kwargs: dict[str, Any] = {}
        if org_integration_ids is not None:
            oi_kwargs["id__in"] = org_integration_ids
        if integration_id is not None:
            oi_kwargs["integration_id"] = integration_id
        if organization_id is not None:
            organization_ids = [organization_id]
        if organization_ids is not None:
            oi_kwargs["organization_id__in"] = organization_ids
        if status is not None:
            oi_kwargs["status"] = status
        if providers is not None:
            oi_kwargs["integration__provider__in"] = providers
        if has_grace_period is not None:
            oi_kwargs["grace_period_end__isnull"] = not has_grace_period
        if grace_period_expired:
            # Used by getsentry
            oi_kwargs["grace_period_end__lte"] = timezone.now()

        if not oi_kwargs:
            return []

        ois = OrganizationIntegration.objects.filter(**oi_kwargs).select_related("integration")

        if limit is not None:
            ois = ois[:limit]

        return [serialize_organization_integration(oi) for oi in ois]

    def organization_context(
        self,
        *,
        organization_id: int,
        integration_id: int | None = None,
        provider: str | None = None,
        external_id: str | None = None,
    ) -> RpcOrganizationContext:
        context = self.organization_contexts(
            organization_id=organization_id,
            integration_id=integration_id,
            provider=provider,
            external_id=external_id,
        )
        install = None
        if context.organization_integrations:
            install = context.organization_integrations[0]
        if install and install.organization_id != organization_id:
            with sentry_sdk.isolation_scope() as scope:
                scope.set_context(
                    "localscope",
                    {
                        "integration_id": integration_id,
                        "organization_id": organization_id,
                        "install.organization": install.organization_id,
                    },
                )
                sentry_sdk.capture_message(
                    "integration.installation does not belong to requested_org"
                )
            install = None
        return RpcOrganizationContext(
            integration=context.integration, organization_integration=install
        )

    def organization_contexts(
        self,
        *,
        organization_id: int | None = None,
        integration_id: int | None = None,
        provider: str | None = None,
        external_id: str | None = None,
    ) -> RpcOrganizationContextList:
        integration = self.get_integration(
            organization_id=organization_id,
            integration_id=integration_id,
            provider=provider,
            external_id=external_id,
        )
        if not integration:
            return RpcOrganizationContextList(integration=None, organization_integrations=[])
        organization_integrations = self.get_organization_integrations(
            integration_id=integration.id,
            organization_id=organization_id,
        )
        return RpcOrganizationContextList(
            integration=integration, organization_integrations=organization_integrations
        )

    def update_integrations(
        self,
        *,
        integration_ids: list[int],
        name: str | None = None,
        metadata: dict[str, Any] | None = None,
        status: int | None = None,
    ) -> list[RpcIntegration]:
        integrations = Integration.objects.filter(id__in=integration_ids)
        if not integrations.exists():
            return []

        integration_kwargs: dict[str, Any] = {}
        if name is not None:
            integration_kwargs["name"] = name
        if metadata is not None:
            integration_kwargs["metadata"] = metadata
        if status is not None:
            integration_kwargs["status"] = status

        if not integration_kwargs:
            return []
        integration_kwargs["date_updated"] = timezone.now()

        integrations.update(**integration_kwargs)

        return [serialize_integration(integration) for integration in integrations]

    def update_integration(
        self,
        *,
        integration_id: int,
        name: str | None = None,
        metadata: dict[str, Any] | None = None,
        status: int | None = None,
    ) -> RpcIntegration | None:
        integrations = self.update_integrations(
            integration_ids=[integration_id],
            name=name,
            status=status,
            metadata=metadata,
        )
        return integrations[0] if len(integrations) > 0 else None

    def update_organization_integrations(
        self,
        *,
        org_integration_ids: list[int],
        config: dict[str, Any] | None = None,
        status: int | None = None,
        grace_period_end: datetime | None = None,
        set_grace_period_end_null: bool | None = None,
    ) -> list[RpcOrganizationIntegration]:
        ois: list[OrganizationIntegration] = []
        fields: set[str] = set()
        for oi in OrganizationIntegration.objects.filter(id__in=org_integration_ids):
            if config is not None:
                oi.config = config
                fields.add("config")
            if status is not None:
                oi.status = status
                fields.add("status")
            if grace_period_end is not None or set_grace_period_end_null:
                gpe_value = grace_period_end if not set_grace_period_end_null else None
                oi.grace_period_end = gpe_value
                fields.add("grace_period_end")
            ois.append(oi)

        if fields:
            OrganizationIntegration.objects.bulk_update(ois, fields=list(fields))
        return [serialize_organization_integration(oi) for oi in ois]

    def update_organization_integration(
        self,
        *,
        org_integration_id: int,
        config: dict[str, Any] | None = None,
        status: int | None = None,
        grace_period_end: datetime | None = None,
        set_grace_period_end_null: bool | None = None,
    ) -> RpcOrganizationIntegration | None:
        ois = self.update_organization_integrations(
            org_integration_ids=[org_integration_id],
            config=config,
            status=status,
            grace_period_end=grace_period_end,
            set_grace_period_end_null=set_grace_period_end_null,
        )
        return ois[0] if len(ois) > 0 else None

    def add_organization(self, *, integration_id: int, org_ids: list[int]) -> RpcIntegration | None:
        try:
            integration = Integration.objects.get(id=integration_id)
        except Integration.DoesNotExist:
            return None
        for org_id in org_ids:
            integration.add_organization(organization_id=org_id)
        return serialize_integration(integration)

    def send_incident_alert_notification(
        self,
        *,
        sentry_app_id: int,
        action_id: int,
        incident_id: int,
        new_status: int,
        incident_attachment_json: str,
        organization_id: int,
        metric_value: str | None = None,
        notification_uuid: str | None = None,
    ) -> bool:
        try:
            sentry_app = SentryApp.objects.get(id=sentry_app_id)
        except SentryApp.DoesNotExist:
            logger.info(
                "metric_alert_webhook.missing_sentryapp",
                extra={
                    "sentry_app_id": sentry_app_id,
                    "organization_id": organization_id,
                },
            )
            return False

        metrics.incr("notifications.sent", instance=sentry_app.slug, skip_internal=False)

        try:
            install = SentryAppInstallation.objects.get(
                organization_id=organization_id,
                sentry_app=sentry_app,
                status=SentryAppInstallationStatus.INSTALLED,
            )
        except SentryAppInstallation.DoesNotExist:
            logger.info(
                "metric_alert_webhook.missing_installation",
                extra={
                    "action": action_id,
                    "incident": incident_id,
                    "organization_id": organization_id,
                    "sentry_app_id": sentry_app.id,
                },
                exc_info=True,
            )
            return False

        app_platform_event = AppPlatformEvent(
            resource="metric_alert",
            action=INCIDENT_STATUS[IncidentStatus(new_status)].lower(),
            install=install,
            data=json.loads(incident_attachment_json),
        )

        # Can raise errors if client returns >= 400
        send_and_save_webhook_request(
            sentry_app,
            app_platform_event,
        )

        # On success, record analytic event for Metric Alert Rule UI Component
        alert_rule_action_ui_component = find_alert_rule_action_ui_component(app_platform_event)

        if alert_rule_action_ui_component:
            analytics.record(
                "alert_rule_ui_component_webhook.sent",
                organization_id=organization_id,
                sentry_app_id=sentry_app.id,
                event=f"{app_platform_event.resource}.{app_platform_event.action}",
            )
        return alert_rule_action_ui_component

    def send_msteams_incident_alert_notification(
        self, *, integration_id: int, channel: str, attachment: dict[str, Any]
    ) -> bool:
        integration = Integration.objects.get(id=integration_id)
        client = MsTeamsClient(integration)

        with MessagingInteractionEvent(
            interaction_type=MessagingInteractionType.SEND_INCIDENT_ALERT_NOTIFICATION,
            spec=MsTeamsMessagingSpec(),
        ).capture() as lifecycle:
            try:
                client.send_card(channel, attachment)
                return True
            except Exception as e:
                lifecycle.add_extras({"integration_id": integration_id, "channel": channel})
                lifecycle.record_failure(e)
            return False

    def delete_integration(self, *, integration_id: int) -> None:
        try:
            integration = Integration.objects.get(id=integration_id)
        except Integration.DoesNotExist:
            return
        integration.delete()

    def get_integration_external_project(
        self, *, organization_id: int, integration_id: int, external_id: str
    ) -> RpcIntegrationExternalProject | None:
        external_projects = self.get_integration_external_projects(
            organization_id=organization_id,
            integration_id=integration_id,
            external_id=external_id,
        )
        return external_projects[0] if len(external_projects) > 0 else None

    def get_integration_external_projects(
        self, *, organization_id: int, integration_id: int, external_id: str | None = None
    ) -> list[RpcIntegrationExternalProject]:
        try:
            oi = OrganizationIntegration.objects.get(
                organization_id=organization_id,
                integration_id=integration_id,
            )
        except OrganizationIntegration.DoesNotExist:
            return []

        iep_kwargs: dict[str, Any] = {"organization_integration_id": oi.id}
        if external_id is not None:
            iep_kwargs["external_id"] = external_id
        external_projects = IntegrationExternalProject.objects.filter(**iep_kwargs)
        return [serialize_integration_external_project(iep) for iep in external_projects]

    def get_integration_identity_context(
        self,
        *,
        integration_provider: str | None = None,
        integration_external_id: str | None = None,
        identity_external_id: str | None = None,
        identity_provider_external_id: str | None = None,
    ) -> RpcIntegrationIdentityContext:
        from sentry.identity.services.identity.service import identity_service
        from sentry.users.services.user.service import user_service

        integration = self.get_integration(
            provider=integration_provider,
            external_id=integration_external_id,
        )
        identity_provider = identity_service.get_provider(
            provider_type=integration_provider,
            provider_ext_id=identity_provider_external_id,
        )
        identity = (
            identity_service.get_identity(
                filter={
                    "provider_id": identity_provider.id,
                    "identity_ext_id": identity_external_id,
                }
            )
            if identity_provider
            else None
        )
        user = user_service.get_user(identity.user_id) if identity else None
        return RpcIntegrationIdentityContext(
            integration=integration,
            identity_provider=identity_provider,
            identity=identity,
            user=user,
        )
