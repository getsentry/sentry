from __future__ import annotations

import hashlib
import hmac
import logging
from abc import ABC, abstractmethod
from collections.abc import Mapping, MutableMapping
from datetime import timezone
from typing import Any

import orjson
from dateutil.parser import parse as parse_date
from django.db import IntegrityError, router, transaction
from django.http import HttpRequest, HttpResponse
from django.utils.crypto import constant_time_compare
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt

from sentry import analytics, options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, all_silo_endpoint
from sentry.autofix.webhooks import handle_github_pr_webhook_for_autofix
from sentry.constants import EXTENSION_LANGUAGE_MAP, ObjectStatus
from sentry.identity.services.identity.service import identity_service
from sentry.integrations.base import IntegrationDomain
from sentry.integrations.github.tasks.open_pr_comment import open_pr_comment_workflow
from sentry.integrations.pipeline import ensure_integration
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.integrations.services.integration.service import integration_service
from sentry.integrations.services.repository.service import repository_service
from sentry.integrations.source_code_management.webhook import SCMWebhook
from sentry.integrations.utils.metrics import IntegrationWebhookEvent, IntegrationWebhookEventType
from sentry.integrations.utils.scope import clear_tags_and_context
from sentry.models.commit import Commit
from sentry.models.commitauthor import CommitAuthor
from sentry.models.commitfilechange import CommitFileChange
from sentry.models.options.organization_option import OrganizationOption
from sentry.models.organization import Organization
from sentry.models.pullrequest import PullRequest
from sentry.models.repository import Repository
from sentry.organizations.services.organization.serial import serialize_rpc_organization
from sentry.plugins.providers.integration_repository import (
    RepoExistsError,
    get_integration_repository_provider,
)
from sentry.shared_integrations.exceptions import ApiError
from sentry.users.services.user.service import user_service
from sentry.utils import metrics

from .integration import GitHubIntegrationProvider
from .repository import GitHubRepositoryProvider

logger = logging.getLogger("sentry.webhooks")


def get_github_external_id(event: Mapping[str, Any], host: str | None = None) -> str | None:
    external_id: str | None = event.get("installation", {}).get("id")
    return f"{host}:{external_id}" if host else external_id


def get_file_language(filename: str) -> str | None:
    extension = filename.split(".")[-1]
    language = None
    if extension != filename:
        language = EXTENSION_LANGUAGE_MAP.get(extension)

        if language is None:
            logger.info("github.unaccounted_file_lang", extra={"extension": extension})

    return language


class GitHubWebhook(SCMWebhook, ABC):
    """
    Base class for GitHub webhooks handled in region silos.
    """

    @property
    def provider(self) -> str:
        return "github"

    @abstractmethod
    def _handle(self, integration: RpcIntegration, event: Mapping[str, Any], **kwargs) -> None:
        pass

    def __call__(self, event: Mapping[str, Any], **kwargs) -> None:
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
                        "webhook.repository_created",
                        organization_id=org.id,
                        repository_id=repo.id,
                        integration="github",
                    )
                    metrics.incr("github.webhook.repository_created")

                repos = repos.all()

            for repo in repos.exclude(status=ObjectStatus.HIDDEN):
                self.update_repo_data(repo, event)
                self._handle(
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

    @property
    def event_type(self) -> IntegrationWebhookEventType:
        return IntegrationWebhookEventType.INSTALLATION

    def __call__(self, event: Mapping[str, Any], **kwargs) -> None:
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
            ensure_integration("github", data)

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
                self._handle(integration, event, org_integrations=org_integrations)
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

    def _handle(
        self,
        integration: RpcIntegration,
        event: Mapping[str, Any],
        **kwargs,
    ) -> None:
        org_ids = {oi.organization_id for oi in kwargs.get("org_integrations", [])}

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


class PushEventWebhook(GitHubWebhook):
    """https://developer.github.com/v3/activity/events/types/#pushevent"""

    @property
    def event_type(self) -> IntegrationWebhookEventType:
        return IntegrationWebhookEventType.PUSH

    def should_ignore_commit(self, commit: Mapping[str, Any]) -> bool:
        return GitHubRepositoryProvider.should_ignore_commit(commit["message"])

    def _handle(
        self,
        integration: RpcIntegration,
        event: Mapping[str, Any],
        **kwargs,
    ) -> None:
        authors = {}
        if not ((organization := kwargs.get("organization")) and (repo := kwargs.get("repo"))):
            raise ValueError("Missing organization and repo")

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
                        repository_id=repo.id,
                        organization_id=organization.id,
                        key=commit["id"],
                        message=commit["message"],
                        author=author,
                        date_added=parse_date(commit["timestamp"]).astimezone(timezone.utc),
                    )
                    for fname in commit["added"]:
                        languages.add(get_file_language(fname))
                        CommitFileChange.objects.create(
                            organization_id=organization.id,
                            commit=c,
                            filename=fname,
                            type="A",
                        )
                    for fname in commit["removed"]:
                        languages.add(get_file_language(fname))
                        CommitFileChange.objects.create(
                            organization_id=organization.id,
                            commit=c,
                            filename=fname,
                            type="D",
                        )
                    for fname in commit["modified"]:
                        languages.add(get_file_language(fname))
                        CommitFileChange.objects.create(
                            organization_id=organization.id,
                            commit=c,
                            filename=fname,
                            type="M",
                        )

            except IntegrityError:
                pass

        languages.discard(None)
        repo.languages = list(set(repo.languages or []).union(languages))
        repo.save()


