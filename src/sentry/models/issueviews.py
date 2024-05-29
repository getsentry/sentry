from django.db import models
from django.db.models import UniqueConstraint

from sentry.backup.scopes import RelocationScope
from sentry.db.models import region_silo_model
from sentry.db.models.base import DefaultFieldsModel
from sentry.db.models.fields.foreignkey import FlexibleForeignKey
from sentry.models.savedsearch import SortOptions


@region_silo_model
class IssueViews(DefaultFieldsModel):
    """
    A model for a user's view of the issue stream
    """

    __relocation_scope__ = RelocationScope.Organization
    name = models.TextField(max_length=128)
    query = models.TextField()
    query_sort = models.CharField(
        max_length=16, default=SortOptions.DATE, choices=SortOptions.as_choices(), null=True
    )
    position = models.PositiveSmallIntegerField(null=False)
    org_member_id = FlexibleForeignKey("sentry.OrganizationMember", null=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_issueviews"
        unique_together = ()
        # Two views cannot occupy the same position in a member's view order
        constraints = [
            UniqueConstraint(
                fields=["org_member_id", "position"],
                name="sentry_issueviews_unique_view_position_per_member",
            )
        ]

    @property
    def is_default(self):
        return self.position == 0
