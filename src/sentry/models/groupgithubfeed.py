from enum import Enum

from django.db import models
from django.utils import timezone

from sentry.db.models import (
    BoundedBigIntegerField,
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    Model,
    sane_repr,
)


class FeedType(Enum):
    BRANCH = 1
    PULL_REQUEST = 2


FEED_TYPES = {
    FeedType.BRANCH.value: "branch",
    FeedType.PULL_REQUEST.value: "pull_request",
}


class FeedStatus(Enum):
    # Branch statuses
    CREATED = 1
    DELETED = 2
    # PR statuses
    DRAFT = 3
    OPEN = 4
    MERGED = 5
    CLOSED = 6


FEED_STATUSES = {
    FeedStatus.CREATED.value: "created",
    FeedStatus.DELETED.value: "deleted",
    FeedStatus.DRAFT.value: "draft",
    FeedStatus.OPEN.value: "open",
    FeedStatus.MERGED.value: "merged",
    FeedStatus.CLOSED.value: "closed",
}


class GroupGithubFeed(Model):
    __include_in_export__ = False

    organization_id = BoundedPositiveIntegerField(db_index=True)
    group_id = BoundedBigIntegerField()
    branch_name = models.CharField(max_length=350)
    feed_type = models.IntegerField()
    feed_status = models.IntegerField(null=True)
    author = FlexibleForeignKey("sentry.CommitAuthor", null=True)
    display_name = models.CharField(max_length=350)
    url = models.URLField(null=True, blank=True)
    date_added = models.DateTimeField(default=timezone.now)
    visible = models.BooleanField(default=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_groupgithubfeed"
        unique_together = ("group_id", "branch_name")

    __repr__ = sane_repr("feed_type", "group_id")
