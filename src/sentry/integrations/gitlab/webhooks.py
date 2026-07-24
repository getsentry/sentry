from __future__ import annotations

import inspect
import logging
from abc import ABC
from collections.abc import Mapping
from datetime import timezone
from typing import Any, Protocol

import orjson
import sentry_sdk
from dateutil.parser import parse as parse_date
from django.db import IntegrityError, router, transaction
from django.http import Http404, HttpRequest, HttpResponse
from django.utils.crypto import constant_time_compare
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, cell_silo_endpoint
from sentry.constants import ObjectStatus
from sentry.integrations.base import IntegrationDomain
from sentry.integrations.gitlab.types import GitLabIssueAction
from sentry.integrations.mixins.issues import IssueSyncIntegration
from sentry.integrations.services.integration import integration_service
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.integrations.source_code_management.webhook import SCMWebhook
from sentry.integrations.types import IntegrationProviderSlug
from sentry.integrations.utils.metrics import IntegrationWebhookEvent, IntegrationWebhookEventType
from sentry.integrations.utils.scope import clear_organization_info
from sentry.integrations.utils.sync import sync_group_assignee_inbound_by_external_actor
from sentry.integrations.utils.webhook_viewer_context import webhook_viewer_context
from sentry.issues.action_log import ActionSource, action_context_scope, resolve_action_actor
from sentry.models.commit import Commit
from sentry.models.commitauthor import CommitAuthor
from sentry.models.pullrequest import PullRequest, PullRequestLifecycleState
from sentry.models.repository import Repository
from sentry.organizations.services.organization import organization_service
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.plugins.providers import IntegrationRepositoryProvider
from sentry.seer.code_review.webhooks.logging import debug_log
from sentry.seer.code_review.webhooks.merge_request import (
    handle_merge_request_event,
    handle_merge_request_note_event,
)
from sentry.seer.code_review.webhooks.seat_tracking import (
    track_gitlab_contributor_action_processor,
    track_gitlab_contributor_seat_processor,
)
from sentry.utils import metrics

logger = logging.getLogger("sentry.webhooks")

PROVIDER_NAME = "integrations:gitlab"
GITLAB_WEBHOOK_SECRET_INVALID_ERROR = """Gitlab's webhook secret does not match. Refresh token (or re-install the integration) by following this https://docs.sentry.io/organization/integrations/integration-platform/public-integration/#refreshing-tokens."""


class WebhookProcessor(Protocol):
    def __call__(
        self,
        *,
        event: Mapping[str, Any],
        organization: RpcOrganization,
        repo: Repository,
        integration: RpcIntegration | None = None,
        **kwargs: Any,
    ) -> None: ...


def _extract_payload_repo_info(request) -> dict[str, Any]:
    """
    Best-effort identifiers pulled from the webhook body.

    The token (HTTP_X_GITLAB_TOKEN) is what we'd normally use to resolve the
    integration/org, but when it's missing or malformed we can't. The payload
    body is independent of the token, and GitLab events carry a ``project``
    object that identifies the repo/owner — enough to track down which customer
    a bad webhook is coming from. Returns {} if anything is off.
    """
    try:
        payload = orjson.loads(request.body)
    except (orjson.JSONDecodeError, TypeError, AttributeError):
        return {}
    if not isinstance(payload, dict):
        return {}

    project = payload.get("project")
    project = project if isinstance(project, dict) else {}
    info = {
        # e.g. "cool-group/sentry" — the owning group/namespace plus repo
        "webhook.repo.path": project.get("path_with_namespace"),
        "webhook.repo.web_url": project.get("web_url"),
        "webhook.repo.project_id": project.get("id"),
        "webhook.object_kind": payload.get("object_kind"),
    }
    # Drop missing keys so the log attributes stay clean.
    return {k: v for k, v in info.items() if v is not None}


