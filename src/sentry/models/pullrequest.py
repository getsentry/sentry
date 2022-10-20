from __future__ import annotations

from typing import Any, Mapping

from django.db import models
from django.db.models.signals import post_save
from django.utils import timezone

from sentry.db.models import (
    BaseManager,
    BoundedBigIntegerField,
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    Model,
    region_silo_only_model,
    sane_repr,
)
from sentry.utils.groupreference import find_referenced_groups


class PullRequestManager(BaseManager):
    def update_or_create(
        self,
        defaults: Mapping[str, Any] | None = None,
        **kwargs: Any,
    ) -> tuple[Model, bool]:
        """
        Wraps `update_or_create()` and ensures `post_save` signals are fired for
        updated records as `GroupLink` functionality is dependent on signals
        being fired.
        """
        organization_id = kwargs.pop("organization_id")
        repository_id = kwargs.pop("repository_id")
        key = kwargs.pop("key")

        affected, created = super().update_or_create(
            organization_id=organization_id, repository_id=repository_id, key=key, defaults=defaults
        )
        if created is False:
            instance = self.get(
                organization_id=organization_id,
                repository_id=repository_id,
                key=key,
            )
            post_save.send(sender=self.__class__, instance=instance, created=created)
        return affected, created


@region_silo_only_model
class PullRequest(Model):
    __include_in_export__ = False

    organization_id = BoundedBigIntegerField(db_index=True)
    repository_id = BoundedPositiveIntegerField()

    key = models.CharField(max_length=64)  # example, 5131 on github

    date_added = models.DateTimeField(default=timezone.now)

    title = models.TextField(null=True)
    message = models.TextField(null=True)
    author = FlexibleForeignKey("sentry.CommitAuthor", null=True)
    merge_commit_sha = models.CharField(max_length=64, null=True)

    objects = PullRequestManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_pull_request"
        index_together = (("repository_id", "date_added"), ("organization_id", "merge_commit_sha"))
        unique_together = (("repository_id", "key"),)

    __repr__ = sane_repr("organization_id", "repository_id", "key")

    def find_referenced_groups(self):
        text = f"{self.message} {self.title}"
        return find_referenced_groups(text, self.organization_id)


@region_silo_only_model
class PullRequestCommit(Model):
    __include_in_export__ = False
    pull_request = FlexibleForeignKey("sentry.PullRequest")
    commit = FlexibleForeignKey("sentry.Commit")

    class Meta:
        app_label = "sentry"
        db_table = "sentry_pullrequest_commit"
        unique_together = (("pull_request", "commit"),)
