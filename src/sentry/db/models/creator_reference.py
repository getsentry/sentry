from __future__ import annotations

from django.db import models
from django.db.models import Q

from sentry.backup.dependencies import PrimaryKeyMap
from sentry.backup.helpers import ImportFlags
from sentry.backup.scopes import ImportScope
from sentry.db.models.base import BaseModel
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey


def single_creator_constraint(
    name: str, user_field: str = "created_by_id"
) -> models.CheckConstraint:
    """At most one of the user, service account, and org auth token creator columns is set."""
    user_null = Q(**{f"{user_field}__isnull": True})
    return models.CheckConstraint(
        condition=(
            Q(created_by_service_account_id__isnull=True)
            & Q(created_by_org_auth_token_id__isnull=True)
        )
        | (user_null & Q(created_by_org_auth_token_id__isnull=True))
        | (user_null & Q(created_by_service_account_id__isnull=True)),
        name=name,
    )


class CreatorReferenceModel(BaseModel):
    """
    Records who created a row. Service accounts and org auth tokens authenticate without a
    user, so they need their own creator columns. Fill these with `get_creator_reference`,
    and add `single_creator_constraint` to the model's constraints. Put this class before
    the model's other bases so its relocation hook runs.
    """

    # SET_NULL: shared resources must survive their creator's deletion.
    created_by_id = HybridCloudForeignKey("sentry.User", null=True, on_delete="SET_NULL")
    created_by_service_account_id = HybridCloudForeignKey(
        "service_accounts.ServiceAccount", null=True, on_delete="SET_NULL"
    )
    created_by_org_auth_token_id = HybridCloudForeignKey(
        "sentry.OrgAuthToken", null=True, on_delete="SET_NULL"
    )

    class Meta:
        abstract = True

    def normalize_before_relocation_import(
        self, pk_map: PrimaryKeyMap, scope: ImportScope, flags: ImportFlags
    ) -> int | None:
        # Org auth tokens are imported after every other model, so their new pks can't be mapped
        # here. Drop the reference rather than dropping the whole row.
        self.created_by_org_auth_token_id = None
        return super().normalize_before_relocation_import(pk_map, scope, flags)
