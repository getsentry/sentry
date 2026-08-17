from __future__ import annotations

import hashlib
import hmac
import inspect
import logging
from abc import ABC
from collections.abc import Mapping
from datetime import timezone
from typing import Any

import orjson
from dateutil.parser import parse as parse_date
from django.db import IntegrityError, router, transaction
from django.http import HttpRequest, HttpResponse
from django.utils.crypto import constant_time_compare
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework.exceptions import ValidationError

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, cell_silo_endpoint
from sentry.api.utils import to_valid_int_id
from sentry.integrations.base import IntegrationDomain
from sentry.integrations.services.integration import integration_service
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.integrations.source_code_management.webhook import SCMWebhook
from sentry.integrations.types import IntegrationProviderSlug
from sentry.integrations.utils.metrics import IntegrationWebhookEvent, IntegrationWebhookEventType
from sentry.integrations.utils.scope import clear_organization_info
from sentry.integrations.utils.webhook_viewer_context import webhook_viewer_context
from sentry.issues.action_log import ActionSource, action_context_scope, resolve_action_actor
from sentry.models.commit import Commit
from sentry.models.commitauthor import CommitAuthor
from sentry.models.repository import Repository
from sentry.organizations.services.organization import organization_service
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.plugins.providers import IntegrationRepositoryProvider
from sentry.pr_metrics.lifecycle_mapping import (
    parse_scm_timestamp,
    pull_request_lifecycle_state_from_github,
    update_pull_request_from_scm_snapshot,
)
from sentry.utils import metrics

logger = logging.getLogger("sentry.webhooks")

PROVIDER_NAME = f"integrations:{IntegrationProviderSlug.GITEA.value}"

GITEA_WEBHOOK_SECRET_MISSING_ERROR = (
    "This Gitea integration has no webhook secret recorded. Reinstall it in Sentry."
)
GITEA_WEBHOOK_SIGNATURE_INVALID_ERROR = (
    "Gitea's webhook signature does not match. Re-link the repository in Sentry to"
    " re-register its webhook."
)


def _extract_payload_repo_info(request: HttpRequest) -> dict[str, Any]:
    """
    Best-effort identifiers pulled from the webhook body.

    The composite token is what resolves the integration, so when it is missing
    or malformed there is nothing to log about the customer. Every Gitea event
    carries a ``repository`` object, which is enough to track down where a bad
    delivery is coming from. Returns {} if anything is off.
    """
    try:
        payload = orjson.loads(request.body)
    except (orjson.JSONDecodeError, TypeError, AttributeError):
        return {}
    if not isinstance(payload, dict):
        return {}

    repository = payload.get("repository")
    repository = repository if isinstance(repository, dict) else {}
    info = {
        # e.g. "acme/widgets" - the owning user or org plus the repo name
        "webhook.repo.full_name": repository.get("full_name"),
        "webhook.repo.html_url": repository.get("html_url"),
        "webhook.repo.id": repository.get("id"),
    }
    # Drop missing keys so the log attributes stay clean.
    return {k: v for k, v in info.items() if v is not None}


def is_valid_signature(body: bytes, secret: str, signature: str | None) -> bool:
    """
    Verify ``X-Gitea-Signature``: a bare-hex HMAC-SHA256 of the raw body, keyed
    on the hook secret.

    This is the *only* thing authenticating a delivery - the URL says which
    integration a payload claims to be for, and this says whether to believe it
    - so an absent header has to fail closed rather than skip the check.
    """
    if not signature:
        return False

    expected = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    return constant_time_compare(expected, signature)


