from enum import Enum

from django.db import models

from sentry.db.models import (
    BoundedBigIntegerField,
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    sane_repr,
)
from sentry.models import DefaultFieldsModel


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


class GroupGithubActivity(DefaultFieldsModel):
    __include_in_export__ = False

    organization_id = BoundedPositiveIntegerField()
    group_id = BoundedBigIntegerField(db_index=True)
    branch_name = models.CharField(max_length=350)
    feed_type = models.PositiveSmallIntegerField()
    feed_status = models.PositiveSmallIntegerField(null=True)
    author = FlexibleForeignKey("sentry.CommitAuthor", null=True)
    display_name = models.CharField(max_length=350)
    url = models.URLField(null=True, blank=True)
    visible = models.BooleanField(default=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_groupgithubactivity"
        unique_together = ("group_id", "branch_name")

    __repr__ = sane_repr("feed_type", "group_id")
