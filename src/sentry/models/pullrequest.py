from __future__ import annotations

from collections.abc import Mapping, Sequence
from datetime import datetime
from typing import Any, ClassVar

from django.contrib.postgres.fields import ArrayField
from django.db import models
from django.db.models import Exists, OuterRef, Q
from django.db.models.signals import post_save
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BoundedBigIntegerField,
    BoundedPositiveIntegerField,
    DefaultFieldsModel,
    FlexibleForeignKey,
    Model,
    cell_silo_model,
    sane_repr,
)
from sentry.db.models.fields.jsonfield import LegacyTextJSONField
from sentry.db.models.manager.base import BaseManager
from sentry.models.group import Group
from sentry.utils.groupreference import find_referenced_groups


class PullRequestLifecycleState(models.TextChoices):
    OPEN = "open"
    CLOSED = "closed"
    MERGED = "merged"
    LOCKED = "locked"
    SUPERSEDED = "superseded"


class PullRequestAttributionSignalType(models.TextChoices):
    SENTRY_APP = "sentry_app"
    SEER_DELEGATED_CURSOR = "seer_delegated:cursor"
    SEER_DELEGATED_GITHUB_COPILOT = "seer_delegated:github_copilot"
    SEER_DELEGATED_CLAUDE_CODE = "seer_delegated:claude_code"
    SEER_DELEGATED_UNKNOWN = "seer_delegated:unknown"
    MCP = "mcp"
    REFERENCED_ISSUE = "referenced_issue"
    UNKNOWN = "unknown"


class PullRequestAttributionSource(models.TextChoices):
    WEBHOOK_DATA = "webhook_data"
    SEER_DATA = "seer_data"
    SEER_LLM_JUDGE = "seer_llm_judge"


class PullRequestVerdict(models.TextChoices):
    MERGED_UNCHANGED = "merged_unchanged"
    MERGED_WITH_ITERATION = "merged_with_iteration"
    CLOSED_UNMERGED = "closed_unmerged"


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


