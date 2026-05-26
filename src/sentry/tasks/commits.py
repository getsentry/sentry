from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
from typing import Any, NamedTuple

import sentry_sdk
from django.urls import reverse
from sentry_sdk import set_tag
from taskbroker_client.retry import Retry

from sentry.constants import ObjectStatus
from sentry.exceptions import InvalidIdentity, PluginError
from sentry.integrations.source_code_management.metrics import (
    SCMIntegrationInteractionEvent,
    SCMIntegrationInteractionType,
)
from sentry.models.deploy import Deploy
from sentry.models.latestreporeleaseenvironment import LatestRepoReleaseEnvironment
from sentry.models.release import Release
from sentry.models.releaseheadcommit import ReleaseHeadCommit
from sentry.models.releases.exceptions import ReleaseCommitError
from sentry.models.repository import Repository
from sentry.plugins.base import bindings
from sentry.shared_integrations.exceptions import IntegrationError, IntegrationResourceNotFoundError
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import issues_tasks
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser
from sentry.users.services.user.service import user_service
from sentry.utils.cache import cache
from sentry.utils.email import MessageBuilder
from sentry.utils.hashlib import hash_values
from sentry.utils.http import absolute_uri

logger = logging.getLogger(__name__)

GITHUB_FETCH_COMMITS_COMPARE_CACHE_TTL_SECONDS = 3600
GITHUB_CACHEABLE_REPOSITORY_PROVIDERS = frozenset(
    ("integrations:github", "integrations:github_enterprise")
)


def generate_invalid_identity_email(identity: Any) -> MessageBuilder:
    new_context = {
        "identity": identity,
        "auth_url": absolute_uri(reverse("socialauth_associate", args=[identity.provider])),
    }

    return MessageBuilder(
        subject="Action Required",
        context=new_context,
        template="sentry/emails/identity-invalid.txt",
        html_template="sentry/emails/identity-invalid.html",
    )


def handle_invalid_identity(identity: Any) -> None:
    # email the user
    msg = generate_invalid_identity_email(identity)
    msg.send_async(to=[identity.user.email])

    # now remove the identity, as its invalid
    identity.delete()


def get_github_compare_commits_cache_key(
    organization_id: int,
    repository_id: int,
    provider: str | None,
    start_sha: str | None,
    end_sha: str,
) -> str:
    digest = hash_values(
        [organization_id, repository_id, provider or "", start_sha or "", end_sha],
        seed="fetch-commits:compare-commits",
    )
    return f"fetch-commits:compare-commits:v1:{digest}"


def fetch_commits_for_compare_range(
    *,
    repo: Repository,
    provider: Any,
    start_sha: str,
    end_sha: str,
    user: RpcUser | None,
) -> list[dict[str, Any]]:
    cache_enabled = (
        isinstance(repo.provider, str) and repo.provider in GITHUB_CACHEABLE_REPOSITORY_PROVIDERS
    )
    set_tag("compare_commits_cache_enabled", cache_enabled)
    if cache_enabled:
        cache_key = get_github_compare_commits_cache_key(
            repo.organization_id, repo.id, repo.provider, start_sha, end_sha
        )
        cached_repo_commits = cache.get(cache_key)
        logger.info(
            "fetch_commits.compare_commits_cache_hit",
            extra={
                "compare_commits_cache_hit": cached_repo_commits is not None,
                "cache_key": cache_key,
            },
        )
        if cached_repo_commits is not None:
            return cached_repo_commits

    repo_commits = provider.fetch_commits_for_compare_range(repo, start_sha, end_sha, actor=user)

    if cache_enabled:
        cache.set(
            cache_key,
            repo_commits,
            GITHUB_FETCH_COMMITS_COMPARE_CACHE_TTL_SECONDS,
        )
    return repo_commits


def fetch_recent_commits(
    *,
    repo: Repository,
    provider: Any,
    end_sha: str,
    user: RpcUser | None,
) -> list[dict[str, Any]]:
    return provider.fetch_recent_commits(repo, end_sha, actor=user)


def get_repo_for_ref(
    *,
    release: Release,
    ref: Mapping[str, str],
    user_id: int,
) -> Repository | None:
    repo = (
        Repository.objects.filter(
            organization_id=release.organization_id,
            name=ref["repository"],
            status=ObjectStatus.ACTIVE,
        )
        .order_by("-pk")
        .first()
    )
    if not repo:
        logger.info(
            "repository.missing",
            extra={
                "organization_id": release.organization_id,
                "user_id": user_id,
                "repository": ref["repository"],
            },
        )
        return None

    return repo


