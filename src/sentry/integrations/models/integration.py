from __future__ import annotations

import logging
from datetime import timedelta
from typing import TYPE_CHECKING, Any

from django.db import IntegrityError, models, router, transaction
from django.utils import timezone

from sentry import features, options
from sentry.backup.dependencies import NormalizedModelName, get_model_name
from sentry.backup.sanitize import SanitizableField, Sanitizer
from sentry.backup.scopes import RelocationScope
from sentry.constants import ObjectStatus
from sentry.db.models import (
    BoundedPositiveIntegerField,
    DefaultFieldsModelExisting,
    control_silo_model,
)
from sentry.db.models.fields.encryption import EncryptedJSONField
from sentry.deletions.models.scheduleddeletion import ScheduledDeletion
from sentry.hybridcloud.models.outbox import ControlOutbox, outbox_context
from sentry.hybridcloud.outbox.category import OutboxCategory, OutboxScope
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.organizations.services.organization import RpcOrganization, organization_service
from sentry.shared_integrations.exceptions import IntegrationDeletionInProgressError
from sentry.signals import integration_added
from sentry.silo.safety import unguarded_write
from sentry.types.cell import find_cells_for_orgs

if TYPE_CHECKING:
    from sentry.integrations.base import (
        IntegrationFeatures,
        IntegrationInstallation,
        IntegrationProvider,
    )
    from sentry.models.organization import Organization
    from sentry.users.models.user import User
    from sentry.users.services.user import RpcUser

logger = logging.getLogger(__name__)


def _stuck_deletion_threshold() -> timedelta:
    """
    How long a row may sit in DELETION_IN_PROGRESS (measured from `date_updated`,
    which the deletion claim sets) before a re-installation is allowed to rescue
    it.
    """
    return timedelta(seconds=options.get("integrations.stuck-deletion-rescue-threshold-seconds"))