def get_gitlab_external_id(request, extra) -> tuple[str, str] | HttpResponse:
    token = "<unknown>"
    try:
        # Munge the token to extract the integration external_id.
        # gitlab hook payloads don't give us enough unique context
        # to find data on our side so we embed one in the token.
        token = request.META["HTTP_X_GITLAB_TOKEN"]
        # e.g. "example.gitlab.com:group-x:webhook_secret_from_sentry_integration_table"
        instance, group_path, secret = token.split(":")
        external_id = f"{instance}:{group_path}"
        return (external_id, secret)
    except KeyError:
        extra["webhook.reason"] = "The customer needs to set a Secret Token in their webhook."
        logger.warning("gitlab.webhook.missing-gitlab-token", extra=extra)
        return HttpResponse(status=400, reason=extra["webhook.reason"])
    except ValueError:
        # The token is malformed so we can't resolve the integration/org from it.
        # Fall back to identifiers in the payload body to find the source repo.
        extra = {**extra, **_extract_payload_repo_info(request)}
        extra["webhook.reason"] = "The customer's Secret Token is malformed."
        logger.warning("gitlab.webhook.malformed-gitlab-token", extra=extra)
        return HttpResponse(status=400, reason=extra["webhook.reason"])
    except Exception:
        extra["webhook.reason"] = "Generic catch-all error."
        logger.warning("gitlab.webhook.invalid-token", extra=extra)
        return HttpResponse(status=400, reason=extra["webhook.reason"])


class GitlabWebhook(SCMWebhook, ABC):
    EVENT_TYPE: IntegrationWebhookEventType
    WEBHOOK_EVENT_PROCESSORS: tuple[WebhookProcessor, ...] = ()

    def __init_subclass__(cls, **kwargs: Any) -> None:
        super().__init_subclass__(**kwargs)
        if not inspect.isabstract(cls) and not hasattr(cls, "EVENT_TYPE"):
            raise TypeError(f"{cls.__name__} must define EVENT_TYPE class attribute")

    @property
    def event_type(self) -> IntegrationWebhookEventType:
        return self.EVENT_TYPE

    @property
    def provider(self) -> str:
        return IntegrationProviderSlug.GITLAB.value

    def _handle(
        self,
        integration: RpcIntegration,
        event: Mapping[str, Any],
        organization: RpcOrganization,
        repo: Repository,
        **kwargs: Any,
    ) -> None:
        for processor in self.WEBHOOK_EVENT_PROCESSORS:
            try:
                processor(
                    event=event,
                    integration=integration,
                    organization=organization,
                    repo=repo,
                    **kwargs,
                )
            except Exception as e:
                sentry_sdk.capture_exception(e)
                metrics.incr(
                    "gitlab.webhook.processor.error",
                    tags={"event_type": self.event_type.value},
                    sample_rate=1.0,
                )
                continue

    def get_repo(
        self, integration: RpcIntegration, organization: RpcOrganization, event: Mapping[str, Any]
    ):
        """
        Given a webhook payload, get the associated Repository record.

        Assumes a 'project' key in event payload.
        """
        try:
            project_id = event["project"]["id"]
        except KeyError:
            logger.warning(
                "gitlab.webhook.missing-projectid", extra={"integration_id": integration.id}
            )
            raise Http404()

        external_id = "{}:{}".format(integration.metadata["instance"], project_id)
        try:
            repo = Repository.objects.get(
                organization_id=organization.id, provider=PROVIDER_NAME, external_id=external_id
            )
        except Repository.DoesNotExist:
            return None
        return repo

    def update_repo_data(self, repo: Repository, event: Mapping[str, Any]):
        """
        Given a webhook payload, update stored repo data if needed.

        Assumes a 'project' key in event payload, with certain subkeys. Rework
        this if that stops being a safe assumption.
        """

        project = event["project"]

        url_from_event = project["web_url"]
        path_from_event = project["path_with_namespace"]

        if repo.url != url_from_event or repo.config.get("path") != path_from_event:
            repo.update(
                url=url_from_event,
                config=dict(repo.config, path=path_from_event),
            )


