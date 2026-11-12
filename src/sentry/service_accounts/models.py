from __future__ import annotations

from collections.abc import Iterable
from typing import ClassVar, Self

from django.conf import settings
from django.contrib.postgres.fields.array import ArrayField
from django.core.exceptions import ValidationError
from django.db import models, router, transaction
from django.db.models import Q
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
from sentry.hybridcloud.models.outbox import ControlOutboxBase, outbox_context
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
    "ServiceAccountToken",
    "ServiceAccountTokenReplica",
)

# Matches the `name` serializer in the service account API.
MAX_NAME_LENGTH = 64

# OIDC scopes describe a human login, so a service account can't hold them. Service
# account scopes are withheld so an account can't create or widen other accounts.
GRANTABLE_SCOPES = frozenset(
    settings.SENTRY_SCOPES
    - {"openid", "profile", "email", "service_account:read", "service_account:write"}
)


class InvalidScopeError(ValidationError):
    pass


def validate_grantable_scopes(value: Iterable[str]) -> None:
    for scope in value:
        if scope not in GRANTABLE_SCOPES:
            raise InvalidScopeError(f"{scope} is not a scope a service account can hold.")


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
    # False means the account was deleted, as on `User`. Nothing sets it back to True, and
    # the row stays until the org is deleted so references to the account stay set.
    is_active = models.BooleanField(default=True, db_default=True)
    # Every active project in the org, including ones created later, instead of only the
    # linked `ServiceAccountProject`s. Explicit so access doesn't follow open membership.
    all_projects = models.BooleanField(default=False, db_default=False)
    # Always a human user, never another service account.
    created_by = FlexibleForeignKey("sentry.User", null=True, blank=True, on_delete=models.SET_NULL)
    # Lets a retried create, such as an outbox redelivery, find the account it already made.
    idempotency_key = models.CharField(max_length=64, null=True, blank=True)
    date_added = models.DateTimeField(default=timezone.now)
    date_updated = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "service_accounts"
        db_table = "service_accounts_serviceaccount"
        constraints = [
            # Inactive accounts don't reserve their name, so a deleted account's name can be reused.
            models.UniqueConstraint(
                fields=["organization_id", "name"],
                condition=Q(is_active=True),
                name="service_accounts_serviceaccount_org_name_unique_active",
            ),
            models.UniqueConstraint(
                fields=["organization_id", "idempotency_key"],
                name="service_accounts_serviceaccount_org_idempotency_key_unique",
            ),
        ]

    __repr__ = sane_repr("organization_id", "name")

    def outboxes_for_update(self, shard_identifier: int | None = None) -> list[ControlOutboxBase]:
        return service_account_outboxes(self.id, self.organization_id, shard_identifier)

    @classmethod
    def create_with_projects(
        cls,
        *,
        organization_id: int,
        name: str,
        scope_list: list[str],
        project_ids: Iterable[int],
        all_projects: bool,
        created_by_id: int | None,
        idempotency_key: str | None = None,
    ) -> ServiceAccount:
        """
        Raises `InvalidScopeError` for a scope outside `GRANTABLE_SCOPES` and `IntegrityError`
        when `name` is taken in the org. Callers must authorize the grant and write the audit
        log.
        """
        validate_grantable_scopes(scope_list)
        with outbox_context(transaction.atomic(using=router.db_for_write(cls))):
            service_account = cls.objects.create(
                organization_id=organization_id,
                name=name,
                scope_list=scope_list,
                all_projects=all_projects,
                created_by_id=created_by_id,
                idempotency_key=idempotency_key,
            )
            if not all_projects:
                ServiceAccountProject.objects.bulk_create(
                    ServiceAccountProject(service_account=service_account, project_id=project_id)
                    for project_id in set(project_ids)
                )
        return service_account

    def deactivate(self) -> bool:
        """
        Delete the account: keep the row, so references to it stay set, but turn it off for
        good and remove its project links. The outbox replicates both to the cell. Returns
        False when the account was already deleted. Callers must write the audit log.
        """
        with outbox_context(transaction.atomic(using=router.db_for_write(ServiceAccount))):
            account = (
                ServiceAccount.objects.select_for_update()
                .filter(id=self.id, is_active=True)
                .first()
            )
            if account is None:
                return False
            account.replace_projects([])
            account.all_projects = False
            account.is_active = False
            account.save()
        return True

    def replace_projects(self, project_ids: Iterable[int]) -> None:
        project_ids = set(project_ids)
        existing = set()
        # Delete links one at a time: a queryset delete wouldn't write the account's outbox.
        for link in ServiceAccountProject.objects.filter(service_account=self):
            if link.project_id in project_ids:
                existing.add(link.project_id)
            else:
                link.delete()
        ServiceAccountProject.objects.bulk_create(
            ServiceAccountProject(service_account=self, project_id=project_id)
            for project_id in project_ids
            if project_id not in existing
        )

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
    A project a service account can access when it doesn't have `all_projects`.
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
    keeps this row with `is_active=False`, so cell references to it stay set. Like the
    account, this doesn't check `is_active`, so callers must.
    """

    __relocation_scope__ = RelocationScope.Excluded

    organization = FlexibleForeignKey("sentry.Organization", on_delete=models.CASCADE)
    service_account_id = HybridCloudForeignKey(
        "service_accounts.ServiceAccount", null=False, on_delete="CASCADE", unique=True
    )
    name = models.CharField(max_length=MAX_NAME_LENGTH)
    scope_list = ArrayField(models.TextField(), default=list)
    is_active = models.BooleanField(default=True, db_default=True)
    all_projects = models.BooleanField(default=False, db_default=False)

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


@control_silo_model
class ServiceAccountToken(ReplicatedControlModel):
    """
    A long-lived credential an org admin creates for a service account. Requests made with
    it act as the account, never as the admin who created it.

    Revoking keeps the row and sets `date_deactivated`, so its history stays. Accounts are
    soft-deleted, so the account foreign key only cascades when the org is deleted.
    """

    # A relocated token would need a new secret, so admins create new tokens instead.
    __relocation_scope__ = RelocationScope.Excluded
    category = OutboxCategory.SERVICE_ACCOUNT_TOKEN_UPDATE

    service_account = FlexibleForeignKey(
        "service_accounts.ServiceAccount", on_delete=models.CASCADE
    )
    # Copied from the account so outbox routing and the replica don't need a join.
    organization_id = HybridCloudForeignKey("sentry.Organization", null=False, on_delete="CASCADE")
    name = models.CharField(max_length=MAX_NAME_LENGTH)
    token_hashed = models.TextField(unique=True)
    token_last_characters = models.CharField(max_length=4)
    # Fixed at creation. Effective access is this intersected with the account's current
    # scopes, so narrowing the account narrows the token, but widening it doesn't.
    scope_list = ArrayField(
        models.TextField(), validators=[validate_grantable_scopes], default=list
    )
    # Always a human user, never another service account.
    created_by = FlexibleForeignKey("sentry.User", null=True, blank=True, on_delete=models.SET_NULL)
    date_added = models.DateTimeField(default=timezone.now)
    date_expires = models.DateTimeField(null=True)
    date_last_used = models.DateTimeField(null=True)
    # Null while the token is active. There's no separate flag that could disagree with it.
    date_deactivated = models.DateTimeField(null=True)

    class Meta:
        app_label = "service_accounts"
        db_table = "service_accounts_serviceaccounttoken"

    __repr__ = sane_repr("organization_id", "service_account_id", "name")

    def handle_async_replication(self, cell_name: str, shard_identifier: int) -> None:
        from sentry.hybridcloud.services.replica import cell_replica_service
        from sentry.service_accounts.services.service_account.serial import (
            serialize_service_account_token,
        )

        cell_replica_service.upsert_replicated_service_account_token(
            token=serialize_service_account_token(self),
            cell_name=cell_name,
        )


@cell_silo_model
class ServiceAccountTokenReplica(Model):
    """
    The cell's copy of a `ServiceAccountToken`, written by its outbox. Revoking the token
    keeps this row with `date_deactivated` set, so callers must check it, `date_expires` and
    the account's `is_active`.
    """

    __relocation_scope__ = RelocationScope.Excluded

    service_account = FlexibleForeignKey(
        "service_accounts.ServiceAccountReplica", on_delete=models.CASCADE
    )
    token_id = HybridCloudForeignKey(
        "service_accounts.ServiceAccountToken", null=False, on_delete="CASCADE", unique=True
    )
    organization = FlexibleForeignKey("sentry.Organization", on_delete=models.CASCADE)
    token_hashed = models.TextField()
    scope_list = ArrayField(models.TextField(), default=list)
    date_expires = models.DateTimeField(null=True)
    date_deactivated = models.DateTimeField(null=True)

    class Meta:
        app_label = "service_accounts"
        db_table = "service_accounts_serviceaccounttokenreplica"
        indexes = [
            models.Index(
                fields=["token_hashed"],
                name="sa_token_replica_hash_idx",
            ),
        ]

    __repr__ = sane_repr("organization_id", "token_id")
