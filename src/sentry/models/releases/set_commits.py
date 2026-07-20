from __future__ import annotations

import itertools
import logging
import re
from typing import Any, TypedDict

from django.db import IntegrityError, router

from sentry.constants import ObjectStatus
from sentry.db.postgres.transactions import in_test_hide_transaction_boundary
from sentry.locks import locks
from sentry.models.activity import Activity
from sentry.models.commit import Commit
from sentry.models.commitauthor import CommitAuthor
from sentry.models.commitfilechange import CommitFileChange
from sentry.models.grouphistory import GroupHistoryStatus, record_group_history
from sentry.models.groupinbox import GroupInbox, GroupInboxRemoveAction, remove_group_from_inbox
from sentry.models.release import Release
from sentry.models.releases.exceptions import ReleaseCommitError
from sentry.signals import issue_resolved
from sentry.types.activity import ActivityType
from sentry.users.services.user import RpcUser
from sentry.utils import metrics
from sentry.utils.db import atomic_transaction
from sentry.utils.retries import TimedRetryPolicy
from sentry.utils.strings import truncatechars

logger = logging.getLogger(__name__)
from sentry.integrations.tasks.kick_off_status_syncs import kick_off_status_syncs
from sentry.models.group import Group, GroupStatus
from sentry.models.grouplink import GroupLink
from sentry.models.groupresolution import GroupResolution
from sentry.models.pullrequest import PullRequest
from sentry.models.releasecommit import ReleaseCommit
from sentry.models.releaseheadcommit import ReleaseHeadCommit
from sentry.models.repository import Repository
from sentry.plugins.providers.integration_repository import IntegrationRepositoryProvider


class _CommitDataKwargs(TypedDict, total=False):
    author: CommitAuthor
    message: str
    date_added: str


def set_commits(release, commit_list):
    commit_list.sort(key=lambda commit: commit.get("timestamp", 0), reverse=True)

    commit_list = [
        c
        for c in commit_list
        if not IntegrationRepositoryProvider.should_ignore_commit(c.get("message", ""))
    ]
    lock_key = Release.get_lock_key(release.organization_id, release.id)
    # Acquire the lock for a maximum of 10 minutes
    lock = locks.get(lock_key, duration=10 * 60, name="release_set_commits")
    if lock.locked():
        # Signal failure to the consumer rapidly. This aims to prevent the number
        # of timeouts and prevent web worker exhaustion when customers create
        # the same release rapidly for different projects.
        raise ReleaseCommitError

    with TimedRetryPolicy(10)(lock.acquire):
        create_repositories(commit_list, release)
        create_commit_authors(commit_list, release)

        with (
            atomic_transaction(using=router.db_for_write(type(release))),
            in_test_hide_transaction_boundary(),
        ):
            head_commit_by_repo, commit_author_by_commit = set_commits_on_release(
                release, commit_list
            )

    fill_in_missing_release_head_commits(release, head_commit_by_repo)
    update_group_resolutions(release, commit_author_by_commit)


@metrics.wraps("set_commits_on_release")
def set_commits_on_release(release, commit_list):
    # TODO(dcramer): would be good to optimize the logic to avoid these
    # deletes but not overly important
    ReleaseCommit.objects.filter(release=release).delete()

    commit_author_by_commit = {}
    head_commit_by_repo: dict[int, int] = {}

    latest_commit = None
    for idx, data in enumerate(commit_list):
        commit = set_commit(idx, data, release)
        if idx == 0:
            latest_commit = commit

        commit_author_by_commit[commit.id] = commit.author
        head_commit_by_repo.setdefault(data["repo_model"].id, commit.id)

    release.update(
        commit_count=len(commit_list),
        authors=[
            str(a_id)
            for a_id in ReleaseCommit.objects.filter(
                release=release, commit__author_id__isnull=False
            )
            .values_list("commit__author_id", flat=True)
            .distinct()
        ],
        last_commit_id=latest_commit.id if latest_commit else None,
    )
    return head_commit_by_repo, commit_author_by_commit


