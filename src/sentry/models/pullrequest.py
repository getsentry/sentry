from __future__ import annotations

import re
from collections.abc import Mapping, Sequence
from datetime import datetime
from typing import TYPE_CHECKING, Any, ClassVar, NamedTuple

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
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.group import Group
from sentry.utils.groupreference import find_referenced_groups

if TYPE_CHECKING:
    from sentry.models.repository import RepoResolution


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


class PullRequestAttributionSource(models.TextChoices):
    WEBHOOK_DATA = "webhook_data"
    SEER_DATA = "seer_data"
    SEER_LLM_JUDGE = "seer_llm_judge"


class PullRequestVerdict(models.TextChoices):
    MERGED_UNCHANGED = "merged_unchanged"
    MERGED_WITH_ITERATION = "merged_with_iteration"
    CLOSED_UNMERGED = "closed_unmerged"
    # Transient, internal: a terminal event whose outcome a judge must decide has
    # been claimed and forwarded to Seer, but the judged verdict hasn't returned.
    # Reuses the verdict column as the redelivery guard so a redelivered terminal
    # event won't forward twice; Seer's callback overwrites it with a real verdict.
    # Never a judge *result* — the callback rejects it coming back from Seer.
    JUDGE_IN_PROGRESS = "judge_in_progress"
    # Transient, internal: a terminal event has been claimed at the close/merge
    # webhook and an emission task scheduled, but the cooldown window (during which
    # late attribution and activity settle) hasn't elapsed yet. Reuses the verdict
    # column as the redelivery guard so a redelivered terminal event won't schedule
    # a second task; the cooldown task overwrites it with a real verdict (or the
    # JUDGE_IN_PROGRESS sentinel). Never a judge *result*.
    WAITING_EVENT_COOLDOWN = "waiting_event_cooldown"


# SCM providers that can legitimately back a Repository. A reporting source (Seer, a
# delegated coding agent, a future integration) normalizes its provider to one of these
# (lowercased, no ``integrations:`` prefix); anything else is a value we don't understand
# and should be fixed upstream.
_KNOWN_SCM_PROVIDERS = frozenset(
    {
        IntegrationProviderSlug.GITHUB,
        IntegrationProviderSlug.GITHUB_ENTERPRISE,
        IntegrationProviderSlug.GITLAB,
        IntegrationProviderSlug.BITBUCKET,
        IntegrationProviderSlug.BITBUCKET_SERVER,
        IntegrationProviderSlug.AZURE_DEVOPS,
        IntegrationProviderSlug.PERFORCE,
    }
)


class ResolvedPullRequest(NamedTuple):
    """Result of resolving an externally-reported PR to its canonical ``PullRequest``.

    ``pull_request`` is None when the reported ``(repo_name, provider)`` doesn't map to
    exactly one active ``Repository``; ``repo_resolution`` says why, and
    ``provider_unmappable`` flags a *present* provider string we don't map (an empty or
    ``"unknown"`` provider is treated as absent, not unmappable). Callers decide how (and
    whether) to log these under their own namespace.
    """

    pull_request: PullRequest | None
    repo_resolution: RepoResolution
    provider_unmappable: bool


def parse_pull_request_number(url: str) -> int | None:
    """Extract the PR/MR number from a pull-request URL, or None if there isn't one.

    Matches the number after a ``/pull/`` (GitHub) or ``/merge_requests/`` (GitLab)
    segment specifically — a source can report a branch/``tree`` URL as its result, and
    we must not mistake a trailing branch-name segment for a PR number.
    """
    match = re.search(r"/(?:pull|pulls|merge_requests)/(\d+)", url)
    return int(match.group(1)) if match else None


