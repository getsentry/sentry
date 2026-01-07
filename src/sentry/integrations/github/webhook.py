from __future__ import annotations

import hashlib
import hmac
import inspect
import logging
from abc import ABC
from collections.abc import Mapping, MutableMapping, Sequence
from datetime import timezone
from typing import Any, Protocol

import orjson
from dateutil.parser import parse as parse_date
from django.db import IntegrityError, router, transaction
from django.http import HttpRequest, HttpResponse
from django.utils.crypto import constant_time_compare
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt

from sentry import analytics, options
from sentry.analytics.events.webhook_repository_created import WebHookRepositoryCreatedEvent
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, all_silo_endpoint
from sentry.constants import EXTENSION_LANGUAGE_MAP, ObjectStatus
from sentry.identity.services.identity.service import identity_service
from sentry.integrations.base import IntegrationDomain
from sentry.integrations.github.utils import should_create_or_increment_contributor_seat
from sentry.integrations.github.webhook_types import (
    GITHUB_WEBHOOK_TYPE_HEADER_KEY,
    GithubWebhookType,
)
from sentry.integrations.pipeline import ensure_integration
from sentry.integrations.services.integration.model import (
    RpcIntegration,
    RpcOrganizationIntegration,
)
from sentry.integrations.services.integration.service import integration_service
from sentry.integrations.services.repository.service import repository_service
from sentry.integrations.source_code_management.webhook import SCMWebhook
from sentry.integrations.types import IntegrationProviderSlug
from sentry.integrations.utils.metrics import IntegrationWebhookEvent, IntegrationWebhookEventType
from sentry.integrations.utils.scope import clear_tags_and_context
from sentry.integrations.utils.sync import sync_group_assignee_inbound_by_external_actor
from sentry.models.commit import Commit
from sentry.models.commitauthor import CommitAuthor
from sentry.models.commitfilechange import CommitFileChange, post_bulk_create
from sentry.models.organization import Organization
from sentry.models.organizationcontributors import (
    ORGANIZATION_CONTRIBUTOR_ACTIVATION_THRESHOLD,
    OrganizationContributors,
)
from sentry.models.pullrequest import PullRequest
from sentry.models.repository import Repository
from sentry.organizations.services.organization.serial import serialize_rpc_organization
from sentry.plugins.providers.integration_repository import (
    RepoExistsError,
    get_integration_repository_provider,
)
from sentry.seer.autofix.webhooks import handle_github_pr_webhook_for_autofix
from sentry.seer.code_review.webhooks.handlers import (
    handle_webhook_event as code_review_handle_webhook_event,
)
from sentry.shared_integrations.exceptions import ApiError
from sentry.tasks.organization_contributors import assign_seat_to_organization_contributor
from sentry.users.services.user.service import user_service
from sentry.utils import metrics

from .integration import GitHubIntegrationProvider
from .repository import GitHubRepositoryProvider
from .tasks.codecov_account_unlink import codecov_account_unlink
from .types import IssueEvenntWebhookActionType

logger = logging.getLogger("sentry.webhooks")


# Functions that process webhook events need to have this signature.
# This is used to type check the webhook processors.
class WebhookProcessor(Protocol):
    def __call__(
        self,
        *,
        # This comes from the X-GitHub-Event header
        github_event: GithubWebhookType,
        # This comes from the webhook payload
        event: Mapping[str, Any],
        organization: Organization,
        repo: Repository,
        integration: RpcIntegration | None = None,
        **kwargs: Any,
    ) -> None: ...


def get_github_external_id(event: Mapping[str, Any], host: str | None = None) -> str | None:
    external_id: str | None = event.get("installation", {}).get("id")
    return f"{host}:{external_id}" if host else external_id


def get_file_language(filename: str) -> str | None:
    extension = filename.split(".")[-1]
    language = None
    if extension != filename:
        language = EXTENSION_LANGUAGE_MAP.get(extension)

    return language


def is_contributor_eligible_for_seat_assignment(user_type: str | None) -> bool:
    """
    Determine if a contributor is eligible for seat assignment based on their user type.
    """
    return user_type != "Bot"


