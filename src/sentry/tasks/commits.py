from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
from typing import Any

import sentry_sdk
from django.urls import reverse
from sentry_sdk import set_tag
from taskbroker_client.retry import Retry

from sentry import features
from sentry.constants import ObjectStatus
from sentry.exceptions import InvalidIdentity, PluginError
from sentry.integrations.source_code_management.metrics import (
    SCMIntegrationInteractionEvent,
    SCMIntegrationInteractionType,
)
from sentry.models.deploy import Deploy
from sentry.models.latestreporeleaseenvironment import LatestRepoReleaseEnvironment
from sentry.models.organization import Organization
from sentry.models.release import Release
from sentry.models.releaseheadcommit import ReleaseHeadCommit
from sentry.models.releases.exceptions import ReleaseCommitError
from sentry.models.repository import Repository
from sentry.plugins.base import bindings
from sentry.shared_integrations.exceptions import IntegrationError, IntegrationResourceNotFoundError
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task, retry
from sentry.taskworker.namespaces import issues_tasks
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser
from sentry.users.services.user.service import user_service
from sentry.utils.cache import cache
from sentry.utils.email import MessageBuilder
from sentry.utils.hashlib import hash_values
from sentry.utils.http import absolute_uri

logger = logging.getLogger(__name__)

GITHUB_FETCH_COMMITS_COMPARE_CACHE_FEATURE = (
    "organizations:integrations-github-fetch-commits-compare-cache"
)
GITHUB_FETCH_COMMITS_COMPARE_CACHE_TTL_SECONDS = 120
GITHUB_CACHEABLE_REPOSITORY_PROVIDERS = frozenset(
    ("integrations:github", "integrations:github_enterprise")
)


def generate_invalid_identity_email(identity: Any, commit_failure: bool = False) -> MessageBuilder:
    new_context = {
        "identity": identity,
        "auth_url": absolute_uri(reverse("socialauth_associate", args=[identity.provider])),
        "commit_failure": commit_failure,
    }

    return MessageBuilder(
        subject="Unable to Fetch Commits" if commit_failure else "Action Required",
        context=new_context,
        template="sentry/emails/identity-invalid.txt",
        html_template="sentry/emails/identity-invalid.html",
    )


def generate_fetch_commits_error_email(
    release: Release, repo: Repository, error_message: str
) -> MessageBuilder:
    new_context = {"release": release, "error_message": error_message, "repo": repo}

    return MessageBuilder(
        subject="Unable to Fetch Commits",
        context=new_context,
        template="sentry/emails/unable-to-fetch-commits.txt",
        html_template="sentry/emails/unable-to-fetch-commits.html",
    )


# we're future proofing this function a bit so it could be used with other code


def handle_invalid_identity(identity: Any, commit_failure: bool = False) -> None:
    # email the user
    msg = generate_invalid_identity_email(identity, commit_failure)
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


def fetch_compare_commits(
    *,
    cache_enabled: bool,
    repo: Repository,
    provider: Any,
    is_integration_repo_provider: bool,
    start_sha: str | None,
    end_sha: str,
    user: RpcUser | None,
    lifecycle: Any,
) -> list[dict[str, Any]]:
    if cache_enabled:
        cache_key = get_github_compare_commits_cache_key(
            repo.organization_id, repo.id, repo.provider, start_sha, end_sha
        )
        cached_repo_commits = cache.get(cache_key)
        lifecycle.add_extra("compare_commits_cache_enabled", True)
        if cached_repo_commits is not None:
            lifecycle.add_extra("compare_commits_cache_hit", True)
            return cached_repo_commits

        lifecycle.add_extra("compare_commits_cache_hit", False)
    else:
        lifecycle.add_extra("compare_commits_cache_enabled", False)

    if is_integration_repo_provider:
        repo_commits = provider.compare_commits(repo, start_sha, end_sha)
    else:
        # XXX: This only works for plugins that support actor context
        repo_commits = provider.compare_commits(repo, start_sha, end_sha, actor=user)

    if cache_enabled:
        cache.set(
            cache_key,
            repo_commits,
            GITHUB_FETCH_COMMITS_COMPARE_CACHE_TTL_SECONDS,
        )
    return repo_commits


def get_repo_and_provider_for_ref(
    *,
    release: Release,
    ref: Mapping[str, str],
    user_id: int,
) -> tuple[Repository, Any, bool, str] | None:
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

    is_integration_repo_provider = is_integration_provider(repo.provider)
    binding_key = (
        "integration-repository.provider" if is_integration_repo_provider else "repository.provider"
    )
    try:
        provider_cls = bindings.get(binding_key).get(repo.provider)
    except KeyError:
        return None

    provider = provider_cls(id=repo.provider)
    provider_key = (
        provider_cls.repo_provider if is_integration_repo_provider else provider_cls.auth_provider
    )

    return repo, provider, is_integration_repo_provider, provider_key