class IssuesEventWebhook(GitlabWebhook):
    """
    Handle Issue Hook

    See https://docs.gitlab.com/ee/user/project/integrations/webhooks.html#issue-events
    """

    EVENT_TYPE = IntegrationWebhookEventType.INBOUND_SYNC

    def __call__(self, event: Mapping[str, Any], **kwargs):
        if not (integration := kwargs.get("integration")):
            raise ValueError("Integration must be provided")
        organization: RpcOrganization | None = kwargs.get("organization")

        external_issue_key = self._extract_issue_key(event, integration)
        if not external_issue_key:
            logger.warning(
                "gitlab.webhook.issues.missing-external-issue-key",
                extra={
                    "integration_id": integration.id,
                },
            )
            return

        # Extract action from object_attributes
        object_attributes = event.get("object_attributes", {})
        action = object_attributes.get("action")

        # Handle assignment changes — CLOSE does not affect assignment
        if action in GitLabIssueAction.values() and action != GitLabIssueAction.CLOSE:
            self._handle_assignment(integration, event, external_issue_key)

        # Handle status changes (CLOSE and REOPEN)
        if action in [GitLabIssueAction.CLOSE, GitLabIssueAction.REOPEN] and organization:
            self._handle_status_change(integration, external_issue_key, action, organization.id)

    def _handle_assignment(
        self,
        integration: RpcIntegration,
        event: Mapping[str, Any],
        external_issue_key: str,
    ) -> None:
        """
        Handle issue assignment and unassignment events.

        GitLab sends webhooks with the current assignees array, so we sync based on
        the current state to avoid race conditions.
        """
        assignees = event.get("assignees", [])

        # If there are no assignees, deassign
        if not assignees:
            sync_group_assignee_inbound_by_external_actor(
                integration=integration,
                external_user_name="",
                external_issue_key=external_issue_key,
                assign=False,
            )
            logger.info(
                "gitlab.webhook.assignment.synced",
                extra={
                    "integration_id": integration.id,
                    "external_issue_key": external_issue_key,
                    "assignee_name": None,
                    "action": "deassigned",
                },
            )
            return

        # GitLab supports multiple assignees, but Sentry currently only supports one
        # Take the first assignee from the current state
        first_assignee = assignees[0]
        assignee_id = first_assignee.get("id")
        assignee_username = first_assignee.get("username")

        if not assignee_username:
            logger.warning(
                "gitlab.webhook.missing-assignee",
                extra={
                    "integration_id": integration.id,
                    "external_issue_key": external_issue_key,
                },
            )
            return

        # Sentry uses the @username format for assignees
        assignee_name = f"@{assignee_username}"

        sync_group_assignee_inbound_by_external_actor(
            integration=integration,
            external_user_name=assignee_name,
            external_issue_key=external_issue_key,
            assign=True,
            external_user_id=assignee_id,
        )

        logger.info(
            "gitlab.webhook.assignment.synced",
            extra={
                "integration_id": integration.id,
                "external_issue_key": external_issue_key,
                "assignee_id": assignee_id,
                "assignee_name": assignee_name,
                "total_assignees": len(assignees),
            },
        )

    def _handle_status_change(
        self,
        integration: RpcIntegration,
        external_issue_key: str,
        action: str,
        organization_id: int,
    ) -> None:
        """
        Handle issue status changes (close/reopen).

        Triggers the sync_status_inbound task to update linked Sentry issues.
        """
        org_integrations = integration_service.get_organization_integrations(
            integration_id=integration.id,
            organization_id=organization_id,
            providers=[integration.provider],
            status=ObjectStatus.ACTIVE,
        )
        for org_integration in org_integrations:
            installation = integration.get_installation(org_integration.organization_id)
            if isinstance(installation, IssueSyncIntegration):
                installation.sync_status_inbound(
                    external_issue_key,
                    {"action": action},
                )
                logger.info(
                    "gitlab.webhook.status.synced",
                    extra={
                        "integration_id": integration.id,
                        "external_issue_key": external_issue_key,
                        "action": action,
                    },
                )

    def _extract_issue_key(
        self, event: Mapping[str, Any], integration: RpcIntegration
    ) -> str | None:
        """
        Extract and validate the external issue key from the event.

        Returns the external issue key in format 'domain_name:path_with_namespace#issue_iid' or None if invalid.
        """
        project = event.get("project", {})
        object_attributes = event.get("object_attributes", {})

        path_with_namespace = project.get("path_with_namespace")
        issue_iid = object_attributes.get("iid")

        if not path_with_namespace or not issue_iid:
            logger.warning(
                "gitlab.webhook.missing-data",
                extra={
                    "project_path": path_with_namespace,
                    "issue_iid": issue_iid,
                },
            )
            return None

        return f"{integration.metadata['domain_name']}:{path_with_namespace}#{issue_iid}"