def normalize_scm_provider(provider: str | None) -> str | None:
    """Normalize a reported SCM provider to Sentry's unprefixed form, or None if unusable.

    Returns None for the ``"unknown"`` sentinel (the source couldn't resolve the repo) and
    for empty values — neither can scope a provider filter. Lowercases before the sentinel
    check so any casing (e.g. ``UNKNOWN``) is treated as unknown.
    """
    if not provider:
        return None
    provider = provider.lower()
    if provider.startswith("integrations:"):
        provider = provider.split(":", 1)[1]
    if provider == "unknown":
        return None
    return provider


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

    def get_or_create_from_reference(
        self,
        *,
        organization_id: int,
        repo_name: str,
        provider: str | None,
        key: int | str,
    ) -> ResolvedPullRequest:
        """Resolve an externally-reported ``(repo_name, provider, key)`` to its canonical PR.

        Resolves the org-scoped active ``Repository`` (via ``RepositoryManager.resolve_active``),
        then find-or-creates the ``PullRequest`` keyed on ``key`` (the PR number). The
        find-or-create may run before the SCM ``opened`` webhook arrives, so the row can be
        a shell (no title/body) the webhook fills in later — we never overwrite it here.

        Returns a ``ResolvedPullRequest``; ``pull_request`` is None when the repo can't be
        uniquely resolved. Does not log or swallow errors — callers own observability and
        error handling. Shared by every path that learns of a PR by repo name + provider
        rather than through an SCM installation (e.g. Seer-created and delegated-agent
        attribution).
        """
        from sentry.models.repository import Repository

        normalized_provider = normalize_scm_provider(provider)
        provider_unmappable = (
            normalized_provider is not None and normalized_provider not in _KNOWN_SCM_PROVIDERS
        )

        repository, resolution = Repository.objects.resolve_active(
            organization_id=organization_id,
            name=repo_name,
            normalized_provider=normalized_provider,
        )
        if repository is None:
            return ResolvedPullRequest(None, resolution, provider_unmappable)

        # get_or_create is race-safe via the unique constraint on (repository, key) —
        # Django retries the get on IntegrityError.
        pull_request, _ = self.get_or_create(
            organization_id=organization_id,
            repository_id=repository.id,
            key=str(key),
        )
        return ResolvedPullRequest(pull_request, "resolved", provider_unmappable)


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

    # Facts for the PR metrics pipeline, kept current by the GitHub webhook.
    # All nullable: we only have them for PRs whose events Sentry actually saw.
    # A late-installed integration, a missed/dropped webhook, or a non-webhook
    # creation path (e.g. attribution get_or_create) leaves them unset.
    opened_at = models.DateTimeField(null=True)
    closed_at = models.DateTimeField(null=True)
    merged_at = models.DateTimeField(null=True)
    state = models.CharField(max_length=32, null=True, choices=PullRequestLifecycleState.choices)
    head_commit_sha = models.CharField(max_length=64, null=True)
    draft = models.BooleanField(null=True)

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
    AUTO_MERGE_DISABLED = "auto_merge_disabled"
    AUTO_MERGE_ENABLED = "auto_merge_enabled"
    CHECK_RUN_COMPLETED = "check_run_completed"
    CHECK_SUITE_COMPLETED = "check_suite_completed"
    CLOSED = "closed"
    COMMENT_CREATED = "comment_created"
    COMMENT_EDITED = "comment_edited"
    CONVERTED_TO_DRAFT = "converted_to_draft"
    DEQUEUED = "dequeued"
    EDITED = "edited"
    ENQUEUED = "enqueued"
    LABELED = "labeled"
    LOCKED = "locked"
    MERGED = "merged"
    OPENED = "opened"
    READY_FOR_REVIEW = "ready_for_review"
    REOPENED = "reopened"
    REVIEW_DISMISSED = "review_dismissed"
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
class PullRequestActivityLog(DefaultFieldsModel):
    """One reduced activity document per PR — the 1:1 replacement for the
    per-webhook-event ``PullRequestActivity`` rows (see
    ``sentry.pr_metrics.activity_doc`` for the document shape and reducer).

    A dedicated 1:1 model rather than a field on ``PullRequestMetrics``: the doc
    is swept at the terminal emit while the metrics row must survive, and
    ``handle_metrics`` rewrites the metrics row on every ``pull_request`` webhook.
    """

    __relocation_scope__ = RelocationScope.Excluded

    pull_request = models.OneToOneField(
        "sentry.PullRequest", on_delete=models.CASCADE, related_name="activity_log"
    )
    # Column is TOAST-compressed with lz4 (set in migration 1133).
    data = models.JSONField(default=dict)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_pullrequest_activity_log"

    __repr__ = sane_repr("pull_request_id")


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
    """One row per PR holding its metrics — the size/activity counters plus the
    terminal ``verdict``.

    Kept current by the metrics pipeline on each ``pull_request`` webhook and read
    by the emit/judge path — which, on the Seer callback, has no payload, so the
    values are stored here rather than re-derived at read time.
    """

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
    review_comments_count = BoundedPositiveIntegerField(default=0, db_default=0)
    participants_count = BoundedPositiveIntegerField(default=0)
    reviews_count = BoundedPositiveIntegerField(default=0)
    is_assigned = models.BooleanField(default=False)
    # Human-involvement splits derived from the activity log at the terminal event
    # (see ``pr_metrics.emit``). ``reviews_count`` = reviews_bot_count +
    # reviews_human_count. Pushes count push events (opened + synchronize), not
    # individual commits, split by the pusher's account class. All 0 when activity
    # isn't tracked.
    reviews_bot_count = BoundedPositiveIntegerField(default=0, db_default=0)
    reviews_human_count = BoundedPositiveIntegerField(default=0, db_default=0)
    pushes_bot_count = BoundedPositiveIntegerField(default=0, db_default=0)
    pushes_human_count = BoundedPositiveIntegerField(default=0, db_default=0)
    # Who opened / closed the PR, by account class: True = Bot, False = human, null
    # = the event was never recorded (activity not tracked, or a missed webhook).
    # ``opened_and_closed_by_same_actor`` compares the opener's and closer's logins;
    # null when either side is unknown.
    opened_by_bot = models.BooleanField(null=True)
    closed_by_bot = models.BooleanField(null=True)
    opened_and_closed_by_same_actor = models.BooleanField(null=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_pullrequest_metrics"

    __repr__ = sane_repr("pull_request_id")