def _handle_pr_webhook_for_autofix_processor(
    *,
    github_event: GithubWebhookType,
    event: Mapping[str, Any],
    organization: Organization,
    repo: Repository,
    **kwargs: Any,
) -> None:
    """
    Adapter to make handle_github_pr_webhook_for_autofix work with standard processor signature.

    This extracts the required parameters from the standardized webhook processor format
    and calls the legacy autofix handler with its expected signature.
    """
    pull_request = event.get("pull_request")
    if not pull_request:
        return

    action = event.get("action")
    user = pull_request.get("user")

    if organization and action and user:
        # Because we require that the sentry github integration be installed for autofix, we can piggyback
        # on this webhook for autofix for now. We may move to a separate autofix github integration in the future
        handle_github_pr_webhook_for_autofix(organization, action, pull_request, user)


class GitHubWebhook(SCMWebhook, ABC):
    """
    Base class for GitHub webhooks handled in region silos.
    """

    EVENT_TYPE: IntegrationWebhookEventType
    # When subclassing, add your webhook event processor here.
    WEBHOOK_EVENT_PROCESSORS: tuple[WebhookProcessor, ...] = ()

    def __init_subclass__(cls, **kwargs):
        super().__init_subclass__(**kwargs)
        if not inspect.isabstract(cls) and not hasattr(cls, "EVENT_TYPE"):
            raise TypeError(f"{cls.__name__} must define EVENT_TYPE class attribute")

    @property
    def event_type(self) -> IntegrationWebhookEventType:
        return self.EVENT_TYPE

    @property
    def provider(self) -> str:
        return IntegrationProviderSlug.GITHUB.value

    # _handle() is needed by _call() in the base class.
    # subclasses can now just add their function to the WEBHOOK_EVENT_PROCESSORS tuple
    # without needing to implement _handle()
    def _handle(
        self,
        github_event: GithubWebhookType,
        integration: RpcIntegration,
        event: Mapping[str, Any],
        organization: Organization,
        repo: Repository,
        **kwargs: Any,
    ) -> None:
        for processor in self.WEBHOOK_EVENT_PROCESSORS:
            try:
                processor(
                    github_event=github_event,
                    event=event,
                    integration=integration,
                    organization=organization,
                    repo=repo,
                    **kwargs,
                )
            except Exception as e:
                # Continue processing other processors even if one fails.
                logger.exception(
                    "github.webhook.processor.error",
                    extra={"event_type": self.event_type.value, "error": str(e)},
                )
                metrics.incr(
                    "github.webhook.processor.error",
                    tags={"event_type": self.event_type.value},
                    sample_rate=1.0,
                )
                continue

    def __call__(self, event: Mapping[str, Any], **kwargs: Any) -> None:
        github_event = kwargs["github_event"]
        external_id = get_github_external_id(event=event, host=kwargs.get("host"))

        result = integration_service.organization_contexts(
            external_id=external_id, provider=self.provider
        )
        integration = result.integration
        installs = result.organization_integrations

        if integration is None or not installs:
            # It seems possible for the GH or GHE app to be installed on their
            # end, but the integration to not exist. Possibly from deleting in
            # Sentry first or from a failed install flow (where the integration
            # didn't get created in the first place)
            logger.info(
                "github.missing-integration",
                extra={
                    "action": event.get("action"),
                    "repository": event.get("repository", {}).get("full_name", None),
                    "external_id": str(external_id),
                },
            )
            metrics.incr("github.webhook.integration_does_not_exist")
            return

        if "repository" in event:
            orgs = {
                org.id: org
                for org in Organization.objects.filter(
                    id__in=[install.organization_id for install in installs]
                )
            }
            repos = Repository.objects.filter(
                organization_id__in=orgs.keys(),
                provider=f"integrations:{self.provider}",
                external_id=str(event["repository"]["id"]),
            )

            if not repos.exists():
                provider = get_integration_repository_provider(integration)

                config = {
                    "integration_id": integration.id,
                    "external_id": str(event["repository"]["id"]),
                    "identifier": event.get("repository", {}).get("full_name", None),
                }

                for org in orgs.values():
                    rpc_org = serialize_rpc_organization(org)

                    try:
                        _, repo = provider.create_repository(
                            repo_config=config, organization=rpc_org
                        )
                    except RepoExistsError:
                        metrics.incr("sentry.integration_repo_provider.repo_exists")
                        continue

                    analytics.record(
                        WebHookRepositoryCreatedEvent(
                            organization_id=org.id,
                            repository_id=repo.id,
                            integration=IntegrationProviderSlug.GITHUB.value,
                        )
                    )
                    metrics.incr("github.webhook.repository_created")

                repos = repos.all()

            for repo in repos.exclude(status=ObjectStatus.HIDDEN):
                self.update_repo_data(repo, event)
                self._handle(
                    github_event=github_event,
                    integration=integration,
                    event=event,
                    organization=orgs[repo.organization_id],
                    repo=repo,
                )

    def update_repo_data(self, repo: Repository, event: Mapping[str, Any]) -> None:
        """
        Given a webhook payload, update stored repo data if needed.

        Assumes a 'repository' key in event payload, with certain subkeys.
        Rework this if that stops being a safe assumption.

        XXX(meredith): In it's current state, this tends to cause a lot of
        IntegrityErrors when we try to update the repo. Those would need to
        be handled should we decided to add this back in. Keeping the method
        for now, even though it's not currently used.
        """

        name_from_event = event["repository"]["full_name"]
        url_from_event = event["repository"]["html_url"]

        if (
            repo.name != name_from_event
            or repo.config.get("name") != name_from_event
            or repo.url != url_from_event
        ):
            try:
                repo.update(
                    name=name_from_event,
                    url=url_from_event,
                    config=dict(repo.config, name=name_from_event),
                )
            except IntegrityError:
                logger.exception(
                    "github.webhook.update_repo_data.integrity_error",
                    extra={
                        "repo_id": repo.id,
                        "new_name": name_from_event,
                        "new_url": url_from_event,
                        "old_name": repo.name,
                        "old_url": repo.url,
                    },
                )
                pass

    def is_anonymous_email(self, email: str) -> bool:
        return email[-25:] == "@users.noreply.github.com"

    def get_external_id(self, username: str) -> str:
        return f"github:{username}"

    def get_idp_external_id(self, integration: RpcIntegration, host: str | None = None) -> str:
        return options.get("github-app.id")