def _map_gitlab_state_to_pullrequest_lifecycle(gitlab_state: str | None) -> str | None:
    return {
        "opened": PullRequestLifecycleState.OPEN,
        "closed": PullRequestLifecycleState.CLOSED,
        "merged": PullRequestLifecycleState.MERGED,
        "locked": PullRequestLifecycleState.LOCKED,
    }.get(gitlab_state or "")


class MergeEventWebhook(GitlabWebhook):
    """
    Handle Merge Request Hook

    See https://docs.gitlab.com/ee/user/project/integrations/webhooks.html#merge-request-events
    """

    EVENT_TYPE = IntegrationWebhookEventType.MERGE_REQUEST
    # Order matters: seed OrganizationContributors before the code-review
    # handler runs preflight, otherwise the first MR open from a new
    # contributor would be denied with ORG_CONTRIBUTOR_NOT_FOUND.
    WEBHOOK_EVENT_PROCESSORS = (
        track_gitlab_contributor_seat_processor,
        track_gitlab_contributor_action_processor,
        handle_merge_request_event,
    )

    def __call__(self, event: Mapping[str, Any], **kwargs):
        if not (
            (organization := kwargs.get("organization"))
            and (integration := kwargs.get("integration"))
        ):
            raise ValueError("Organization and integration must be provided")

        repo = self.get_repo(integration, organization, event)
        if repo is None:
            debug_log(
                logger,
                organization,
                "gitlab.merge_request.repo_not_found",
                {
                    "integration_id": integration.id,
                    "project_id": (event.get("project") or {}).get("id"),
                },
            )
            return

        object_attributes = event.get("object_attributes") or {}
        debug_log(
            logger,
            organization,
            "gitlab.merge_request.received",
            {
                "organization_slug": organization.slug,
                "integration_id": integration.id,
                "repo_id": repo.id,
                "pr_number": object_attributes.get("iid"),
                "action": object_attributes.get("action"),
            },
        )

        # while we're here, make sure repo data is up to date
        self.update_repo_data(repo, event)

        try:
            number = event["object_attributes"]["iid"]
            title = event["object_attributes"]["title"]
            body = event["object_attributes"]["description"]
            created_at = event["object_attributes"]["created_at"]
            merge_commit_sha = event["object_attributes"]["merge_commit_sha"]

            last_commit = event["object_attributes"]["last_commit"]
            author_email = None
            author_name = None
            head_commit_sha = None
            if last_commit:
                author_email = last_commit["author"]["email"]
                author_name = last_commit["author"]["name"]
                head_commit_sha = last_commit.get("id")

            updated_at = event["object_attributes"].get("updated_at")
            merged_at = event["object_attributes"].get("merged_at")
            state = _map_gitlab_state_to_pullrequest_lifecycle(
                event["object_attributes"].get("state")
            )
            action = event["object_attributes"].get("action")
            draft = event["object_attributes"].get("work_in_progress")
        except KeyError as e:
            logger.warning(
                "gitlab.webhook.invalid-merge-data",
                extra={
                    "integration_id": integration.id if integration else None,
                    "error": str(e),
                },
            )
            return

        if not author_email:
            debug_log(
                logger,
                organization,
                "gitlab.merge_request.missing_author_email",
                {
                    "integration_id": integration.id,
                    "repo_id": repo.id,
                    "pr_number": number,
                },
            )
            raise Http404()

        author = CommitAuthor.objects.get_or_create(
            organization_id=organization.id, email=author_email, defaults={"name": author_name}
        )[0]

        opened_at = parse_date(created_at).astimezone(timezone.utc)
        state_changed_at = parse_date(updated_at).astimezone(timezone.utc) if updated_at else None
        merged_at_dt = parse_date(merged_at).astimezone(timezone.utc) if merged_at else None

        defaults = {
            "title": title,
            "author": author,
            "message": body,
            "merge_commit_sha": merge_commit_sha,
            "head_commit_sha": head_commit_sha,
            "date_added": opened_at,
            "opened_at": opened_at,
            "merged_at": merged_at_dt,
            "state": state,
            "draft": draft,
        }

        # GitLab has no closed_at, so derive it from the lifecycle action. A
        # merged merge request is also closed. Actions that don't change
        # lifecycle state (e.g. "update") leave the stored closed_at untouched.
        if action == "merge":
            defaults["closed_at"] = merged_at_dt or state_changed_at
        elif action == "close":
            defaults["closed_at"] = state_changed_at
        elif action in ("reopen", "open"):
            defaults["closed_at"] = None

        author.preload_users()
        try:
            PullRequest.objects.update_or_create(
                organization_id=organization.id,
                repository_id=repo.id,
                key=number,
                defaults=defaults,
            )
        except IntegrityError:
            pass

        self._handle(
            integration=integration,
            event=event,
            organization=organization,
            repo=repo,
        )


