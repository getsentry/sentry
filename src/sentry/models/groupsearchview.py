from django.db import models
from django.db.models import UniqueConstraint

from sentry.backup.scopes import RelocationScope
from sentry.db.models import region_silo_model
from sentry.db.models.base import DefaultFieldsModelExisting
from sentry.db.models.fields.foreignkey import FlexibleForeignKey
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.models.savedsearch import SortOptions


@region_silo_model
class GroupSearchView(DefaultFieldsModelExisting):
    """
    A model for a user's view of the issue stream
    """

    __relocation_scope__ = RelocationScope.Organization
    name = models.TextField(max_length=128)
    user_id = HybridCloudForeignKey("sentry.User", on_delete="CASCADE")
    organization = FlexibleForeignKey("sentry.Organization")

    query = models.TextField()
    query_sort = models.CharField(
        max_length=16, default=SortOptions.DATE, choices=SortOptions.as_choices()
    )
    position = models.PositiveSmallIntegerField()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_groupsearchview"
        # Two views cannot occupy the same position in an organization user's list of views
        constraints = [
            UniqueConstraint(
                fields=["user_id", "organization_id", "position"],
                name="sentry_issueviews_unique_view_position_per_org_user",
                deferrable=models.Deferrable.DEFERRED,
            )
        ]

    @property
    def is_default(self):
        return self.position == 0
