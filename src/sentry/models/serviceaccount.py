from __future__ import annotations

from collections.abc import Iterable

from django.conf import settings
from django.contrib.postgres.fields.array import ArrayField
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, control_silo_model, sane_repr
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.hybridcloud.outbox.base import ReplicatedControlModel
from sentry.hybridcloud.outbox.category import OutboxCategory

__all__ = ("ServiceAccount", "ServiceAccountProject")

# Matches the `name` serializer in the service account API.
MAX_NAME_LENGTH = 64

# OIDC scopes describe a human login, so a service account can't hold them.
GRANTABLE_SCOPES = frozenset(settings.SENTRY_SCOPES - {"openid", "profile", "email"})


def validate_grantable_scopes(value: Iterable[str]) -> None:
    for scope in value:
        if scope not in GRANTABLE_SCOPES:
            raise ValidationError(f"{scope} is not a scope a service account can hold.")


@control_silo_model
class ServiceAccount(ReplicatedControlModel):
    """
    A non-human principal that belongs to one organization. It has no organization
    membership: `scope_list` is the ceiling for everything it can do in the org.

    Cells don't keep a copy of this row. They read it through a cached RPC, and the
    outbox written on every change is what clears that cache in the org's cell.
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
        app_label = "sentry"
        db_table = "sentry_serviceaccount"
        constraints = [
            models.UniqueConstraint(
                fields=["organization_id", "name"],
                name="sentry_serviceaccount_org_name_unique",
            ),
        ]

    __repr__ = sane_repr("organization_id", "name")


@control_silo_model
class ServiceAccountProject(DefaultFieldsModel):
    """
    A project a service account can access when its org doesn't have open membership.
    Projects live in the cell, so the link is a hybrid cloud foreign key and the row is
    removed by the tombstone cascade after the project is deleted.

    Code that changes these rows must also save the account in the same transaction,
    because the account's outbox is what clears the cell's cached copy of its projects.
    """

    __relocation_scope__ = RelocationScope.Organization

    service_account = FlexibleForeignKey("sentry.ServiceAccount", on_delete=models.CASCADE)
    project_id = HybridCloudForeignKey("sentry.Project", null=False, on_delete="CASCADE")

    class Meta:
        app_label = "sentry"
        db_table = "sentry_serviceaccountproject"
        constraints = [
            models.UniqueConstraint(
                fields=["service_account", "project_id"],
                name="sentry_serviceaccountproject_unique",
            ),
        ]

    __repr__ = sane_repr("service_account_id", "project_id")
