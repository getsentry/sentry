from django.db import models
from django.db.models import UniqueConstraint
from django.utils.translation import gettext_lazy as _

from sentry.db.models import region_silo_model
from sentry.db.models.base import DefaultFieldsModel
from sentry.db.models.fields.foreignkey import FlexibleForeignKey


class SortOptions:
    DATE = "date"
    NEW = "new"
    TRENDS = "trends"
    FREQ = "freq"
    USER = "user"
    INBOX = "inbox"

    @classmethod
    def as_choices(cls):
        return (
            (cls.DATE, _("Last Seen")),
            (cls.NEW, _("First Seen")),
            (cls.TRENDS, _("Trends")),
            (cls.FREQ, _("Events")),
            (cls.USER, _("Users")),
            (cls.INBOX, _("Date Added")),
        )


@region_silo_model
class IssueUserViews(DefaultFieldsModel):
    """
    A model for a user's view of the issue stream
    """

    # Open Questions:
    #   - Do we need to store the search type (like in savedsearches)
    #   - What is the character limit on the name field?

    name = models.TextField()  # Limit?
    query = models.TextField()
    query_sort = models.CharField(
        max_length=16, default=SortOptions.DATE, choices=SortOptions.as_choices(), null=True
    )
    position = models.PositiveSmallIntegerField(null=False)
    org_member_id = FlexibleForeignKey("sentry.OrganizationMember", null=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_issueuserviews"
        unique_together = ()
        # Two views cannot occupy the same position in a member's view order
        constraints = [
            UniqueConstraint(
                fields=["org_member_id", "position"],
                name="sentry_issueuserviews_unique_view_position_per_member",
            )
        ]

    @property
    def is_default(self):
        return self.position == 0