class GiteaWebhook(SCMWebhook, ABC):
    EVENT_TYPE: IntegrationWebhookEventType

    def __init_subclass__(cls, **kwargs: Any) -> None:
        # Enforced at class creation: a handler missing this would otherwise
        # blow up inside `IntegrationWebhookEvent` at request time, which Gitea
        # sees as a 500 and retries.
        super().__init_subclass__(**kwargs)
        if not inspect.isabstract(cls) and not hasattr(cls, "EVENT_TYPE"):
            raise TypeError(f"{cls.__name__} must define EVENT_TYPE class attribute")

    @property
    def event_type(self) -> IntegrationWebhookEventType:
        return self.EVENT_TYPE

    @property
    def provider(self) -> str:
        return IntegrationProviderSlug.GITEA.value

    def get_repo(
        self,
        integration: RpcIntegration,
        organization: RpcOrganization,
        event: Mapping[str, Any],
    ) -> Repository | None:
        """
        The ``Repository`` a delivery belongs to, or ``None`` when this
        organization has not linked it *to the integration that delivered it*.

        Scoped on ``integration_id``, not just the external id. Repository
        external ids are ``{instance}:{repo_id}``, and ``instance`` is only the
        hostname - so two integrations for the same host (which is exactly what
        replacing an OAuth app produces, and what every gitea.com tenant looks
        like) derive the *same* external id for the same repository. Without
        this filter a hook left behind by a replaced OAuth app would resolve the
        repository now linked to its successor and write commits under the stale
        integration's delivery.
        """
        repository = event.get("repository") or {}
        repo_id = repository.get("id")
        if repo_id is None:
            logger.warning(
                "gitea.webhook.missing-repository-id", extra={"integration_id": integration.id}
            )
            return None

        external_id = "{}:{}".format(integration.metadata["instance"], repo_id)
        try:
            return Repository.objects.get(
                organization_id=organization.id,
                provider=PROVIDER_NAME,
                external_id=external_id,
                integration_id=integration.id,
            )
        except Repository.DoesNotExist:
            return None

    def update_repo_data(self, repo: Repository, event: Mapping[str, Any]) -> None:
        """
        Keep the stored URL and ``owner/name`` path current - renaming a repo or
        moving the instance behind a new ``ROOT_URL`` changes both, and every
        API call and stacktrace link is built from them.
        """
        repository = event.get("repository") or {}
        url_from_event = repository.get("html_url")
        path_from_event = repository.get("full_name")

        if not url_from_event or not path_from_event:
            return

        if repo.url != url_from_event or repo.config.get("path") != path_from_event:
            repo.update(
                url=url_from_event,
                config=dict(repo.config, path=path_from_event),
            )


class PushEventWebhook(GiteaWebhook):
    """
    Handle push events.

    See https://docs.gitea.com/next/usage/webhooks#event-information
    """

    EVENT_TYPE = IntegrationWebhookEventType.PUSH

    def __call__(self, event: Mapping[str, Any], **kwargs: Any) -> None:
        if not (
            (organization := kwargs.get("organization"))
            and (integration := kwargs.get("integration"))
        ):
            raise ValueError("Organization and integration must be provided")

        repo = self.get_repo(integration, organization, event)
        if repo is None:
            return

        # while we're here, make sure repo data is up to date
        self.update_repo_data(repo, event)

        commits = event.get("commits") or []

        # Gitea caps the commits array in a push payload; anything past the cap
        # is simply absent. Nothing backfills it today, so record when it
        # happens rather than letting the gap read as an empty push.
        total_commits = event.get("total_commits")
        if isinstance(total_commits, int) and total_commits > len(commits):
            metrics.incr("integrations.gitea.webhook.push.truncated", sample_rate=1.0)
            logger.info(
                "gitea.webhook.push.truncated",
                extra={
                    "integration_id": integration.id,
                    "repository_id": repo.id,
                    "delivered_commits": len(commits),
                    "total_commits": total_commits,
                },
            )

        authors: dict[str, CommitAuthor] = {}

        for commit in commits:
            try:
                key = commit["id"]
                message = commit["message"]
                date_added = parse_date(commit["timestamp"]).astimezone(timezone.utc)
            except (KeyError, TypeError, ValueError):
                # One malformed commit must not fail the request: Gitea would
                # redeliver the whole push and re-attempt every commit before
                # it, forever.
                logger.warning(
                    "gitea.webhook.push.invalid-commit",
                    extra={"integration_id": integration.id, "repository_id": repo.id},
                )
                continue

            if IntegrationRepositoryProvider.should_ignore_commit(message):
                continue

            author_email = (commit.get("author") or {}).get("email")

            # Gitea takes the author from the git object, so it is whatever the
            # committer configured locally - not a validated address.
            if not author_email or len(author_email) > 75:
                author = None
            elif author_email not in authors:
                authors[author_email] = author = CommitAuthor.objects.get_or_create(
                    organization_id=organization.id,
                    email=author_email,
                    defaults={"name": (commit.get("author") or {}).get("name")},
                )[0]
            else:
                author = authors[author_email]

            try:
                if author is not None:
                    author.preload_users()
                with transaction.atomic(router.db_for_write(Commit)):
                    Commit.objects.create(
                        repository_id=repo.id,
                        organization_id=organization.id,
                        key=key,
                        message=message,
                        author=author,
                        date_added=date_added,
                    )
            except IntegrityError:
                pass


