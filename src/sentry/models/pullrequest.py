from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import TYPE_CHECKING, Any, ClassVar

from django.contrib.postgres.fields import ArrayField as DjangoArrayField
from django.db import models
from django.db.models.signals import post_save
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BoundedBigIntegerField,
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    JSONField,
    Model,
    region_silo_model,
    sane_repr,
)
from sentry.db.models.manager.base import BaseManager
from sentry.utils.groupreference import find_referenced_groups

if TYPE_CHECKING:
    from sentry.models.group import Group


class PullRequestManager(BaseManager["PullRequest"]):
    def update_or_create(
        self,
        defaults: Mapping[str, Any] | None = None,
        create_defaults: Mapping[str, Any] | None = None,
        **kwargs: Any,
    ) -> tuple[PullRequest, bool]:
        """
        Wraps `update_or_create()` and ensures `post_save` signals are fired for
        updated records as `GroupLink` functionality is dependent on signals
        being fired.
        """
        organization_id = kwargs.pop("organization_id")
        repository_id = kwargs.pop("repository_id")
        key = kwargs.pop("key")

        affected, created = super().update_or_create(
            organization_id=organization_id,
            repository_id=repository_id,
            key=key,
            defaults=defaults,
            create_defaults=create_defaults,
        )
        if created is False:
            instance = self.get(
                organization_id=organization_id,
                repository_id=repository_id,
                key=key,
            )
            post_save.send(sender=self.__class__, instance=instance, created=created)
        return affected, created


@region_silo_model
class PullRequest(Model):
    __relocation_scope__ = RelocationScope.Excluded

    organization_id = BoundedBigIntegerField(db_index=True)
    repository_id = BoundedPositiveIntegerField()

    key = models.CharField(max_length=64)  # example, 5131 on github

    date_added = models.DateTimeField(default=timezone.now, db_index=True)

    title = models.TextField(null=True)
    message = models.TextField(null=True)
    author = FlexibleForeignKey("sentry.CommitAuthor", null=True)
    merge_commit_sha = models.CharField(max_length=64, null=True, db_index=True)

    objects: ClassVar[PullRequestManager] = PullRequestManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_pull_request"
        indexes = (
            models.Index(fields=("repository_id", "date_added")),
            models.Index(fields=("organization_id", "merge_commit_sha")),
        )
        unique_together = (("repository_id", "key"),)

    __repr__ = sane_repr("organization_id", "repository_id", "key")

    def find_referenced_groups(self) -> set[Group]:
        text = f"{self.message} {self.title}"
        return find_referenced_groups(text, self.organization_id)

    def get_external_url(self) -> str | None:
        from sentry.models.repository import Repository
        from sentry.plugins.base import bindings

        repository = Repository.objects.get(id=self.repository_id)

        provider_id = repository.provider
        if not provider_id or not provider_id.startswith("integrations:"):
            return None
        provider_cls = bindings.get("integration-repository.provider").get(provider_id)
        provider = provider_cls(provider_id)
        return provider.pull_request_url(repository, self)


@region_silo_model
class PullRequestCommit(Model):
    __relocation_scope__ = RelocationScope.Excluded
    pull_request = FlexibleForeignKey("sentry.PullRequest")
    commit = FlexibleForeignKey("sentry.Commit")

    class Meta:
        app_label = "sentry"
        db_table = "sentry_pullrequest_commit"
        unique_together = (("pull_request", "commit"),)


class CommentType:
    MERGED_PR = 0
    OPEN_PR = 1

    @classmethod
    def as_choices(cls) -> Sequence[tuple[int, str]]:
        return ((cls.MERGED_PR, "merged_pr"), (cls.OPEN_PR, "open_pr"))


@region_silo_model
class PullRequestComment(Model):
    __relocation_scope__ = RelocationScope.Excluded

    external_id = BoundedBigIntegerField()
    pull_request = FlexibleForeignKey("sentry.PullRequest")
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()
    group_ids = DjangoArrayField(BoundedBigIntegerField())
    reactions = JSONField(null=True)
    comment_type = BoundedPositiveIntegerField(
        default=CommentType.MERGED_PR, choices=CommentType.as_choices(), null=False
    )

    class Meta:
        app_label = "sentry"
        db_table = "sentry_pullrequest_comment"
        unique_together = (("pull_request", "comment_type"),)