class InstallationEventWebhook(GitHubWebhook):
    """
    Unlike other GitHub webhooks, installation webhooks are handled in control silo.

    https://developer.github.com/v3/activity/events/types/#installationevent
    """

    EVENT_TYPE = IntegrationWebhookEventType.INSTALLATION

    def __call__(self, event: Mapping[str, Any], **kwargs: Any) -> None:
        installation = event["installation"]

        if not installation:
            return

        if event["action"] == "created":
            state = {
                "installation_id": event["installation"]["id"],
                "sender": {
                    "id": event["sender"]["id"],
                    "login": event["sender"]["login"],
                },
            }
            data = GitHubIntegrationProvider().build_integration(state)
            ensure_integration(IntegrationProviderSlug.GITHUB.value, data)

        if event["action"] == "deleted":
            external_id = event["installation"]["id"]
            if host := kwargs.get("host"):
                external_id = "{}:{}".format(host, event["installation"]["id"])
            result = integration_service.organization_contexts(
                provider=self.provider,
                external_id=external_id,
            )
            integration = result.integration
            org_integrations = result.organization_integrations

            if integration is not None:
                self._handle_organization_deletion(
                    integration, event, org_integrations=org_integrations
                )
            else:
                # It seems possible for the GH or GHE app to be installed on their
                # end, but the integration to not exist. Possibly from deleting in
                # Sentry first or from a failed install flow (where the integration
                # didn't get created in the first place)
                logger.info(
                    "github.deletion-missing-integration",
                    extra={
                        "action": event["action"],
                        "installation_name": installation["account"]["login"],
                        "external_id": str(external_id),
                    },
                )
                logger.error("Installation is missing.")

    def _handle_organization_deletion(
        self,
        integration: RpcIntegration,
        event: Mapping[str, Any],
        org_integrations: Sequence[RpcOrganizationIntegration],
    ) -> None:
        org_ids = [oi.organization_id for oi in org_integrations]

        logger.info(
            "InstallationEventWebhook._handle_delete",
            extra={
                "external_id": event["installation"]["id"],
                "integration_id": integration.id,
                "organization_id_list": org_ids,
            },
        )
        integration_service.update_integration(
            integration_id=integration.id, status=ObjectStatus.DISABLED
        )
        for organization_id in org_ids:
            repository_service.disable_repositories_for_integration(
                organization_id=organization_id,
                provider=f"integrations:{self.provider}",
                integration_id=integration.id,
            )

        github_app_id = event["installation"].get("app_id")
        SENTRY_GITHUB_APP_ID = options.get("github-app.id")

        if (
            github_app_id
            and SENTRY_GITHUB_APP_ID
            and str(github_app_id) == str(SENTRY_GITHUB_APP_ID)
        ):
            codecov_account_unlink.apply_async(
                kwargs={
                    "integration_id": integration.id,
                    "organization_ids": list(org_ids),
                }
            )