@instrumented_task(
    name="sentry.tasks.commits.fetch_commits",
    namespace=issues_tasks,
    processing_deadline_duration=60 * 15 + 5,
    retry=Retry(times=5, delay=60 * 5),
    silo_mode=SiloMode.CELL,
)
@retry(exclude=(Release.DoesNotExist, User.DoesNotExist))
def fetch_commits(
    release_id: int,
    user_id: int,
    refs: Sequence[Mapping[str, str]],
    prev_release_id: int | None = None,
    **kwargs: Any,
) -> None:
    commit_list: list[dict[str, Any]] = []

    release = Release.objects.get(id=release_id)
    set_tag("organization.slug", release.organization.slug)
    # TODO: Need a better way to error handle no user_id. We need the SDK to be able to call this without user context
    # to autoassociate commits to releases
    user = user_service.get_user(user_id) if user_id is not None else None
    # user = User.objects.get(id=user_id) if user_id is not None else None
    prev_release = None
    if prev_release_id is not None:
        try:
            prev_release = Release.objects.get(id=prev_release_id)
        except Release.DoesNotExist:
            pass

    organization = release.organization
    github_compare_commits_cache_feature_enabled = features.has(
        GITHUB_FETCH_COMMITS_COMPARE_CACHE_FEATURE, organization, actor=user
    )

    for ref in refs:
        resolved = get_repo_and_provider_for_ref(release=release, ref=ref, user_id=user_id)
        if resolved is None:
            continue
        repo, provider, is_integration_repo_provider, provider_key = resolved

        # if previous commit isn't provided, try to get from
        # previous release otherwise, try to get
        # recent commits from provider api
        start_sha = None
        if ref.get("previousCommit"):
            start_sha = ref["previousCommit"]
        elif prev_release:
            try:
                start_sha = ReleaseHeadCommit.objects.filter(
                    organization_id=release.organization_id,
                    release=prev_release,
                    repository_id=repo.id,
                ).values_list("commit__key", flat=True)[0]
            except IndexError:
                pass

        end_sha = ref["commit"]

        with SCMIntegrationInteractionEvent(
            SCMIntegrationInteractionType.COMPARE_COMMITS,
            provider_key=provider_key,
            organization_id=repo.organization_id,
            integration_id=repo.integration_id,
        ).capture() as lifecycle:
            lifecycle.add_extras(
                {
                    "organization_id": repo.organization_id,
                    "user_id": user_id,
                    "repository": repo.name,
                    "provider": provider.id,
                    "end_sha": end_sha,
                    "start_sha": start_sha,
                }
            )
            try:
                provider_name = repo.provider
                compare_commits_cache_enabled = (
                    github_compare_commits_cache_feature_enabled
                    and isinstance(provider_name, str)
                    and provider_name in GITHUB_CACHEABLE_REPOSITORY_PROVIDERS
                    and start_sha is not None
                )
                repo_commits = fetch_compare_commits(
                    cache_enabled=compare_commits_cache_enabled,
                    repo=repo,
                    provider=provider,
                    is_integration_repo_provider=is_integration_repo_provider,
                    start_sha=start_sha,
                    end_sha=end_sha,
                    user=user,
                    lifecycle=lifecycle,
                )
            except NotImplementedError:
                pass
            except IntegrationResourceNotFoundError:
                pass
            except Exception as e:
                span = sentry_sdk.get_current_span()
                if span is None:
                    raise TypeError("No span is currently active right now")
                span.set_status("unknown_error")

                if isinstance(e, InvalidIdentity) and getattr(e, "identity", None):
                    handle_invalid_identity(identity=e.identity, commit_failure=True)
                    lifecycle.record_halt(e)
                elif isinstance(e, (PluginError, InvalidIdentity, IntegrationError)):
                    msg = generate_fetch_commits_error_email(release, repo, str(e))
                    emails = get_emails_for_user_or_org(user, release.organization_id)
                    msg.send_async(to=emails)
                    lifecycle.record_halt(e)
                else:
                    msg = generate_fetch_commits_error_email(
                        release, repo, "An internal system error occurred."
                    )
                    emails = get_emails_for_user_or_org(user, release.organization_id)
                    msg.send_async(to=emails)
                    lifecycle.record_failure(e)
            else:
                logger.info(
                    "fetch_commits.complete",
                    extra={
                        "organization_id": repo.organization_id,
                        "user_id": user_id,
                        "repository": repo.name,
                        "end_sha": end_sha,
                        "start_sha": start_sha,
                        "num_commits": len(repo_commits or []),
                    },
                )
                commit_list.extend(repo_commits)

    if not commit_list:
        return

    try:
        release.set_commits(commit_list)
    except ReleaseCommitError:
        # Another task or webworker is currently setting commits on this
        # release. Return early as that task will do the remaining work.
        logger.info(
            "fetch_commits.duplicate",
            extra={
                "release_id": release.id,
                "organization_id": release.organization_id,
                "user_id": user_id,
            },
        )
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


def is_integration_provider(provider: str | None) -> bool:
    return bool(provider and provider.startswith("integrations:"))


def get_emails_for_user_or_org(user: RpcUser | None, orgId: int) -> list[str]:
    emails: list[str] = []
    if not user:
        return []
    if user.is_sentry_app:
        organization = Organization.objects.get(id=orgId)
        members = organization.get_members_with_org_roles(roles=["owner"])
        user_ids = [m.user_id for m in members if m.user_id]
        emails = list({u.email for u in user_service.get_many_by_id(ids=user_ids) if u.email})
    else:
        emails = [user.email]

    return emails