@cell_silo_model
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

    closed_at = models.DateTimeField(null=True)
    merged_at = models.DateTimeField(null=True)
    state = models.CharField(max_length=32, null=True, choices=PullRequestLifecycleState.choices)
    head_commit_sha = models.CharField(max_length=64, null=True)

    objects: ClassVar[PullRequestManager] = PullRequestManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_pull_request"
        indexes = (
            models.Index(fields=("repository_id", "date_added")),
            models.Index(fields=("organization_id", "merge_commit_sha")),
            models.Index(fields=("organization_id", "head_commit_sha")),
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

    def is_unused(self, cutoff_date: datetime) -> bool:
        """
        Returns True if PR should be deleted, False if it should be kept.
        """
        # Use the class method to get the filter for unused PRs
        unused_filter = PullRequest.get_unused_filter(cutoff_date)

        # Check if this PR matches the unused filter
        return PullRequest.objects.filter(id=self.id).filter(unused_filter).exists()

    @classmethod
    def get_unused_filter(cls, cutoff_date: datetime) -> Q:
        """
        Returns a Q object that filters for unused PRs.
        This is the inverse of what makes a PR "in use".
        """
        from sentry.models.grouplink import GroupLink
        from sentry.models.releasecommit import ReleaseCommit
        from sentry.models.releaseheadcommit import ReleaseHeadCommit

        # Subquery for checking if there's a valid GroupLink
        grouplink_exists = Exists(
            GroupLink.objects.filter(
                linked_type=GroupLink.LinkedType.pull_request,
                linked_id=OuterRef("id"),
                group__project__isnull=False,
            )
        )

        # Subquery for checking if comment has valid group_ids
        # Note: Django aliases the table as U0 in the EXISTS subquery
        comment_has_valid_group = Exists(
            PullRequestComment.objects.filter(
                pull_request_id=OuterRef("id"),
                group_ids__isnull=False,
            )
            .exclude(group_ids__len=0)
            .extra(
                where=[
                    """EXISTS (
                        SELECT 1 FROM sentry_groupedmessage g
                        WHERE g.id = ANY(U0.group_ids)
                    )"""
                ]
            )
        )

        recent_comment_exists = Exists(
            PullRequestComment.objects.filter(
                pull_request_id=OuterRef("id"),
            ).filter(Q(created_at__gte=cutoff_date) | Q(updated_at__gte=cutoff_date))
        )

        commit_in_release = Exists(ReleaseCommit.objects.filter(commit_id=OuterRef("commit_id")))
        commit_in_head = Exists(ReleaseHeadCommit.objects.filter(commit_id=OuterRef("commit_id")))
        commit_exists = Exists(
            PullRequestCommit.objects.filter(
                pull_request_id=OuterRef("id"),
            ).filter(Q(commit__date_added__gte=cutoff_date) | commit_in_release | commit_in_head)
        )

        # Define what makes a PR "in use" (should be kept)
        keep_conditions = (
            Q(date_added__gte=cutoff_date)
            | recent_comment_exists
            | commit_exists
            | grouplink_exists
            | comment_has_valid_group
        )

        # Return the inverse - we want PRs that DON'T meet any keep conditions
        return ~keep_conditions


@cell_silo_model
class PullRequestCommit(Model):
    __relocation_scope__ = RelocationScope.Excluded
    pull_request = FlexibleForeignKey("sentry.PullRequest")
    commit = FlexibleForeignKey("sentry.Commit", db_constraint=False)

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


@cell_silo_model
class PullRequestComment(Model):
    __relocation_scope__ = RelocationScope.Excluded

    external_id = BoundedBigIntegerField()
    pull_request = FlexibleForeignKey("sentry.PullRequest")
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()
    group_ids = ArrayField(BoundedBigIntegerField())
    reactions = LegacyTextJSONField(null=True)
    comment_type = BoundedPositiveIntegerField(
        default=CommentType.MERGED_PR,
        db_default=CommentType.MERGED_PR,
        choices=CommentType.as_choices(),
        null=False,
    )

    class Meta:
        app_label = "sentry"
        db_table = "sentry_pullrequest_comment"
        unique_together = (("pull_request", "comment_type"),)


class PullRequestActivityType(models.TextChoices):
    ASSIGNED = "assigned"
    CLOSED = "closed"
    COMMENT_CREATED = "comment_created"
    COMMENT_DELETED = "comment_deleted"
    COMMENT_EDITED = "comment_edited"
    CONVERTED_TO_DRAFT = "converted_to_draft"
    EDITED = "edited"
    LABELED = "labeled"
    LOCKED = "locked"
    MERGED = "merged"
    OPENED = "opened"
    READY_FOR_REVIEW = "ready_for_review"
    REOPENED = "reopened"
    REVIEW_REQUESTED = "review_requested"
    REVIEW_REQUEST_REMOVED = "review_request_removed"
    REVIEW_SUBMITTED = "review_submitted"
    REVIEW_THREAD_RESOLVED = "review_thread_resolved"
    REVIEW_THREAD_UNRESOLVED = "review_thread_unresolved"
    SYNCHRONIZED = "synchronized"
    UNASSIGNED = "unassigned"
    UNLABELED = "unlabeled"
    UNLOCKED = "unlocked"


@cell_silo_model
class PullRequestActivity(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Excluded

    pull_request = FlexibleForeignKey("sentry.PullRequest")
    event_type = models.CharField(max_length=64, choices=PullRequestActivityType.choices)
    # The SCM webhook delivery id (e.g. GitHub's X-GitHub-Delivery). A row is only
    # created once we have this id, so it dedupes redelivered webhooks: a retry
    # hits the unique constraint instead of creating a duplicate activity row.
    webhook_id = models.CharField(max_length=255)
    payload = models.JSONField(default=dict)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_pullrequest_activity"
        indexes = (
            models.Index(fields=["pull_request", "date_added"]),
            models.Index(fields=["date_added"]),
        )
        unique_together = (("pull_request", "webhook_id"),)

    __repr__ = sane_repr("pull_request_id", "event_type")


@cell_silo_model
class PullRequestAttribution(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Excluded

    pull_request = FlexibleForeignKey("sentry.PullRequest")
    signal_type = models.CharField(max_length=64, choices=PullRequestAttributionSignalType.choices)
    signal_details = models.JSONField(null=True)
    source = models.CharField(max_length=128, choices=PullRequestAttributionSource.choices)
    is_valid = models.BooleanField(default=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_pullrequest_attribution"
        unique_together = (("pull_request", "signal_type", "source"),)

    __repr__ = sane_repr("pull_request_id", "signal_type")


@cell_silo_model
class PullRequestMetrics(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Excluded

    pull_request = models.OneToOneField(
        "sentry.PullRequest", on_delete=models.CASCADE, related_name="metrics"
    )
    verdict = models.CharField(max_length=64, null=True, choices=PullRequestVerdict.choices)
    additions = BoundedPositiveIntegerField(default=0)
    deletions = BoundedPositiveIntegerField(default=0)
    files_changed = BoundedPositiveIntegerField(default=0)
    commits_count = BoundedPositiveIntegerField(default=0)
    comments_count = BoundedPositiveIntegerField(default=0)
    participants_count = BoundedPositiveIntegerField(default=0)
    reviews_count = BoundedPositiveIntegerField(default=0)
    is_assigned = models.BooleanField(default=False)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_pullrequest_metrics"

    __repr__ = sane_repr("pull_request_id")