def set_commit(idx, data, release):
    repo = data["repo_model"]
    author = data["author_model"]

    commit_data: _CommitDataKwargs = {}

    # Update/set message and author if they are provided.
    if author is not None:
        commit_data["author"] = author
    if "message" in data:
        commit_data["message"] = data["message"]
    if "timestamp" in data:
        commit_data["date_added"] = data["timestamp"]

    commit, created = Commit.objects.get_or_create(
        organization_id=release.organization_id,
        repository_id=repo.id,
        key=data["id"],
        defaults=commit_data,
    )
    if not created and any(getattr(commit, key) != value for key, value in commit_data.items()):
        commit.update(**commit_data)

    if author is None:
        author = commit.author

    # Guard against patch_set being None
    patch_set = data.get("patch_set") or []
    if patch_set:
        CommitFileChange.objects.bulk_create(
            [
                CommitFileChange(
                    organization_id=release.organization.id,
                    commit_id=commit.id,
                    filename=patched_file["path"],
                    type=patched_file["type"],
                )
                for patched_file in patch_set
            ],
            ignore_conflicts=True,
            batch_size=100,
        )
    try:
        with atomic_transaction(using=router.db_for_write(ReleaseCommit)):
            ReleaseCommit.objects.create(
                organization_id=release.organization_id,
                release=release,
                commit=commit,
                order=idx,
            )
    except IntegrityError:
        pass

    return commit


def fill_in_missing_release_head_commits(release, head_commit_by_repo):
    # fill any missing ReleaseHeadCommit entries
    for repo_id, commit_id in head_commit_by_repo.items():
        try:
            with atomic_transaction(using=router.db_for_write(ReleaseHeadCommit)):
                ReleaseHeadCommit.objects.create(
                    organization_id=release.organization_id,
                    release_id=release.id,
                    repository_id=repo_id,
                    commit_id=commit_id,
                )
        except IntegrityError:
            pass


