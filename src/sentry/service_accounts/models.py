from __future__ import annotations

from collections.abc import Iterable
from typing import ClassVar, Self

from django.conf import settings
from django.contrib.postgres.fields.array import ArrayField
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    DefaultFieldsModel,
    FlexibleForeignKey,
    Model,
    cell_silo_model,
    control_silo_model,
    sane_repr,
)
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.hybridcloud.models.outbox import ControlOutboxBase
from sentry.hybridcloud.outbox.base import (
    ControlOutboxProducingManager,
    ControlOutboxProducingModel,
    ReplicatedControlModel,
)
from sentry.hybridcloud.outbox.category import OutboxCategory
from sentry.types.cell import find_cells_for_orgs

__all__ = (
    "ServiceAccount",
    "ServiceAccountProject",
    "ServiceAccountReplica",
    "ServiceAccountProjectReplica",
)

# Matches the `name` serializer in the service account API.
MAX_NAME_LENGTH = 64

# OIDC scopes describe a human login, so a service account can't hold them.
GRANTABLE_SCOPES = frozenset(settings.SENTRY_SCOPES - {"openid", "profile", "email"})


def validate_grantable_scopes(value: Iterable[str]) -> None:
    for scope in value:
        if scope not in GRANTABLE_SCOPES:
            raise ValidationError(f"{scope} is not a scope a service account can hold.")


def service_account_outboxes(
    service_account_id: int, organization_id: int, shard_identifier: int | None = None
) -> list[ControlOutboxBase]:
    return OutboxCategory.SERVICE_ACCOUNT_UPDATE.as_control_outboxes(
        cell_names=find_cells_for_orgs([organization_id]),
        object_identifier=service_account_id,
        shard_identifier=shard_identifier or organization_id,
    )


@control_silo_model
class ServiceAccount(ReplicatedControlModel):
    """
    A non-human principal that belongs to one organization. It has no organization
    membership: `scope_list` is the ceiling for everything it can do in the org.

    The org's cell keeps a copy in `ServiceAccountReplica`, so cell code can read it and
    point foreign keys at it without calling control.
    """

    __relocation_scope__ = RelocationScope.Organization
    category = OutboxCategory.SERVICE_ACCOUNT_UPDATE

    organization_id = HybridCloudForeignKey("sentry.Organization", null=False, on_delete="CASCADE")
    name = models.CharField(max_length=MAX_NAME_LENGTH)
    scope_list = ArrayField(
        models.TextField(), validators=[validate_grantable_scopes], default=list
    )
    is_active = models.BooleanField(default=True, db_default=True)
    # Always a human user, never another service account.
    created_by = FlexibleForeignKey("sentry.User", null=True, blank=True, on_delete=models.SET_NULL)
    date_added = models.DateTimeField(default=timezone.now)
    date_updated = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "service_accounts"
        db_table = "service_accounts_serviceaccount"
        constraints = [
            models.UniqueConstraint(
                fields=["organization_id", "name"],
                name="service_accounts_serviceaccount_org_name_unique",
            ),
        ]

    __repr__ = sane_repr("organization_id", "name")

    def outboxes_for_update(self, shard_identifier: int | None = None) -> list[ControlOutboxBase]:
        return service_account_outboxes(self.id, self.organization_id, shard_identifier)

    def handle_async_replication(self, cell_name: str, shard_identifier: int) -> None:
        from sentry.hybridcloud.services.replica import cell_replica_service
        from sentry.service_accounts.services.service_account.serial import (
            serialize_service_account,
        )

        project_ids = ServiceAccountProject.objects.filter(service_account_id=self.id).values_list(
            "project_id", flat=True
        )
        cell_replica_service.upsert_replicated_service_account(
            service_account=serialize_service_account(self, project_ids),
            cell_name=cell_name,
        )


@control_silo_model
class ServiceAccountProject(DefaultFieldsModel, ControlOutboxProducingModel):
    """
    A project a service account can access when its org doesn't have open membership.
    Projects live in the cell, so the link is a hybrid cloud foreign key and the row is
    removed by the tombstone cascade after the project is deleted.

    The cell replicates an account's projects along with the account, so adding or
    removing a link writes the account's outbox, not one of its own. That includes the
    tombstone cascade, which deletes rows one instance at a time. The manager's bulk
    methods write outboxes too; queryset `update()` and `delete()` don't, so avoid them.
    """

    __relocation_scope__ = RelocationScope.Organization

    objects: ClassVar[ControlOutboxProducingManager[Self]] = ControlOutboxProducingManager()

    service_account = FlexibleForeignKey(
        "service_accounts.ServiceAccount", on_delete=models.CASCADE
    )
    project_id = HybridCloudForeignKey("sentry.Project", null=False, on_delete="CASCADE")

    class Meta:
        app_label = "service_accounts"
        db_table = "service_accounts_serviceaccountproject"
        constraints = [
            models.UniqueConstraint(
                fields=["service_account", "project_id"],
                name="service_accounts_serviceaccountproject_unique",
            ),
        ]

    __repr__ = sane_repr("service_account_id", "project_id")

    def outboxes_for_update(self, shard_identifier: int | None = None) -> list[ControlOutboxBase]:
        return service_account_outboxes(
            self.service_account_id, self.service_account.organization_id, shard_identifier
        )


@cell_silo_model
class ServiceAccountReplica(Model):
    """
    The cell's copy of a `ServiceAccount`, written by its outbox. Deleting the account
    deletes this row through the tombstone cascade. Like the account, this doesn't
    check `is_active`, so callers must.
    """

    __relocation_scope__ = RelocationScope.Excluded

    organization = FlexibleForeignKey("sentry.Organization", on_delete=models.CASCADE)
    service_account_id = HybridCloudForeignKey(
        "service_accounts.ServiceAccount", null=False, on_delete="CASCADE", unique=True
    )
    name = models.CharField(max_length=MAX_NAME_LENGTH)
    scope_list = ArrayField(models.TextField(), default=list)
    is_active = models.BooleanField(default=True, db_default=True)

    class Meta:
        app_label = "service_accounts"
        db_table = "service_accounts_serviceaccountreplica"

    __repr__ = sane_repr("organization_id", "service_account_id")


@cell_silo_model
class ServiceAccountProjectReplica(Model):
    """
    The cell's copy of a `ServiceAccountProject`. The account's outbox replaces the whole
    set of an account's links at once, so there's no reference to the control row.

    Replication can race a project transfer and briefly keep a link to a project that has
    left the account's org, until the transfer's outbox cleanup replicates. Readers must
    check that the project is in the account's org.
    """

    __relocation_scope__ = RelocationScope.Excluded

    service_account = FlexibleForeignKey(
        "service_accounts.ServiceAccountReplica", on_delete=models.CASCADE
    )
    project = FlexibleForeignKey("sentry.Project", on_delete=models.CASCADE)

    class Meta:
        app_label = "service_accounts"
        db_table = "service_accounts_serviceaccountprojectreplica"
        constraints = [
            models.UniqueConstraint(
                fields=["service_account", "project"],
                name="service_accounts_serviceaccountprojectreplica_unique",
            ),
        ]

    __repr__ = sane_repr("service_account_id", "project_id")