def get_provider_for_repo(
    *,
    repo: Repository,
) -> tuple[Any, str] | None:
    binding_key = (
        "integration-repository.provider"
        if repo.has_integration_provider()
        else "repository.provider"
    )
    try:
        provider_cls = bindings.get(binding_key).get(repo.provider)
    except KeyError:
        return None

    provider = provider_cls(id=repo.provider)
    provider_key = provider.get_scm_provider_key() or provider.id

    return provider, provider_key


def get_start_sha_for_ref(
    *,
    ref: Mapping[str, str],
    release: Release,
    repo: Repository,
    prev_release: Release | None,
) -> str | None:
    if ref.get("previousCommit"):
        return ref["previousCommit"]

    if prev_release:
        try:
            return ReleaseHeadCommit.objects.filter(
                organization_id=release.organization_id,
                release=prev_release,
                repository_id=repo.id,
            ).values_list("commit__key", flat=True)[0]
        except IndexError:
            pass

    return None


class ResolvedRef(NamedTuple):
    repo: Repository
    provider: Any
    provider_key: str
    start_sha: str | None
    end_sha: str


def resolve_ref(
    *,
    ref: Mapping[str, str],
    release: Release,
    prev_release: Release | None,
    user_id: int,
) -> ResolvedRef | None:
    """Turn a ref into the concrete objects needed to fetch commits, or None to skip.

    Returns None (and logs via the underlying helpers) when the repository is missing
    or no provider binding is registered, so the caller can skip without emitting
    SCM lifecycle events for refs that would never succeed.
    """
    repo = get_repo_for_ref(release=release, ref=ref, user_id=user_id)
    if repo is None:
        return None

    provider_values = get_provider_for_repo(repo=repo)
    if provider_values is None:
        return None
    provider, provider_key = provider_values

    start_sha = get_start_sha_for_ref(
        ref=ref,
        release=release,
        repo=repo,
        prev_release=prev_release,
    )
    return ResolvedRef(
        repo=repo,
        provider=provider,
        provider_key=provider_key,
        start_sha=start_sha,
        end_sha=ref["commit"],
    )


def fetch_commits_for_ref_with_lifecycle(
    *,
    resolved: ResolvedRef,
    user_id: int,
    user: RpcUser | None,
    task_extra: Mapping[str, Any],
) -> list[dict[str, Any]] | None:
    repo = resolved.repo
    start_sha = resolved.start_sha
    end_sha = resolved.end_sha
    loop_extra = {
        **task_extra,
        "repository": repo.name,
        "start_sha": start_sha,
        "end_sha": end_sha,
    }
    logger.info("fetch_commits.loop.start", extra=loop_extra)
    repo_commits: list[dict[str, Any]] | None = None
    try:
        with SCMIntegrationInteractionEvent(
            SCMIntegrationInteractionType.COMPARE_COMMITS,
            provider_key=resolved.provider_key,
            organization_id=repo.organization_id,
            integration_id=repo.integration_id,
        ).capture() as lifecycle:
            lifecycle.add_extras(
                {
                    "organization_id": repo.organization_id,
                    "user_id": user_id,
                    "repository": repo.name,
                    "provider": resolved.provider.id,
                    "end_sha": end_sha,
                    "start_sha": start_sha,
                }
            )
            try:
                if start_sha is None:
                    repo_commits = fetch_recent_commits(
                        repo=repo,
                        provider=resolved.provider,
                        end_sha=end_sha,
                        user=user,
                    )
                else:
                    repo_commits = fetch_commits_for_compare_range(
                        repo=repo,
                        provider=resolved.provider,
                        start_sha=start_sha,
                        end_sha=end_sha,
                        user=user,
                    )
            except NotImplementedError:
                repo_commits = None
            except IntegrationResourceNotFoundError:
                repo_commits = None
            except Exception as e:
                span = sentry_sdk.get_current_span()
                if span:
                    span.set_status("unknown_error")

                if isinstance(e, InvalidIdentity) and getattr(e, "identity", None):
                    handle_invalid_identity(identity=e.identity)
                    lifecycle.record_halt(e)
                elif isinstance(e, (PluginError, InvalidIdentity, IntegrationError)):
                    lifecycle.record_halt(e)
                else:
                    lifecycle.record_failure(e)
                repo_commits = None
        return repo_commits
    finally:
        logger.info(
            "fetch_commits.loop.complete",
            extra={**loop_extra, "num_commits": len(repo_commits or [])},
        )