def update_group_resolutions(release, commit_author_by_commit):
    release_commits = list(
        ReleaseCommit.objects.filter(release=release)
        .select_related("commit")
        .values("commit_id", "commit__key", "commit__repository_id")
    )
    release_project_ids = list(release.projects.values_list("id", flat=True))

    commit_resolutions = list(
        GroupLink.objects.filter(
            project_id__in=release_project_ids,
            linked_type=GroupLink.LinkedType.commit,
            linked_id__in=[rc["commit_id"] for rc in release_commits],
        ).values_list("group_id", "linked_id")
    )

    commit_group_authors = [
        (cr[0], commit_author_by_commit.get(cr[1]))
        for cr in commit_resolutions  # group_id
    ]

    # repository_id is fetched here so we don't need a second PullRequest query
    # below to resolve providers (pull_request_resolutions is always a subset).
    pr_repo_ids = dict(
        PullRequest.objects.filter(
            merge_commit_sha__in=[rc["commit__key"] for rc in release_commits],
            organization_id=release.organization_id,
        ).values_list("id", "repository_id")
    )
    pr_ids_by_merge_commit = list(pr_repo_ids.keys())

    pull_request_resolutions = list(
        GroupLink.objects.filter(
            project_id__in=release_project_ids,
            relationship=GroupLink.Relationship.resolves,
            linked_type=GroupLink.LinkedType.pull_request,
            linked_id__in=pr_ids_by_merge_commit,
        ).values_list("group_id", "linked_id")
    )

    pr_authors = list(
        PullRequest.objects.filter(
            id__in=[prr[1] for prr in pull_request_resolutions]
        ).select_related("author")
    )

    pr_authors_dict = {pra.id: pra.author for pra in pr_authors}

    pull_request_group_authors = [
        (prr[0], pr_authors_dict.get(prr[1])) for prr in pull_request_resolutions
    ]

    # Map each resolved group to the (normalized) provider of the commit/PR that
    # resolved it, so the issue_resolved analytics event records e.g. "github".
    # commit -> repository_id comes for free from the select_related above;
    # pr -> repository_id was already collected in pr_repo_ids above.
    commit_repo_ids = {rc["commit_id"]: rc["commit__repository_id"] for rc in release_commits}
    repo_providers = dict(
        Repository.objects.filter(
            id__in=set(commit_repo_ids.values()) | set(pr_repo_ids.values())
        ).values_list("id", "provider")
    )
    # Iterate PRs first, commits second, so a commit-derived provider wins when a
    # group is resolved by both. The repo_id guards prevent a repo-less link from
    # overwriting a valid provider with None.
    provider_by_group: dict[int, str | None] = {}
    for group_id, pr_id in pull_request_resolutions:
        if (repo_id := pr_repo_ids.get(pr_id)) is not None:
            provider_by_group[group_id] = normalize_provider_key(repo_providers.get(repo_id))
    for group_id, commit_id in commit_resolutions:
        if (repo_id := commit_repo_ids.get(commit_id)) is not None:
            provider_by_group[group_id] = normalize_provider_key(repo_providers.get(repo_id))

    # Map each resolved group to the commit that resolved it, so the
    # issue_resolved analytics event records the commit id. Commit resolutions
    # carry the commit id directly; PR resolutions are mapped through the PR's
    # merge_commit_sha to the matching release commit (no extra query needed,
    # since PRs were already filtered by merge_commit_sha above). PRs are
    # iterated first so a direct commit resolution wins when a group has both.
    commit_id_by_group: dict[int, int] = {}
    commit_id_by_commit_key = {rc["commit__key"]: rc["commit_id"] for rc in release_commits}
    pr_merge_sha = {pra.id: pra.merge_commit_sha for pra in pr_authors}
    for group_id, pr_id in pull_request_resolutions:
        merge_sha = pr_merge_sha.get(pr_id)
        pr_commit_id = commit_id_by_commit_key.get(merge_sha) if merge_sha is not None else None
        if pr_commit_id is not None:
            commit_id_by_group[group_id] = pr_commit_id
    for group_id, commit_id in commit_resolutions:
        commit_id_by_group[group_id] = commit_id

    user_by_author: dict[CommitAuthor | None, RpcUser | None] = {None: None}

    commits_and_prs = list(itertools.chain(commit_group_authors, pull_request_group_authors))
    group_project_lookup = dict(
        Group.objects.filter(id__in=[group_id for group_id, _ in commits_and_prs]).values_list(
            "id", "project_id"
        )
    )

    for group_id, author in commits_and_prs:
        if author is not None and author not in user_by_author:
            try:
                user_by_author[author] = author.find_users()[0]
            except IndexError:
                user_by_author[author] = None
        actor = user_by_author[author]

        with atomic_transaction(
            using=(
                router.db_for_write(GroupResolution),
                router.db_for_write(Group),
                # inside the remove_group_from_inbox
                router.db_for_write(GroupInbox),
                router.db_for_write(Activity),
            )
        ):
            resolution, _ = GroupResolution.objects.update_or_create(
                group_id=group_id,
                defaults={
                    "release": release,
                    "type": GroupResolution.Type.in_release,
                    "status": GroupResolution.Status.resolved,
                    "actor_id": actor.id if actor is not None else None,
                },
            )
            group = Group.objects.get(id=group_id)
            should_create_resolution_activity = group.status != GroupStatus.RESOLVED
            group.update(status=GroupStatus.RESOLVED, substatus=None)
            remove_group_from_inbox(group, action=GroupInboxRemoveAction.RESOLVED, user=actor)
            if should_create_resolution_activity:
                activity_data: dict[str, Any] = {"version": release.version}
                resolution_commit_id = commit_id_by_group.get(group_id)
                if resolution_commit_id is not None:
                    activity_data["commit"] = resolution_commit_id
                Activity.objects.create(
                    project_id=group.project_id,
                    group=group,
                    type=ActivityType.SET_RESOLVED_IN_RELEASE.value,
                    user_id=actor.id if actor is not None else None,
                    ident=resolution.id,
                    data=activity_data,
                )
            record_group_history(group, GroupHistoryStatus.RESOLVED, actor=actor)

            metrics.incr("group.resolved", instance="in_commit", skip_internal=True)

        issue_resolved.send_robust(
            organization_id=release.organization_id,
            user=actor,
            group=group,
            project=group.project,
            resolution_type="with_commit",
            provider=provider_by_group.get(group_id),
            commit_id=commit_id_by_group.get(group_id),
            sender=type(release),
        )

        kick_off_status_syncs.apply_async(
            kwargs={"project_id": group_project_lookup[group_id], "group_id": group_id}
        )