class PullRequestEventWebhook(GiteaWebhook):
    """
    Handle pull request events.

    Gitea models a pull request the way GitHub does - ``state`` is only
    open/closed with a separate ``merged`` flag - so the GitHub lifecycle
    mapping applies unchanged.
    """

    EVENT_TYPE = IntegrationWebhookEventType.MERGE_REQUEST

    def __call__(self, event: Mapping[str, Any], **kwargs: Any) -> None:
        if not (
            (organization := kwargs.get("organization"))
            and (integration := kwargs.get("integration"))
        ):
            raise ValueError("Organization and integration must be provided")

        repo = self.get_repo(integration, organization, event)
        if repo is None:
            return

        self.update_repo_data(repo, event)

        pull_request = event.get("pull_request") or {}
        try:
            number = pull_request["number"]
            title = pull_request["title"]
        except KeyError as e:
            logger.warning(
                "gitea.webhook.invalid-pull-request-data",
                extra={"integration_id": integration.id, "error": str(e)},
            )
            return

        user = pull_request.get("user") or {}
        # Gitea reports the author's account email, which may be hidden by the
        # user's privacy settings. The synthetic address keeps a PR attributable
        # to a stable author row either way.
        author_email = user.get("email") or "{}@localhost".format(str(user.get("login", ""))[:65])
        author = CommitAuthor.objects.get_or_create(
            organization_id=organization.id,
            email=author_email,
            defaults={"name": (user.get("full_name") or user.get("login") or "")[:128]},
        )[0]
        author.preload_users()

        state = pull_request_lifecycle_state_from_github(pull_request)
        # Only meaningful once the PR is actually merged; on an open PR the
        # field either is empty or names a commit that is on no branch.
        merge_commit_sha = (
            pull_request.get("merge_commit_sha") if pull_request.get("merged") else None
        )
        # The ordering high-water mark; see update_pull_request_from_scm_snapshot.
        provider_updated_at = parse_scm_timestamp(pull_request.get("updated_at"))

        defaults = {
            "title": title,
            "author": author,
            "message": pull_request.get("body") or "",
            "merge_commit_sha": merge_commit_sha,
            "head_commit_sha": (pull_request.get("head") or {}).get("sha"),
            "date_added": parse_scm_timestamp(pull_request.get("created_at")),
            "opened_at": parse_scm_timestamp(pull_request.get("created_at")),
            "closed_at": parse_scm_timestamp(pull_request.get("closed_at")),
            "merged_at": parse_scm_timestamp(pull_request.get("merged_at")),
            "provider_updated_at": provider_updated_at,
            "state": state,
            "draft": pull_request.get("draft"),
        }

        try:
            update_pull_request_from_scm_snapshot(
                provider=self.provider,
                organization_id=organization.id,
                repository_id=repo.id,
                key=number,
                defaults=defaults,
                event_state=state,
                event_updated_at=provider_updated_at,
            )
        except IntegrityError:
            pass