class PushEventWebhook(GitHubWebhook):
    """https://developer.github.com/v3/activity/events/types/#pushevent"""

    EVENT_TYPE = IntegrationWebhookEventType.PUSH

    def should_ignore_commit(self, commit: Mapping[str, Any]) -> bool:
        return GitHubRepositoryProvider.should_ignore_commit(commit["message"])

    def _handle(
        self,
        github_event: GithubWebhookType,
        integration: RpcIntegration,
        event: Mapping[str, Any],
        organization: Organization,
        repo: Repository,
        **kwargs: Any,
    ) -> None:
        authors = {}
        client = integration.get_installation(organization_id=organization.id).get_client()
        gh_username_cache: MutableMapping[str, str | None] = {}

        languages = set()
        for commit in event["commits"]:
            if not commit["distinct"]:
                continue

            if self.should_ignore_commit(commit):
                continue

            author_email = commit["author"]["email"]
            if "@" not in author_email:
                author_email = f"{author_email[:65]}@localhost"
            # try to figure out who anonymous emails are
            elif self.is_anonymous_email(author_email):
                gh_username: str | None = commit["author"].get("username")
                # bot users don't have usernames
                if gh_username:
                    external_id = self.get_external_id(gh_username)
                    if gh_username in gh_username_cache:
                        author_email = gh_username_cache[gh_username] or author_email
                    else:
                        try:
                            commit_author = CommitAuthor.objects.get(
                                external_id=external_id, organization_id=organization.id
                            )
                        except CommitAuthor.DoesNotExist:
                            commit_author = None

                        if commit_author is not None and not self.is_anonymous_email(
                            commit_author.email
                        ):
                            author_email = commit_author.email
                            gh_username_cache[gh_username] = author_email
                        else:
                            try:
                                gh_user = client.get_user(gh_username)
                            except ApiError:
                                logger.warning("Github user is missing.")
                            else:
                                # even if we can't find a user, set to none so we
                                # don't re-query
                                gh_username_cache[gh_username] = None
                                identity_user = None
                                # TODO(hybrid-cloud): Combine into a single RPC call if possible
                                identity = identity_service.get_identity(
                                    filter={
                                        "identity_ext_id": gh_user["id"],
                                        "provider_type": self.provider,
                                        "provider_ext_id": self.get_idp_external_id(
                                            integration, kwargs.get("host")
                                        ),
                                    }
                                )
                                if identity is not None:
                                    identity_user = user_service.get_user(user_id=identity.user_id)
                                if identity_user is not None:
                                    author_email = identity_user.email
                                    gh_username_cache[gh_username] = author_email
                                    if commit_author is not None:
                                        try:
                                            with transaction.atomic(
                                                router.db_for_write(CommitAuthor)
                                            ):
                                                commit_author.update(
                                                    email=author_email, external_id=external_id
                                                )
                                        except IntegrityError:
                                            pass

                        if commit_author is not None:
                            authors[author_email] = commit_author

            # TODO(dcramer): we need to deal with bad values here, but since
            # its optional, lets just throw it out for now
            if len(author_email) > 75:
                author = None
            elif author_email not in authors:
                authors[author_email] = author = CommitAuthor.objects.get_or_create(
                    organization_id=organization.id,
                    email=author_email,
                    defaults={"name": commit["author"]["name"][:128]},
                )[0]

                update_kwargs = {}

                if author.name != commit["author"]["name"][:128]:
                    update_kwargs["name"] = commit["author"]["name"][:128]

                gh_username = commit["author"].get("username")
                if gh_username:
                    external_id = self.get_external_id(gh_username)
                    if author.external_id != external_id and not self.is_anonymous_email(
                        author.email
                    ):
                        update_kwargs["external_id"] = external_id

                if update_kwargs:
                    try:
                        with transaction.atomic(router.db_for_write(CommitAuthor)):
                            author.update(**update_kwargs)
                    except IntegrityError:
                        pass
            else:
                author = authors[author_email]

            if author:
                author.preload_users()
            try:
                with transaction.atomic(router.db_for_write(Commit)):
                    c = Commit.objects.create(
                        organization_id=organization.id,
                        repository_id=repo.id,
                        key=commit["id"],
                        message=commit["message"],
                        author=author,
                        date_added=parse_date(commit["timestamp"]).astimezone(timezone.utc),
                    )

                    file_changes: list[CommitFileChange] = []

                    for fname in commit["added"]:
                        languages.add(get_file_language(fname))
                        file_changes.append(
                            CommitFileChange(
                                organization_id=organization.id,
                                commit_id=c.id,
                                filename=fname,
                                type="A",
                            )
                        )

                    for fname in commit["removed"]:
                        languages.add(get_file_language(fname))
                        file_changes.append(
                            CommitFileChange(
                                organization_id=organization.id,
                                commit_id=c.id,
                                filename=fname,
                                type="D",
                            )
                        )

                    for fname in commit["modified"]:
                        languages.add(get_file_language(fname))
                        file_changes.append(
                            CommitFileChange(
                                organization_id=organization.id,
                                commit_id=c.id,
                                filename=fname,
                                type="M",
                            )
                        )

                    if file_changes:
                        CommitFileChange.objects.bulk_create(file_changes)
                        post_bulk_create(file_changes)

            except IntegrityError:
                pass

        languages.discard(None)
        repo.languages = list(
            set(repo.languages or []).union({lang for lang in languages if lang is not None})
        )
        repo.save()


