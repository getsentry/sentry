from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
from datetime import datetime, timezone
from typing import Any

import orjson
from dateutil.parser import parse as parse_date
from django.db import IntegrityError, router, transaction
from django.http import HttpRequest, HttpResponse
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, all_silo_endpoint
from sentry.constants import ObjectStatus
from sentry.integrations.cursor_origin.webhook_signature import (
    is_timestamp_fresh,
    verify_signature,
)
from sentry.integrations.services.integration import integration_service
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.commit import Commit
from sentry.models.commitauthor import CommitAuthor
from sentry.models.repository import Repository
from sentry.plugins.providers import IntegrationRepositoryProvider
from sentry.utils import metrics

logger = logging.getLogger("sentry.integrations.cursor_origin")

# Origin's delivery envelope wraps the event, so the type lives in both a header
# and the body. The header is used, since it is available before parsing.
EVENT_TYPE_HEADER = "webhook-event-type"
DELIVERY_ID_HEADER = "webhook-id"
TIMESTAMP_HEADER = "webhook-timestamp"
SIGNATURE_HEADER = "webhook-signature"
INSTALLATION_ID_HEADER = "webhook-installation-id"


@all_silo_endpoint
class CursorOriginWebhookEndpoint(Endpoint):
    """Receives Cursor Origin webhook deliveries.

    Signature verification is Ed25519 against Origin's published JWKS -- see
    webhook_signature.py. Deliveries are at-least-once, so consumers must
    deduplicate on the ``webhook-id`` header.

    Only installation lifecycle is acted on today. Everything else is
    acknowledged and logged: Origin retries and can disable an endpoint that
    keeps failing, so returning 200 for an event we do not handle yet is
    deliberate, not an oversight.
    """

    authentication_classes = ()
    permission_classes = ()

    owner = ApiOwner.INTEGRATION_PLATFORM
    publish_status = {"POST": ApiPublishStatus.PRIVATE}

    @method_decorator(csrf_exempt)
    def dispatch(self, request: HttpRequest, *args: Any, **kwargs: Any) -> HttpResponse:
        if request.method != "POST":
            return HttpResponse(status=405)
        return super().dispatch(request, *args, **kwargs)

    def post(self, request: HttpRequest) -> HttpResponse:
        delivery_id = request.headers.get(DELIVERY_ID_HEADER)
        timestamp = request.headers.get(TIMESTAMP_HEADER)
        signature = request.headers.get(SIGNATURE_HEADER)
        event_type = request.headers.get(EVENT_TYPE_HEADER)

        if not (delivery_id and timestamp and signature):
            logger.warning("cursor_origin.webhook.missing_headers")
            return HttpResponse(status=400)

        body = bytes(request.body)
        if not body:
            return HttpResponse(status=400)

        if not is_timestamp_fresh(timestamp):
            metrics.incr("cursor_origin.webhook.rejected", tags={"reason": "stale"})
            logger.warning("cursor_origin.webhook.stale", extra={"delivery_id": delivery_id})
            return HttpResponse(status=400)

        if not verify_signature(delivery_id, timestamp, body, signature):
            metrics.incr("cursor_origin.webhook.rejected", tags={"reason": "bad_signature"})
            logger.warning(
                "cursor_origin.webhook.invalid_signature", extra={"delivery_id": delivery_id}
            )
            return HttpResponse(status=401)

        try:
            payload = orjson.loads(body)
        except orjson.JSONDecodeError:
            return HttpResponse(status=400)

        metrics.incr("cursor_origin.webhook.received", tags={"event_type": event_type or "unknown"})

        if event_type == "installation.deleted":
            self._handle_installation_deleted(request, payload)
        elif event_type == "repository.pushed":
            self._handle_push(request, payload)
        else:
            # Acknowledged so Origin stops retrying; handlers land with PR
            # comment and review support.
            logger.info(
                "cursor_origin.webhook.unhandled",
                extra={"event_type": event_type, "delivery_id": delivery_id},
            )

        return HttpResponse(status=204)

    def _handle_installation_deleted(self, request: HttpRequest, payload: Any) -> None:
        """Disable the integration when the app is uninstalled.

        Without this the integration keeps trying to mint tokens for an
        installation that no longer exists, which surfaces as recurring auth
        failures rather than as "someone uninstalled it".
        """
        installation_id = request.headers.get(INSTALLATION_ID_HEADER) or (
            payload.get("installationId") if isinstance(payload, dict) else None
        )
        if not installation_id:
            logger.warning("cursor_origin.webhook.deleted_without_installation_id")
            return

        result = integration_service.organization_contexts(
            provider=IntegrationProviderSlug.CURSOR_ORIGIN.value,
            external_id=installation_id,
        )
        if result.integration is None:
            # Possible if the integration was removed in Sentry first.
            logger.warning(
                "cursor_origin.webhook.deleted_missing_integration",
                extra={"installation_id": installation_id},
            )
            return

        integration_service.update_integration(
            integration_id=result.integration.id, status=ObjectStatus.DISABLED
        )
        logger.info(
            "cursor_origin.webhook.installation_deleted",
            extra={
                "installation_id": installation_id,
                "integration_id": result.integration.id,
            },
        )

    def _handle_push(self, request: HttpRequest, payload: Any) -> None:
        """Record commits from a push.

        Origin's push event carries only ``headCommit`` per ref update, not
        GitHub's full ``commits[]``, so the range has to be fetched. That is what
        the repository provider's compare walk already does.
        """
        event = (payload or {}).get("event") or {}
        push = event.get("payload") or {}
        repo_id = ((push.get("repository") or {}).get("id")) or None
        ref_updates = push.get("refUpdates") or []

        if not repo_id or not ref_updates:
            logger.info("cursor_origin.webhook.push_without_refs")
            return

        repos = Repository.objects.filter(
            provider=f"integrations:{IntegrationProviderSlug.CURSOR_ORIGIN.value}",
            external_id=str(repo_id),
            status=ObjectStatus.ACTIVE,
        )
        for repo in repos:
            for ref_update in ref_updates:
                self._record_ref_update(repo, ref_update)

    def _record_ref_update(self, repo: Repository, ref_update: dict[str, Any]) -> None:
        ref = ref_update.get("ref") or ""
        # Tags do not carry commits worth associating.
        if not ref.startswith("refs/heads/") or ref_update.get("deleted"):
            return

        head = ref_update.get("headCommit") or {}
        head_sha = ref_update.get("after") or head.get("sha")
        if not head_sha:
            return

        before = ref_update.get("before") or ""
        if ref_update.get("created") or set(before) == {"0"}:
            # A created ref has an all-zero `before`, which Origin's compare
            # rejects outright ("revision not found"). Record just the tip rather
            # than trying to walk a new branch's entire history.
            commits: list[dict[str, Any]] = [head] if head.get("sha") else []
        else:
            provider = self._repository_provider()
            try:
                commits = provider.compare_commits(repo, before, head_sha)
            except Exception:
                logger.warning(
                    "cursor_origin.webhook.push_compare_failed",
                    extra={"repo_id": repo.id, "ref": ref},
                    exc_info=True,
                )
                return
            self._create_commits(repo, commits)
            return

        self._create_commits(repo, [self._as_internal_commit(c) for c in commits])

    @staticmethod
    def _repository_provider() -> Any:
        from sentry.plugins.base import bindings

        cls = bindings.get("integration-repository.provider").get(
            f"integrations:{IntegrationProviderSlug.CURSOR_ORIGIN.value}"
        )
        return cls(f"integrations:{IntegrationProviderSlug.CURSOR_ORIGIN.value}")

    @staticmethod
    def _as_internal_commit(raw: dict[str, Any]) -> dict[str, Any]:
        """Shape a raw Origin commit like the provider's compare output."""
        author = raw.get("author") or {}
        return {
            "id": raw.get("sha"),
            "message": raw.get("message") or "",
            "author_email": author.get("email"),
            "author_name": author.get("name"),
            "timestamp": author.get("date"),
            "patch_set": [],
        }

    def _create_commits(self, repo: Repository, commits: Sequence[Mapping[str, Any]]) -> None:
        authors: dict[str, CommitAuthor] = {}
        for commit in commits:
            sha = commit.get("id")
            message = commit.get("message") or ""
            if not sha or IntegrationRepositoryProvider.should_ignore_commit(message):
                continue

            author = self._commit_author(repo, commit, authors)
            try:
                with transaction.atomic(router.db_for_write(Commit)):
                    Commit.objects.create(
                        repository_id=repo.id,
                        organization_id=repo.organization_id,
                        key=sha,
                        message=message,
                        author=author,
                        date_added=self._commit_date(commit.get("timestamp")),
                    )
            except IntegrityError:
                # Deliveries are at-least-once and pushes overlap, so seeing a
                # commit twice is expected rather than an error.
                pass

    @staticmethod
    def _commit_author(
        repo: Repository, commit: Mapping[str, Any], cache: dict[str, CommitAuthor]
    ) -> CommitAuthor | None:
        email = commit.get("author_email")
        if not email or len(email) > 75:
            return None
        if email in cache:
            return cache[email]
        author = CommitAuthor.objects.get_or_create(
            organization_id=repo.organization_id,
            email=email,
            defaults={"name": commit.get("author_name")},
        )[0]
        cache[email] = author
        return author

    @staticmethod
    def _commit_date(timestamp: Any) -> datetime:
        """Commit date, defaulting to now when Origin gives something unusable."""
        if isinstance(timestamp, datetime):
            return timestamp.astimezone(timezone.utc)
        if isinstance(timestamp, str):
            try:
                return parse_date(timestamp).astimezone(timezone.utc)
            except (ValueError, OverflowError):
                pass
        return datetime.now(timezone.utc)
