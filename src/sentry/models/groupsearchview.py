from typing import Any

from django.contrib.postgres.fields.array import ArrayField
from django.db import models
from django.db.models import CheckConstraint, Q
from django.utils.translation import gettext_lazy as _

from sentry.backup.dependencies import PrimaryKeyMap
from sentry.backup.helpers import ImportFlags
from sentry.backup.scopes import ImportScope, RelocationScope
from sentry.db.models import cell_silo_model
from sentry.db.models.base import DefaultFieldsModel, DefaultFieldsModelExisting
from sentry.db.models.fields.foreignkey import FlexibleForeignKey
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.models.savedsearch import SortOptions

DEFAULT_TIME_FILTER = {"period": "14d"}


@cell_silo_model
class GroupSearchViewProject(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Organization

    group_search_view = FlexibleForeignKey("sentry.GroupSearchView", on_delete=models.CASCADE)
    project = FlexibleForeignKey("sentry.Project", on_delete=models.CASCADE)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_groupsearchviewproject"
        unique_together = (("group_search_view", "project"),)


class GroupSearchViewVisibility:
    ORGANIZATION = "organization"

    @classmethod
    def as_choices(cls) -> list[tuple[str, Any]]:
        return [(cls.ORGANIZATION, _("Organization"))]


@cell_silo_model
class GroupSearchView(DefaultFieldsModelExisting):
    """
    A model for a user's view of the issue stream
    """

    __relocation_scope__ = RelocationScope.Organization
    name = models.TextField(max_length=128)
    # SET_NULL: org-visible views must survive creator deletion.
    user_id = HybridCloudForeignKey("sentry.User", null=True, on_delete="SET_NULL")
    # Service accounts and org auth tokens authenticate without a user, so they need their
    # own creator columns. At most one creator column is set.
    created_by_service_account_id = HybridCloudForeignKey(
        "service_accounts.ServiceAccount", null=True, on_delete="SET_NULL"
    )
    created_by_org_auth_token_id = HybridCloudForeignKey(
        "sentry.OrgAuthToken", null=True, on_delete="SET_NULL"
    )
    organization = FlexibleForeignKey("sentry.Organization")

    visibility = models.CharField(
        max_length=16,
        db_default=GroupSearchViewVisibility.ORGANIZATION,
        choices=GroupSearchViewVisibility.as_choices(),
    )

    query = models.TextField()
    query_sort = models.CharField(
        max_length=16, default=SortOptions.DATE, choices=SortOptions.as_choices()
    )

    # Projects = [] maps to "My Projects" (This is so when a project is deleted, it correctly defaults to "My Projects")
    projects = models.ManyToManyField("sentry.Project", through="sentry.GroupSearchViewProject")
    # If is_all_projects is True, then override `projects` to be "All Projects"
    is_all_projects = models.BooleanField(db_default=False)
    # Environments = [] maps to "All Environments"
    environments = ArrayField(models.TextField(), default=list)
    time_filters = models.JSONField(null=False, db_default=DEFAULT_TIME_FILTER)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_groupsearchview"
        constraints = [
            CheckConstraint(
                condition=(
                    Q(created_by_service_account_id__isnull=True)
                    & Q(created_by_org_auth_token_id__isnull=True)
                )
                | (Q(user_id__isnull=True) & Q(created_by_org_auth_token_id__isnull=True))
                | (Q(user_id__isnull=True) & Q(created_by_service_account_id__isnull=True)),
                name="sentry_groupsearchview_single_creator",
            ),
        ]

    def normalize_before_relocation_import(
        self, pk_map: PrimaryKeyMap, scope: ImportScope, flags: ImportFlags
    ) -> int | None:
        # Org auth tokens are imported after every other model, so their new pks can't be mapped
        # here. Drop the reference rather than dropping the whole view.
        self.created_by_org_auth_token_id = None
        return super().normalize_before_relocation_import(pk_map, scope, flags)