class NoteEventWebhook(GitlabWebhook):
    """
    Handle Note Hook events (comments on MRs, issues, etc.).

    Only MR notes containing the "@sentry review" command phrase are forwarded
    to Seer; all other notes are silently dropped by ``handle_merge_request_note_event``.

    See https://docs.gitlab.com/ee/user/project/integrations/webhooks.html#comment-events
    """

    EVENT_TYPE = IntegrationWebhookEventType.ISSUE_COMMENT
    WEBHOOK_EVENT_PROCESSORS = (handle_merge_request_note_event,)

    def __call__(self, event: Mapping[str, Any], **kwargs):
        if not (
            (organization := kwargs.get("organization"))
            and (integration := kwargs.get("integration"))
        ):
            raise ValueError("Organization and integration must be provided")

        repo = self.get_repo(integration, organization, event)
        if repo is None:
            debug_log(
                logger,
                organization,
                "gitlab.note.repo_not_found",
                {
                    "integration_id": integration.id,
                    "project_id": (event.get("project") or {}).get("id"),
                },
            )
            return

        object_attributes = event.get("object_attributes") or {}
        merge_request = event.get("merge_request") or {}
        debug_log(
            logger,
            organization,
            "gitlab.note.received",
            {
                "organization_slug": organization.slug,
                "integration_id": integration.id,
                "repo_id": repo.id,
                "note_id": object_attributes.get("id"),
                "noteable_type": object_attributes.get("noteable_type"),
                "action": object_attributes.get("action"),
                "mr_iid": merge_request.get("iid"),
            },
        )

        # Keep repo metadata fresh (url and path_with_namespace).
        self.update_repo_data(repo, event)

        self._handle(
            integration=integration,
            event=event,
            organization=organization,
            repo=repo,
        )


class PushEventWebhook(GitlabWebhook):
    """
    Handle push hook

    See https://docs.gitlab.com/ee/user/project/integrations/webhooks.html#push-events
    """

    EVENT_TYPE = IntegrationWebhookEventType.PUSH

    def __call__(self, event: Mapping[str, Any], **kwargs):
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

        authors = {}

        # TODO: gitlab only sends a max of 20 commits. If a push contains
        # more commits they provide a total count and require additional API
        # requests to fetch the commit details
        for commit in event.get("commits", []):
            if IntegrationRepositoryProvider.should_ignore_commit(commit["message"]):
                continue

            author_email = commit["author"]["email"]

            # TODO(dcramer): we need to deal with bad values here, but since
            # its optional, lets just throw it out for now
            if author_email is None or len(author_email) > 75:
                author = None
            elif author_email not in authors:
                authors[author_email] = author = CommitAuthor.objects.get_or_create(
                    organization_id=organization.id,
                    email=author_email,
                    defaults={"name": commit["author"]["name"]},
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
                        key=commit["id"],
                        message=commit["message"],
                        author=author,
                        date_added=parse_date(commit["timestamp"]).astimezone(timezone.utc),
                    )
            except IntegrityError:
                pass

        self._handle(
            integration=integration,
            event=event,
            organization=organization,
            repo=repo,
        )