class IssuesEventWebhook(GitHubWebhook):
    """https://developer.github.com/v3/activity/events/types/#issuesevent"""

    # Inbound sync because we are handling assignment and status changes.
    EVENT_TYPE = IntegrationWebhookEventType.INBOUND_SYNC

    def _handle(
        self,
        github_event: GithubWebhookType,
        integration: RpcIntegration,
        event: Mapping[str, Any],
        organization: Organization,
        repo: Repository,
        **kwargs: Any,
    ) -> None:
        """
        Handle GitHub issue events, particularly assignment and status changes.
        """

        action = event.get("action")

        external_issue_key = self._extract_issue_key(integration, event)

        if not external_issue_key:
            logger.warning(
                "github.webhook.issues.missing-external-issue-key",
                extra={
                    "integration_id": integration.id,
                    "action": action,
                },
            )
            return

        # Route to appropriate handler based on action
        if action in [
            IssueEvenntWebhookActionType.ASSIGNED.value,
            IssueEvenntWebhookActionType.UNASSIGNED.value,
        ]:
            self._handle_assignment(integration, event, external_issue_key, action)
        elif action in [
            IssueEvenntWebhookActionType.CLOSED.value,
            IssueEvenntWebhookActionType.REOPENED.value,
        ]:
            self._handle_status_change(integration, external_issue_key, action)

    def _handle_assignment(
        self,
        integration: RpcIntegration,
        event: Mapping[str, Any],
        external_issue_key: str,
        action: str,
    ) -> None:
        """
        Handle issue assignment and unassignment events.

        When switching assignees, GitHub sends two webhooks (assigned and unassigned) in
        non-deterministic order. To avoid race conditions, we sync based on the current
        state in issue.assignees rather than the delta in the assignee field.

        Args:
            integration: The GitHub integration
            event: The webhook event payload
            external_issue_key: The formatted issue key
            action: The action type ('assigned' or 'unassigned')
        """
        # Use issue.assignees (current state) instead of assignee (delta) to avoid race conditions
        issue = event.get("issue", {})
        assignees = issue.get("assignees", [])

        # If there are no assignees, deassign
        if not assignees:
            sync_group_assignee_inbound_by_external_actor(
                integration=integration,
                external_user_name="",  # Not used for deassignment
                external_issue_key=external_issue_key,
                assign=False,
            )
            logger.info(
                "github.webhook.assignment.synced",
                extra={
                    "integration_id": integration.id,
                    "external_issue_key": external_issue_key,
                    "assignee_name": None,
                    "action": "deassigned",
                },
            )
            return

        # GitHub supports multiple assignees, but Sentry currently only supports one
        # Take the first assignee from the current state
        first_assignee = assignees[0]
        assignee_gh_name = first_assignee.get("login")

        if not assignee_gh_name:
            logger.warning(
                "github.webhook.missing-assignee",
                extra={
                    "integration_id": integration.id,
                    "external_issue_key": external_issue_key,
                    "action": action,
                },
            )
            return

        # Sentry uses the @username format for assignees
        assignee_name = f"@{assignee_gh_name}"

        sync_group_assignee_inbound_by_external_actor(
            integration=integration,
            external_user_name=assignee_name,
            external_issue_key=external_issue_key,
            assign=True,
        )

        logger.info(
            "github.webhook.assignment.synced",
            extra={
                "integration_id": integration.id,
                "external_issue_key": external_issue_key,
                "assignee_name": assignee_name,
                "action": action,
                "total_assignees": len(assignees),
            },
        )

    def _handle_status_change(
        self, integration: RpcIntegration, external_issue_key: str, action: str
    ) -> None:
        """
        Handle issue status changes (closed/reopened).

        Args:
            integration: The GitHub integration
            external_issue_key: The formatted issue key
            action: The action type ('closed' or 'reopened')
        """
        org_integrations = integration_service.get_organization_integrations(
            integration_id=integration.id,
            providers=[integration.provider],
            status=ObjectStatus.ACTIVE,
        )

        for oi in org_integrations:
            installation = integration.get_installation(oi.organization_id)

            if hasattr(installation, "sync_status_inbound"):
                installation.sync_status_inbound(external_issue_key, {"action": action})

                logger.info(
                    "github.webhook.status-change.synced",
                    extra={
                        "integration_id": integration.id,
                        "organization_id": oi.organization_id,
                        "external_issue_key": external_issue_key,
                        "action": action,
                    },
                )

    def _extract_issue_key(
        self, integration: RpcIntegration, event: Mapping[str, Any]
    ) -> str | None:
        """
        Extract and validate the external issue key from the event.

        Returns the external issue key in format 'repo_full_name#issue_number' or None if invalid.
        """
        issue = event.get("issue", {})
        repository = event.get("repository", {})
        repo_full_name = repository.get("full_name")
        issue_number = issue.get("number")

        if not repo_full_name or not issue_number:
            logger.warning(
                "github.webhook.missing-data",
                extra={
                    "integration_id": integration.id,
                    "repo": repo_full_name,
                    "issue_number": issue_number,
                    "action": event.get("action"),
                },
            )
            return None

        return f"{repo_full_name}#{issue_number}"