@cell_silo_endpoint
class GiteaWebhookEndpoint(Endpoint):
    owner = ApiOwner.CODING_WORKFLOWS
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    authentication_classes = ()
    permission_classes = ()
    provider = IntegrationProviderSlug.GITEA

    # Keyed on the `X-Gitea-Event` values rather than anything in the body:
    # Forgejo emits the same header family, so the future variant can reuse this
    # endpoint unchanged.
    _handlers: dict[str, type[GiteaWebhook]] = {
        "push": PushEventWebhook,
        "pull_request": PullRequestEventWebhook,
    }

    @method_decorator(csrf_exempt)
    def dispatch(self, request: HttpRequest, *args: Any, **kwargs: Any) -> HttpResponse:
        if request.method != "POST":
            return HttpResponse(status=405, reason="HTTP method not supported.")

        with action_context_scope(ActionSource.GITEA, resolve_action_actor(request)):
            return super().dispatch(request, *args, **kwargs)

    def post(self, request: HttpRequest, organization_id: str, integration_id: str) -> HttpResponse:
        clear_organization_info()
        extra: dict[str, Any] = {
            "webhook.user_agent": request.META.get("HTTP_USER_AGENT"),
            "webhook.event_type": request.META.get("HTTP_X_GITEA_EVENT"),
            "webhook.delivery": request.META.get("HTTP_X_GITEA_DELIVERY"),
        }

        # Validated here rather than left to the parser: in monolith mode the
        # hybrid-cloud parser is bypassed entirely and this is the only check.
        try:
            org_id = to_valid_int_id("organization_id", organization_id)
            integ_id = to_valid_int_id("integration_id", integration_id)
        except ValidationError:
            extra["webhook.reason"] = "The webhook URL is malformed."
            extra.update(_extract_payload_repo_info(request))
            logger.warning("gitea.webhook.malformed-url", extra=extra)
            return HttpResponse(status=400, reason=extra["webhook.reason"])

        extra["webhook.organization.id"] = org_id
        extra["webhook.integration.id"] = integ_id

        # Filters on `organizationintegration__organization_id`, so a URL naming
        # an organization that never installed this integration resolves to
        # nothing rather than to somebody else's integration.
        context = integration_service.organization_context(
            organization_id=org_id,
            integration_id=integ_id,
            provider=self.provider.value,
        )
        integration = context.integration
        if integration is None or context.organization_integration is None:
            extra["webhook.reason"] = "There is no integration that matches your organization."
            logger.warning("gitea.webhook.invalid-organization", extra=extra)
            return HttpResponse(status=409, reason=extra["webhook.reason"])

        extra["webhook.integration.status"] = integration.status

        webhook_secret = integration.metadata.get("webhook_secret")
        if not webhook_secret:
            # A row without one can never authenticate a delivery. Answering
            # 5xx here would have Gitea - and our own webhookpayload retries -
            # redeliver something that can never succeed.
            extra["webhook.reason"] = GITEA_WEBHOOK_SECRET_MISSING_ERROR
            logger.warning("gitea.webhook.missing-webhook-secret", extra=extra)
            return HttpResponse(status=409, reason=GITEA_WEBHOOK_SECRET_MISSING_ERROR)

        if not is_valid_signature(
            request.body,
            f"{org_id}:{integ_id}:{webhook_secret}",
            request.META.get("HTTP_X_GITEA_SIGNATURE"),
        ):
            extra["webhook.reason"] = GITEA_WEBHOOK_SIGNATURE_INVALID_ERROR
            logger.info("gitea.webhook.invalid-signature", extra=extra)
            return HttpResponse(status=401, reason=GITEA_WEBHOOK_SIGNATURE_INVALID_ERROR)

        try:
            event = orjson.loads(request.body)
        except orjson.JSONDecodeError:
            extra["webhook.reason"] = "Data received is not JSON."
            logger.warning("gitea.webhook.invalid-json", extra=extra)
            return HttpResponse(status=400, reason=extra["webhook.reason"])

        if not isinstance(event, dict):
            # A bare list or string parses fine and then blows up on the first
            # `.get` inside a handler. That would be a 500, which the cell
            # delivery task retries, so reject it terminally here instead.
            extra["webhook.reason"] = "Data received is not a JSON object."
            logger.warning("gitea.webhook.invalid-payload", extra=extra)
            return HttpResponse(status=400, reason=extra["webhook.reason"])

        try:
            handler = self._handlers[request.META["HTTP_X_GITEA_EVENT"]]
        except KeyError:
            # Not an error worth a 400 loop: the hook we register asks for
            # `push` and `pull_request` only, but a customer can widen it in
            # Gitea's own UI and we would rather drop those than have Gitea
            # retry them.
            extra["webhook.reason"] = "Unsupported event type: %s" % ", ".join(
                sorted(self._handlers)
            )
            logger.info("gitea.webhook.unsupported-event-type", extra=extra)
            return HttpResponse(status=204)

        # Exactly one organization: the URL names it. Fanning out to every
        # organization on the `Integration` row would hand each delivery to
        # tenants that share an OAuth app but not the repository.
        org_context = organization_service.get_organization_by_id(
            id=org_id, include_teams=False, include_projects=False
        )
        if org_context is None:
            extra["webhook.reason"] = "There is no integration that matches your organization."
            logger.warning("gitea.webhook.missing-organization", extra=extra)
            return HttpResponse(status=409, reason=extra["webhook.reason"])

        event_handler = handler()
        with (
            webhook_viewer_context(org_id),
            IntegrationWebhookEvent(
                interaction_type=event_handler.event_type,
                domain=IntegrationDomain.SOURCE_CODE_MANAGEMENT,
                provider_key=event_handler.provider,
            ).capture(),
        ):
            event_handler(event, integration=integration, organization=org_context.organization)

        return HttpResponse(status=204)