@control_silo_model
class Integration(DefaultFieldsModelExisting):
    """
    An integration tied to a particular instance of a third-party provider (a single Slack
    workspace, a single GH org, etc.), which can be shared by multiple Sentry orgs.
    """

    __relocation_scope__ = RelocationScope.Global

    provider = models.CharField(max_length=64)
    external_id = models.CharField(max_length=256)
    name = models.CharField(max_length=200)
    # metadata might be used to store things like credentials, but it should NOT
    # be used to store organization-specific information, as an Integration
    # instance can be shared by multiple organizations
    metadata = EncryptedJSONField(default=dict)
    status = BoundedPositiveIntegerField(
        default=ObjectStatus.ACTIVE, choices=ObjectStatus.as_choices(), null=True
    )
    # A place to store non-senstive data for debugging or querying
    debug_data = models.JSONField(default=dict, null=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_integration"
        unique_together = (("provider", "external_id"),)

    def get_provider(self) -> IntegrationProvider:
        from .utils import get_provider

        return get_provider(instance=self)

    def get_installation(self, organization_id: int, **kwargs: Any) -> IntegrationInstallation:
        from .utils import get_installation

        return get_installation(instance=self, organization_id=organization_id, **kwargs)

    def has_feature(self, feature: IntegrationFeatures) -> bool:
        from .utils import has_feature

        return has_feature(instance=self, feature=feature)

    def delete(self, *args, **kwds):
        with outbox_context(
            transaction.atomic(using=router.db_for_write(OrganizationIntegration)), flush=False
        ):
            for outbox in Integration.outboxes_for_update(self.id):
                outbox.save()
            for organization_integration in self.organizationintegration_set.all():
                organization_integration.delete()
            return super().delete(*args, **kwds)

    @staticmethod
    def outboxes_for_update(identifier: int) -> list[ControlOutbox]:
        org_ids = OrganizationIntegration.objects.filter(integration_id=identifier).values_list(
            "organization_id", flat=True
        )
        return [
            ControlOutbox(
                shard_scope=OutboxScope.INTEGRATION_SCOPE,
                shard_identifier=identifier,
                object_identifier=identifier,
                category=OutboxCategory.INTEGRATION_UPDATE,
                cell_name=cell_name,
            )
            for cell_name in find_cells_for_orgs(org_ids)
        ]

    def add_organization(
        self,
        organization_id: int | Organization | RpcOrganization,
        user: User | RpcUser | None = None,
        default_auth_id: int | None = None,
    ) -> OrganizationIntegration | None:
        """
        Add an organization to this integration.

        Returns None if the OrganizationIntegration was not created
        """
        from sentry.integrations.models.organization_integration import OrganizationIntegration

        organization: Organization | RpcOrganization | None
        if isinstance(organization_id, int):
            context = organization_service.get_organization_by_id(
                id=organization_id, include_projects=False, include_teams=False
            )
            organization = context.organization if context is not None else None
        else:
            organization = organization_id
            organization_id = organization_id.id

        # Checked outside the transaction below to avoid holding it open across
        # an RPC call.
        use_cas_reinstall = organization is not None and features.has(
            "organizations:integrations-deletion-reinstall-cas", organization
        )

        try:
            with transaction.atomic(using=router.db_for_write(OrganizationIntegration)):
                org_integration, created = OrganizationIntegration.objects.get_or_create(
                    organization_id=organization_id,
                    integration_id=self.id,
                    defaults={"default_auth_id": default_auth_id, "config": {}},
                )
                # TODO(Steve): add audit log if created
                if not created and use_cas_reinstall:
                    # Guard against a deletion race with a compare-and-swap. A
                    # single UPDATE ... WHERE status = PENDING_DELETION is atomic:
                    # either we rescue the row before the deletion task claims it,
                    # or we don't touch it at all. We deliberately avoid row locks
                    # (SELECT FOR UPDATE) here; a prior version of this fix stalled
                    # the database under lock contention. You can find the other
                    # side of this CAS here:
                    #   src/sentry/deletions/defaults/organizationintegration.py
                    #
                    # `unguarded_write` is safe because status replication is
                    # disabled for this model; see the note at the deletion side.
                    with unguarded_write(using=router.db_for_write(OrganizationIntegration)):
                        reactivated = bool(
                            OrganizationIntegration.objects.filter(
                                id=org_integration.id, status=ObjectStatus.PENDING_DELETION
                            ).update(status=ObjectStatus.ACTIVE, date_updated=timezone.now())
                        )
                    if not reactivated:
                        org_integration.refresh_from_db()

                        # Escape hatch for stuck deletions. The deletion claim sets
                        # `date_updated` when it flips the row to DELETION_IN_PROGRESS
                        # (queryset updates don't auto-bump it, so that timestamp is
                        # the claim time). If the deletion has not completed after
                        # the configured stuck-deletion threshold we assume it failed and let the
                        # user rescue the row rather than being locked out until the
                        # deletion is retried. The CAS includes the staleness check,
                        # so a live deletion that just (re)claimed the row won't
                        # match. A retried deletion is also safe afterwards: its
                        # claim CAS requires a deletable status and the row is ACTIVE
                        # again. The rescued row may have lost some child relations
                        # (identities, repo associations) torn down by the partial
                        # deletion; that's preferable to a permanently blocked
                        # re-install.
                        if org_integration.status == ObjectStatus.DELETION_IN_PROGRESS:
                            with unguarded_write(
                                using=router.db_for_write(OrganizationIntegration)
                            ):
                                reactivated = bool(
                                    OrganizationIntegration.objects.filter(
                                        id=org_integration.id,
                                        status=ObjectStatus.DELETION_IN_PROGRESS,
                                        date_updated__lt=timezone.now()
                                        - _stuck_deletion_threshold(),
                                    ).update(
                                        status=ObjectStatus.ACTIVE, date_updated=timezone.now()
                                    )
                                )
                            if reactivated:
                                logger.warning(
                                    "add-organization-rescued-stuck-deletion",
                                    extra={
                                        "organization_id": organization_id,
                                        "integration_id": self.id,
                                        "organization_integration_id": org_integration.id,
                                        "stuck_since": org_integration.date_updated,
                                    },
                                )

                    if reactivated:
                        org_integration.status = ObjectStatus.ACTIVE
                        # Delete the scheduled deletion row unconditionally rather
                        # than using ScheduledDeletion.cancel, which only removes
                        # rows with in_progress=False.
                        ScheduledDeletion.objects.filter(
                            model_name=type(org_integration).__name__,
                            object_id=org_integration.pk,
                        ).delete()

                    # The deletion task claimed the row recently. Exit early. We
                    # can not honor the re-installation request while children are
                    # actively being torn down; the stuck-deletion escape hatch
                    # above handles the case where the deletion never finishes.
                    if org_integration.status == ObjectStatus.DELETION_IN_PROGRESS:
                        logger.info(
                            "add-organization-deletion-in-progress",
                            extra={
                                "organization_id": organization_id,
                                "integration_id": self.id,
                                "organization_integration_id": org_integration.id,
                            },
                        )
                        # Raise rather than return None: this is transient and
                        # retryable, and callers that discard the return value
                        # would otherwise report success having linked nothing.
                        raise IntegrationDeletionInProgressError(
                            "Integration deletion is already in progress. Please try again in a few minutes."
                        )

                    if default_auth_id:
                        org_integration.update(default_auth_id=default_auth_id)
                elif not created:
                    # Legacy behavior (flag off): no deletion-race protection.
                    if default_auth_id:
                        org_integration.update(default_auth_id=default_auth_id)

                if created:
                    organization_service.schedule_signal(
                        integration_added,
                        organization_id=organization_id,
                        args=dict(integration_id=self.id, user_id=user.id if user else None),
                    )
                return org_integration
        except IntegrityError:
            logger.info(
                "add-organization-integrity-error",
                extra={
                    "organization_id": organization_id,
                    "integration_id": self.id,
                    "default_auth_id": default_auth_id,
                },
            )
            return None

    def disable(self):
        """
        Disable this integration
        """

        self.update(status=ObjectStatus.DISABLED)
        self.save()

    @classmethod
    def sanitize_relocation_json(
        cls, json: Any, sanitizer: Sanitizer, model_name: NormalizedModelName | None = None
    ) -> None:
        model_name = get_model_name(cls) if model_name is None else model_name
        super().sanitize_relocation_json(json, sanitizer, model_name)

        sanitizer.set_string(json, SanitizableField(model_name, "external_id"))
        sanitizer.set_json(json, SanitizableField(model_name, "metadata"), {})
        sanitizer.set_string(json, SanitizableField(model_name, "provider"))