def normalize_provider_key(provider: str | None) -> str | None:
    """Strip the ``integrations:`` prefix so a repository provider like
    ``integrations:github`` becomes the short key ``github``."""
    return provider.removeprefix("integrations:") if provider else None


def create_commit_authors(commit_list, release):
    # Collect unique emails and their author data
    author_data_by_email = {}
    for data in commit_list:
        author_email = data.get("author_email")
        if author_email is None and data.get("author_name"):
            author_email = (
                re.sub(r"[^a-zA-Z0-9\-_\.]*", "", data["author_name"]).lower() + "@localhost"
            )

        author_email = truncatechars(author_email, 75)
        if author_email:
            # Lowercase to match CommitAuthorManager.get_or_create behavior
            author_email = author_email.lower()

            # Store normalized email back in data for later lookup
            data["_normalized_email"] = author_email

            if author_email not in author_data_by_email:
                author_data_by_email[author_email] = {"name": data.get("author_name")}

    if not author_data_by_email:
        # No authors to process, set all to None
        for data in commit_list:
            data["author_model"] = None
        return

    # Batch fetch existing authors
    existing_authors = {
        author.email: author
        for author in CommitAuthor.objects.filter(
            organization_id=release.organization_id,
            email__in=author_data_by_email.keys(),
        )
    }

    # Identify authors needing creation
    emails_to_create = set(author_data_by_email.keys()) - set(existing_authors.keys())

    if emails_to_create:
        # Batch create missing authors
        authors_to_create = [
            CommitAuthor(
                organization_id=release.organization_id,
                email=email,
                name=author_data_by_email[email]["name"],
            )
            for email in emails_to_create
        ]
        CommitAuthor.objects.bulk_create(authors_to_create, ignore_conflicts=True)

        # Re-fetch to get IDs (needed because bulk_create with ignore_conflicts
        # doesn't populate IDs on PostgreSQL for conflicting rows)
        newly_created = CommitAuthor.objects.filter(
            organization_id=release.organization_id,
            email__in=emails_to_create,
        )
        for author in newly_created:
            existing_authors[author.email] = author

    # Batch update names where needed
    authors_to_update = []
    for email, author in existing_authors.items():
        expected_name = author_data_by_email[email]["name"]
        if author.name != expected_name:
            author.name = expected_name
            authors_to_update.append(author)

    if authors_to_update:
        CommitAuthor.objects.bulk_update(authors_to_update, ["name"])

    # Assign author models to commit data
    for data in commit_list:
        author_email = data.pop("_normalized_email", None)
        data["author_model"] = existing_authors.get(author_email) if author_email else None


def create_repositories(commit_list, release):
    repos = {}
    for data in commit_list:
        repo_name = data.get("repository") or f"organization-{release.organization_id}"
        if repo_name not in repos:
            repo = (
                Repository.objects.filter(
                    organization_id=release.organization_id,
                    name=repo_name,
                    status=ObjectStatus.ACTIVE,
                )
                .order_by("-pk")
                .first()
            )

            if repo is None:
                repo = Repository.objects.create(
                    organization_id=release.organization_id,
                    name=repo_name,
                )

            repos[repo_name] = repo
        else:
            repo = repos[repo_name]

        data["repo_model"] = repo