@instrumented_task(
    name="sentry.tasks.commits.fetch_commits",
    namespace=issues_tasks,
    processing_deadline_duration=60 * 15 + 5,
    retry=Retry(
        times=5,
        delay=60 * 5,
        on=(Exception,),
        ignore=(Release.DoesNotExist, User.DoesNotExist),
    ),
    silo_mode=SiloMode.CELL,
    silenced_exceptions=(Release.DoesNotExist, User.DoesNotExist),
)
def fetch_commits(
    release_id: int,
    user_id: int,
    refs: Sequence[Mapping[str, str]],
    prev_release_id: int | None = None,
    **kwargs: Any,
) -> None:
    commit_list: list[dict[str, Any]] = []

    release = Release.objects.get(id=release_id)
    # TODO: Need a better way to error handle no user_id. We need the SDK to be able to call this without user context
    # to autoassociate commits to releases
    user = user_service.get_user(user_id) if user_id is not None else None
    prev_release = None
    if prev_release_id is not None:
        try:
            prev_release = Release.objects.get(id=prev_release_id)
        except Release.DoesNotExist:
            pass
    set_tag("organization.slug", release.organization.slug)
    extra = {
        "organization_id": release.organization_id,
        "user_id": user_id,
        "refs": refs,
        "num_refs": len(refs),
        "prev_release_id": prev_release_id,
    }
    logger.info("fetch_commits.start", extra=extra)

    for ref in refs:
        resolved = resolve_ref(ref=ref, release=release, prev_release=prev_release, user_id=user_id)
        if resolved is None:
            continue

        repo_commits = fetch_commits_for_ref_with_lifecycle(
            resolved=resolved,
            user_id=user_id,
            user=user,
            task_extra=extra,
        )
        if repo_commits is None:
            continue

        commit_list.extend(repo_commits)

    if not commit_list:
        return

    try:
        release.set_commits(commit_list)
    except ReleaseCommitError:
        # Another task or webworker is currently setting commits on this
        # release. Return early as that task will do the remaining work.
        logger.info("fetch_commits.duplicate", extra=extra)
        return

    deploys = Deploy.objects.filter(
        organization_id=release.organization_id, release=release, notified=False
    ).values_list("id", "environment_id", "date_finished")

    # XXX(dcramer): i don't know why this would have multiple environments, but for
    # our sanity lets assume it can
    pending_notifications = []
    last_deploy_per_environment = {}
    for deploy_id, environment_id, date_finished in deploys:
        last_deploy_per_environment[environment_id] = (deploy_id, date_finished)
        pending_notifications.append(deploy_id)

    repo_queryset = ReleaseHeadCommit.objects.filter(
        organization_id=release.organization_id, release=release
    ).values_list("repository_id", "commit")

    # for each repo, update (or create if this is the first one) our records
    # of the latest commit-associated release in each env
    # use deploys as a proxy for ReleaseEnvironment, because they contain
    # a timestamp in addition to release and env data
    for repository_id, commit_id in repo_queryset:
        for environment_id, (deploy_id, date_finished) in last_deploy_per_environment.items():
            # we need to mark LatestRepoReleaseEnvironment, but only if there's not a
            # deploy in the given environment which has completed *after*
            # this deploy (given we might process commits out of order)
            if not Deploy.objects.filter(
                id__in=LatestRepoReleaseEnvironment.objects.filter(
                    repository_id=repository_id, environment_id=environment_id
                ).values("deploy_id"),
                date_finished__gt=date_finished,
            ).exists():
                LatestRepoReleaseEnvironment.objects.update_or_create(
                    repository_id=repository_id,
                    environment_id=environment_id,
                    defaults={
                        "release_id": release.id,
                        "deploy_id": deploy_id,
                        "commit_id": commit_id,
                    },
                )

    for deploy_id in pending_notifications:
        Deploy.notify_if_ready(deploy_id, fetch_complete=True)

    logger.info("fetch_commits.complete", extra=extra)