class PullRequestEventWebhook(GitHubWebhook):
    """https://developer.github.com/v3/activity/events/types/#pullrequestevent"""

    EVENT_TYPE = IntegrationWebhookEventType.MERGE_REQUEST
    WEBHOOK_EVENT_PROCESSORS = (
        _handle_pr_webhook_for_autofix_processor,
        code_review_handle_webhook_event,
    )

    def _handle(
        self,
        github_event: GithubWebhookType,
        integration: RpcIntegration,
        event: Mapping[str, Any],
        organization: Organization,
        repo: Repository,
        **kwargs: Any,
    ) -> None:
        pull_request = event["pull_request"]
        number = pull_request["number"]
        title = pull_request["title"]
        body = pull_request["body"]
        user = pull_request["user"]
        user_type = user.get("type")

        """
        The value of the merge_commit_sha attribute changes depending on the
        state of the pull request. Before a pull request is merged, the
        merge_commit_sha attribute holds the SHA of the test merge commit.
        After a pull request is merged, the attribute changes depending on how
        the pull request was merged:
        - If the pull request was merged as a merge commit, the attribute
         represents the SHA of the merge commit.
        - If the pull request was merged via a squash, the attribute
         represents the SHA of the squashed commit on the base branch.
        - If the pull request was rebased, the attribute represents the commit
         that the base branch was updated to.
        https://developer.github.com/v3/pulls/#get-a-single-pull-request
        """
        merge_commit_sha = pull_request["merge_commit_sha"] if pull_request["merged"] else None

        author_email = "{}@localhost".format(user["login"][:65])

        try:
            commit_author = CommitAuthor.objects.get(
                external_id=self.get_external_id(user["login"]), organization_id=organization.id
            )
            author_email = commit_author.email
        except CommitAuthor.DoesNotExist:
            identity_user = None
            identity = identity_service.get_identity(
                filter={
                    "identity_ext_id": user["id"],
                    "provider_type": self.provider,
                    "provider_ext_id": self.get_idp_external_id(integration, kwargs.get("host")),
                }
            )
            if identity is not None:
                identity_user = user_service.get_user(user_id=identity.user_id)
            if identity_user is not None:
                author_email = identity_user.email

        try:
            author = CommitAuthor.objects.get(
                organization_id=organization.id, external_id=self.get_external_id(user["login"])
            )
        except CommitAuthor.DoesNotExist:
            author, _created = CommitAuthor.objects.get_or_create(
                organization_id=organization.id,
                email=author_email,
                defaults={
                    "name": user["login"][:128],
                    "external_id": self.get_external_id(user["login"]),
                },
            )

        author.preload_users()
        try:
            _, created = PullRequest.objects.update_or_create(
                organization_id=organization.id,
                repository_id=repo.id,
                key=number,
                defaults={
                    "organization_id": organization.id,
                    "title": title,
                    "author": author,
                    "message": body,
                    "merge_commit_sha": merge_commit_sha,
                },
            )

            if created:

                try:
                    pr_repo_private = pull_request["head"]["repo"]["private"]
                except (KeyError, AttributeError, TypeError):
                    pr_repo_private = False

                metrics.incr(
                    "github.webhook.pull_request.created",
                    sample_rate=1.0,
                    tags={
                        "is_private": pr_repo_private,
                    },
                )

                logger.info(
                    "github.webhook.organization_contributor.eligibility_check",
                    extra={
                        "organization_id": organization.id,
                        "repository_id": repo.id,
                        "pr_number": number,
                        "user_login": user["login"],
                        "user_type": user_type,
                        "is_eligible": is_contributor_eligible_for_seat_assignment(user_type),
                    },
                )

                if is_contributor_eligible_for_seat_assignment(user_type):
                    # Track AI contributor if eligible
                    contributor, _ = OrganizationContributors.objects.get_or_create(
                        organization_id=organization.id,
                        integration_id=integration.id,
                        external_identifier=user["id"],
                        defaults={
                            "alias": user["login"],
                        },
                    )

                    if should_create_or_increment_contributor_seat(organization, repo, contributor):
                        metrics.incr(
                            "github.webhook.organization_contributor.should_create",
                            sample_rate=1.0,
                        )

                        locked_contributor = None
                        with transaction.atomic(router.db_for_write(OrganizationContributors)):
                            try:
                                locked_contributor = (
                                    OrganizationContributors.objects.select_for_update().get(
                                        organization_id=organization.id,
                                        integration_id=integration.id,
                                        external_identifier=user["id"],
                                    )
                                )
                                locked_contributor.num_actions += 1
                                locked_contributor.save(
                                    update_fields=["num_actions", "date_updated"]
                                )
                            except OrganizationContributors.DoesNotExist:
                                logger.exception(
                                    "github.webhook.organization_contributor.not_found",
                                    extra={
                                        "organization_id": organization.id,
                                        "integration_id": integration.id,
                                        "external_identifier": user["id"],
                                    },
                                )

                        if (
                            locked_contributor
                            and locked_contributor.num_actions
                            >= ORGANIZATION_CONTRIBUTOR_ACTIVATION_THRESHOLD
                        ):
                            assign_seat_to_organization_contributor.delay(locked_contributor.id)

        except IntegrityError:
            pass

        super()._handle(
            github_event=github_event,
            integration=integration,
            event=event,
            organization=organization,
            repo=repo,
            **kwargs,
        )