class PullRequestEventWebhook(GitHubWebhook):
    """https://developer.github.com/v3/activity/events/types/#pullrequestevent"""

    @property
    def event_type(self) -> IntegrationWebhookEventType:
        return IntegrationWebhookEventType.PULL_REQUEST

    def _handle(
        self,
        integration: RpcIntegration,
        event: Mapping[str, Any],
        **kwargs,
    ) -> None:
        pull_request = event["pull_request"]
        number = pull_request["number"]
        title = pull_request["title"]
        body = pull_request["body"]
        user = pull_request["user"]
        action = event["action"]

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

        if not ((organization := kwargs.get("organization")) and (repo := kwargs.get("repo"))):
            raise ValueError("Missing organization and repo")

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
            pr, created = PullRequest.objects.update_or_create(
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

            if action == "opened" and created:
                if not OrganizationOption.objects.get_value(
                    organization=organization,
                    key="sentry:github_open_pr_bot",
                    default=True,
                ):
                    logger.info(
                        "github.open_pr_comment.option_missing",
                        extra={"organization_id": organization.id},
                    )
                    return

                metrics.incr("github.open_pr_comment.queue_task")
                logger.info(
                    "github.open_pr_comment.queue_task",
                    extra={"pr_id": pr.id},
                )
                open_pr_comment_workflow.delay(pr_id=pr.id)

        except IntegrityError:
            pass

        # Because we require that the sentry github integration be installed for autofix, we can piggyback
        # on this webhook for autofix for now. We may move to a separate autofix github integration in the future.
        handle_github_pr_webhook_for_autofix(organization, action, pull_request, user)


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

    _handlers: dict[str, type[GitHubWebhook]] = {
        "push": PushEventWebhook,
        "pull_request": PullRequestEventWebhook,
        "installation": InstallationEventWebhook,
    }

    def get_handler(self, event_type: str) -> type[GitHubWebhook] | None:
        return self._handlers.get(event_type)

    def is_valid_signature(self, method: str, body: bytes, secret: str, signature: str) -> bool:
        if method == "sha1":
            mod = hashlib.sha1
        else:
            raise NotImplementedError(f"signature method {method} is not supported")
        expected = hmac.new(key=secret.encode("utf-8"), msg=body, digestmod=mod).hexdigest()

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
            handler = self.get_handler(request.META["HTTP_X_GITHUB_EVENT"])
        except KeyError:
            logger.exception("github.webhook.missing-event", extra=self.get_logging_data())
            logger.exception("Missing Github event in webhook.")
            return HttpResponse(status=400)

        if not handler:
            logger.info(
                "github.webhook.missing-handler",
                extra={"event_type": request.META["HTTP_X_GITHUB_EVENT"]},
            )
            return HttpResponse(status=204)

        try:
            method, signature = request.META["HTTP_X_HUB_SIGNATURE"].split("=", 1)
        except (KeyError, IndexError):
            logger.exception("github.webhook.missing-signature", extra=self.get_logging_data())
            logger.exception("Missing webhook secret.")
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
            event_handler(event)
        return HttpResponse(status=204)