@cell_silo_endpoint
class GitlabWebhookEndpoint(Endpoint):
    owner = ApiOwner.CODING_WORKFLOWS
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    authentication_classes = ()
    permission_classes = ()
    provider = IntegrationProviderSlug.GITLAB

    _handlers: dict[str, type[GitlabWebhook]] = {
        "Push Hook": PushEventWebhook,
        "Merge Request Hook": MergeEventWebhook,
        "Note Hook": NoteEventWebhook,
        "Issue Hook": IssuesEventWebhook,
    }

    @method_decorator(csrf_exempt)
    def dispatch(self, request: HttpRequest, *args, **kwargs) -> HttpResponse:
        if request.method != "POST":
            return HttpResponse(status=405, reason="HTTP method not supported.")

        with action_context_scope(ActionSource.GITLAB, resolve_action_actor(request)):
            return super().dispatch(request, *args, **kwargs)

    def post(self, request: HttpRequest) -> HttpResponse:
        clear_organization_info()
        extra = {
            # This tells us the Gitlab version being used (e.g. current gitlab.com version -> GitLab/15.4.0-pre)
            "webhook.user_agent": request.META.get("HTTP_USER_AGENT"),
            # Gitlab does not seem to be the only host sending events
            # AppPlatformEvents also hit this API
            "webhook.event_type": request.META.get("HTTP_X_GITLAB_EVENT"),
        }
        result = get_gitlab_external_id(request=request, extra=extra)
        if isinstance(result, HttpResponse):
            return result
        (external_id, secret) = result

        org_contexts = integration_service.organization_contexts(
            provider=self.provider, external_id=external_id
        )
        integration = org_contexts.integration
        installs = org_contexts.organization_integrations
        if integration is None:
            logger.info("gitlab.webhook.invalid-organization", extra=extra)
            extra["webhook.reason"] = "There is no integration that matches your organization."
            logger.warning(extra["webhook.reason"])
            return HttpResponse(status=409, reason=extra["webhook.reason"])

        extra = {
            **extra,
            # The metadata could be useful to debug
            # domain_name -> gitlab.com/getsentry-ecosystem/foo'
            # scopes -> ['api']
            "webhook.integration.metadata": integration.metadata,
            "webhook.integration.id": integration.id,  # This is useful to query via Redash
            "webhook.integration.status": integration.status,  # 0 seems to be active
            # Logs/EAP attributes are scalar-first; a list serializes as an
            # "array" attribute that the Logs explorer won't expose as a
            # queryable column. Join to a string so it's filterable. Some
            # integrations are installed on a huge number of orgs, so cap the
            # list to keep the log attribute from blowing up.
            "webhook.org_ids": ",".join(str(install.organization_id) for install in installs[:25]),
        }

        if not constant_time_compare(secret, integration.metadata["webhook_secret"]):
            # Summary and potential workaround mentioned here:
            # https://github.com/getsentry/sentry/issues/34903#issuecomment-1262754478
            extra["webhook.reason"] = GITLAB_WEBHOOK_SECRET_INVALID_ERROR
            logger.info("gitlab.webhook.invalid-token-secret", extra=extra)
            return HttpResponse(status=409, reason=GITLAB_WEBHOOK_SECRET_INVALID_ERROR)

        try:
            event = orjson.loads(request.body)
        except orjson.JSONDecodeError:
            extra["webhook.reason"] = "Data received is not JSON."
            logger.warning("gitlab.webhook.invalid-json", extra=extra)
            return HttpResponse(status=400, reason=extra["webhook.reason"])

        try:
            handler = self._handlers[request.META["HTTP_X_GITLAB_EVENT"]]
        except KeyError:
            supported_events = ", ".join(sorted(self._handlers.keys()))
            extra["webhook.reason"] = (
                "The customer has edited the webhook in Gitlab to include other types of events. We only support these kinds of events: %s"
                % supported_events
            )
            logger.warning("gitlab.webhook.wrong-event-type", extra=extra)
            return HttpResponse(status=400, reason=extra["webhook.reason"])

        for install in installs:
            org_context = organization_service.get_organization_by_id(
                id=install.organization_id, include_teams=False, include_projects=False
            )
            if org_context:
                organization = org_context.organization
                event_handler = handler()

                with (
                    webhook_viewer_context(install.organization_id),
                    IntegrationWebhookEvent(
                        interaction_type=event_handler.event_type,
                        domain=IntegrationDomain.SOURCE_CODE_MANAGEMENT,
                        provider_key=event_handler.provider,
                    ).capture(),
                ):
                    event_handler(event, integration=integration, organization=organization)

        return HttpResponse(status=204)
