from __future__ import annotations

from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.models.organizationmembermapping import OrganizationMemberMapping
from sentry.notifications.services.mass_notification.model import RpcMassNotificationResult
from sentry.notifications.services.mass_notification.service import MassNotificationService


class DatabaseBackedMassNotificationService(MassNotificationService):
    def mass_notify_by_integration(
        self,
        *,
        integration_id: int,
        message: str,
    ) -> RpcMassNotificationResult:
        try:
            Integration.objects.get(id=integration_id)
        except Integration.DoesNotExist:
            return RpcMassNotificationResult(
                success=False,
                notified_count=0,
                error_str=f"Integration {integration_id} not found",
            )

        org_ids = list(
            OrganizationIntegration.objects.filter(
                integration_id=integration_id,
            ).values_list("organization_id", flat=True)
        )

        return RpcMassNotificationResult(
            success=True,
            notified_count=len(org_ids),
            organization_ids=org_ids,
        )

    def mass_notify_by_user_organizations(
        self,
        *,
        user_id: int,
        message: str,
    ) -> RpcMassNotificationResult:
        org_ids = list(
            OrganizationMemberMapping.objects.filter(
                user_id=user_id,
            ).values_list("organization_id", flat=True)
        )

        if not org_ids:
            return RpcMassNotificationResult(
                success=False,
                notified_count=0,
                error_str=f"No organizations found for user {user_id}",
            )

        integration_org_ids = list(
            OrganizationIntegration.objects.filter(
                organization_id__in=org_ids,
            )
            .values_list("organization_id", flat=True)
            .distinct()
        )

        return RpcMassNotificationResult(
            success=True,
            notified_count=len(integration_org_ids),
            organization_ids=integration_org_ids,
        )

    def mass_notify_by_vibes(
        self,
        *,
        organization_id: int,
        message: str,
        vibe: str,
    ) -> RpcMassNotificationResult:
        org_integrations = OrganizationIntegration.objects.filter(
            organization_id=organization_id,
        ).select_related("integration")

        if not org_integrations.exists():
            return RpcMassNotificationResult(
                success=False,
                notified_count=0,
                error_str=f"No integrations found for organization {organization_id}",
            )

        vibe_lower = vibe.lower()
        matched = [
            oi
            for oi in org_integrations
            if vibe_lower in oi.integration.provider.lower()
            or vibe_lower in oi.integration.name.lower()
        ]

        if not matched:
            matched = list(org_integrations)

        return RpcMassNotificationResult(
            success=True,
            notified_count=len(matched),
            organization_ids=[organization_id],
        )
