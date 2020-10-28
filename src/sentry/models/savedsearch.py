from __future__ import absolute_import, print_function

from django.db import models
from django.utils import timezone

from sentry.db.models import FlexibleForeignKey, Model, sane_repr
from sentry.models.search_common import SearchType


class SavedSearch(Model):
    """
    A saved search query.
    """

    __core__ = True
    # TODO: Remove this column and rows where it's not null once we've
    # completely removed Sentry 9
    project = FlexibleForeignKey("sentry.Project", null=True)
    organization = FlexibleForeignKey("sentry.Organization", null=True)
    type = models.PositiveSmallIntegerField(default=SearchType.ISSUE.value, null=True)
    name = models.CharField(max_length=128)
    query = models.TextField()
    date_added = models.DateTimeField(default=timezone.now)
    # TODO: Remove this column once we've completely removed Sentry 9
    is_default = models.BooleanField(default=False)
    is_global = models.NullBooleanField(null=True, default=False, db_index=True)
    owner = FlexibleForeignKey("sentry.User", null=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_savedsearch"
        # Note that we also have a partial unique constraint on:
        #   (organization_id, name, type) WHERE owner_id IS NULL
        #   (is_global, name) WHERE is_global
        unique_together = (
            ("project", "name"),
            # Each user can have one default search per org
            ("organization", "owner", "type"),
        )

    @property
    def is_pinned(self):
        if hasattr(self, "_is_pinned"):
            return self._is_pinned
        return self.owner is not None and self.organization is not None

    @is_pinned.setter
    def is_pinned(self, value):
        self._is_pinned = value

    @property
    def is_org_custom_search(self):
        return self.owner is None and self.organization is not None

    __repr__ = sane_repr("project_id", "name")


# TODO: Remove once we've completely removed sentry 9
class SavedSearchUserDefault(Model):
    """
    Indicates the default saved search for a given user
    """

    __core__ = True

    savedsearch = FlexibleForeignKey("sentry.SavedSearch")
    project = FlexibleForeignKey("sentry.Project")
    user = FlexibleForeignKey("sentry.User")

    class Meta:
        unique_together = (("project", "user"),)
        app_label = "sentry"
        db_table = "sentry_savedsearch_userdefault"
