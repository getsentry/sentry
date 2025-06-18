from typing import Any

from django.contrib.postgres.fields.array import ArrayField
from django.db import models
from django.utils.translation import gettext_lazy as _

from sentry.backup.scopes import RelocationScope
from sentry.db.models import region_silo_model
from sentry.db.models.base import DefaultFieldsModel, DefaultFieldsModelExisting
from sentry.db.models.fields.foreignkey import FlexibleForeignKey
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.models.savedsearch import SortOptions

DEFAULT_TIME_FILTER = {"period": "14d"}


@region_silo_model
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


@region_silo_model
class GroupSearchView(DefaultFieldsModelExisting):
    """
    A model for a user's view of the issue stream
    """

    __relocation_scope__ = RelocationScope.Organization
    name = models.TextField(max_length=128)
    user_id = HybridCloudForeignKey("sentry.User", on_delete="CASCADE")
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