class CheckRunEventWebhook(GitHubWebhook):
    """
    Handles GitHub check_run webhook events.
    https://docs.github.com/en/webhooks/webhook-events-and-payloads#check_run
    """

    EVENT_TYPE = IntegrationWebhookEventType.CI_CHECK
    WEBHOOK_EVENT_PROCESSORS = (code_review_handle_webhook_event,)


class IssueCommentEventWebhook(GitHubWebhook):
    """
    Handles GitHub issue_comment webhook events.
    https://docs.github.com/en/webhooks/webhook-events-and-payloads#issue_comment
    """

    EVENT_TYPE = IntegrationWebhookEventType.ISSUE_COMMENT
    WEBHOOK_EVENT_PROCESSORS = (code_review_handle_webhook_event,)


@all_silo_endpoint
class GitHubIntegrationsWebhookEndpoint(Endpoint):
    """
    GitHub Webhook API reference:
    https://docs.github.com/en/webhooks-and-events/webhooks/about-webhooks
    """

    authentication_classes = ()
    permission_classes = ()

    owner = ApiOwner.ECOSYSTEM
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }

    _handlers: dict[GithubWebhookType, type[GitHubWebhook]] = {
        GithubWebhookType.CHECK_RUN: CheckRunEventWebhook,
        GithubWebhookType.INSTALLATION: InstallationEventWebhook,
        GithubWebhookType.ISSUE: IssuesEventWebhook,
        GithubWebhookType.ISSUE_COMMENT: IssueCommentEventWebhook,
        GithubWebhookType.PULL_REQUEST: PullRequestEventWebhook,
        GithubWebhookType.PUSH: PushEventWebhook,
    }

    def get_handler(self, event_type: GithubWebhookType) -> type[GitHubWebhook] | None:
        return self._handlers.get(event_type)

    @staticmethod
    def compute_signature(method: str, body: bytes, secret: str) -> str:
        if method == "sha256":
            mod = hashlib.sha256
        elif method == "sha1":
            mod = hashlib.sha1
        else:
            raise NotImplementedError(f"signature method {method} is not supported")
        return hmac.new(key=secret.encode("utf-8"), msg=body, digestmod=mod).hexdigest()

    def is_valid_signature(self, method: str, body: bytes, secret: str, signature: str) -> bool:
        expected = GitHubIntegrationsWebhookEndpoint.compute_signature(method, body, secret)
        return constant_time_compare(expected, signature)

    @method_decorator(csrf_exempt)
    def dispatch(self, request: HttpRequest, *args: Any, **kwargs: Any) -> HttpResponse:
        if request.method != "POST":
            return HttpResponse(status=405)

        return super().dispatch(request, *args, **kwargs)

    def get_logging_data(self) -> dict[str, Any] | None:
        return {
            "request_method": self.request.method,
            "request_path": self.request.path,
        }

    def get_secret(self) -> str | None:
        return options.get("github-app.webhook-secret")

    def post(self, request: HttpRequest) -> HttpResponse:
        return self.handle(request)

    def handle(self, request: HttpRequest) -> HttpResponse:
        clear_tags_and_context()
        secret = self.get_secret()

        if secret is None:
            logger.error("github.webhook.missing-secret", extra=self.get_logging_data())
            return HttpResponse(status=401)

        body = bytes(request.body)
        if not body:
            logger.error("github.webhook.missing-body", extra=self.get_logging_data())
            return HttpResponse(status=400)

        try:
            github_event = GithubWebhookType(request.headers[GITHUB_WEBHOOK_TYPE_HEADER_KEY])
            handler = self.get_handler(github_event)
        except KeyError:
            logger.exception("github.webhook.missing-event", extra=self.get_logging_data())
            logger.exception("Missing Github event in webhook.")
            return HttpResponse(status=400)
        except ValueError:
            return HttpResponse(status=204)

        if not handler:
            logger.info(
                "github.webhook.missing-handler",
                extra={"github_event": github_event},
            )
            return HttpResponse(status=204)

        try:
            header = (
                request.META.get("HTTP_X_HUB_SIGNATURE_256") or request.META["HTTP_X_HUB_SIGNATURE"]
            )
            method, signature = header.split("=", 1)
        except (KeyError, ValueError):
            logger.exception("github.webhook.missing-signature", extra=self.get_logging_data())
            return HttpResponse(status=400)

        if not self.is_valid_signature(method, body, secret, signature):
            logger.error("github.webhook.invalid-signature", extra=self.get_logging_data())
            return HttpResponse(status=401)

        try:
            event = orjson.loads(body)
        except orjson.JSONDecodeError:
            logger.exception("github.webhook.invalid-json", extra=self.get_logging_data())
            logger.exception("Invalid JSON.")
            return HttpResponse(status=400)

        event_handler = handler()

        with IntegrationWebhookEvent(
            interaction_type=event_handler.event_type,
            domain=IntegrationDomain.SOURCE_CODE_MANAGEMENT,
            provider_key=event_handler.provider,
        ).capture():
            event_handler(event, github_event=github_event)
        return HttpResponse(status=204)
