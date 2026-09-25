from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone

import sentry_sdk
from pydantic import ValidationError

from sentry.integrations.services.integration.model import RpcIntegration
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.models.repositorysettings import CodeReviewTrigger
from sentry.seer.code_review.models import (
    SeerCodeReviewTaskRequestForPrClosed,
    SeerCodeReviewTaskRequestForPrReview,
    SeerCodeReviewTrigger,
)
from sentry.utils import json

from ..metrics import (
    WebhookFilteredReason,
    record_webhook_enqueued,
    record_webhook_filtered,
    record_webhook_received,
)
from ..preflight import CodeReviewPreflightService
from ..utils import SeerEndpoint, _common_codegen_request_payload
from .task import process_github_webhook_event

logger = logging.getLogger(__name__)

SEER_TRIGGERS: dict[CodeReviewTrigger, SeerCodeReviewTrigger] = {
    CodeReviewTrigger.ON_READY_FOR_REVIEW: SeerCodeReviewTrigger.ON_READY_FOR_REVIEW,
    CodeReviewTrigger.ON_NEW_COMMIT: SeerCodeReviewTrigger.ON_NEW_COMMIT,
}


@dataclass(frozen=True)
class PullRequestReviewEvent:
    """A pull request event used to decide whether to run or clean up a review.

    ``trigger=None`` represents a close event, which is used to clean up an existing review.
    """

    event_type: str
    action: str
    pr_number: int
    head_sha: str
    trigger: CodeReviewTrigger | None
    is_draft: bool
    author_external_id: str | None
    trigger_user: str | None = None
    trigger_user_id: int | None = None
    trigger_at: datetime | None = None
    is_private: bool | None = None

    @property
    def is_close(self) -> bool:
        return self.trigger is None


def request_review(
    event: PullRequestReviewEvent,
    *,
    organization: Organization,
    repo: Repository,
    integration: RpcIntegration,
) -> None:
    record_webhook_received(event.event_type, event.action)

    preflight = CodeReviewPreflightService(
        organization=organization,
        repo=repo,
        integration=integration,
        pr_author_external_id=event.author_external_id,
    ).check()
    if not preflight.allowed:
        if preflight.denial_reason:
            record_webhook_filtered(event.event_type, event.action, preflight.denial_reason)
        return

    triggers = preflight.settings.triggers if preflight.settings else []
    enabled = bool(triggers) if event.trigger is None else event.trigger in triggers
    if not enabled:
        record_webhook_filtered(
            event.event_type, event.action, WebhookFilteredReason.TRIGGER_DISABLED
        )
        return

    if event.is_draft and not event.is_close:
        return

    _schedule(event, organization=organization, repo=repo, integration=integration)


def _schedule(
    event: PullRequestReviewEvent,
    *,
    organization: Organization,
    repo: Repository,
    integration: RpcIntegration,
) -> None:
    now = datetime.now(timezone.utc)
    payload = _common_codegen_request_payload(
        add_experiment_enabled=not event.is_close,
        repo=repo,
        target_commit_sha=event.head_sha,
        organization=organization,
        event_payload={},
    )
    data = payload["data"]
    data["repo"]["is_private"] = event.is_private
    data["pr_id"] = event.pr_number
    data["config"].update(
        trigger=(
            SEER_TRIGGERS[event.trigger] if event.trigger else SeerCodeReviewTrigger.UNKNOWN
        ).value,
        trigger_user=event.trigger_user,
        trigger_user_id=event.trigger_user_id,
        trigger_comment_id=None,
        trigger_comment_type=None,
        trigger_at=(event.trigger_at or now).isoformat(),
        sentry_received_trigger_at=now.isoformat(),
    )

    if event.is_close:
        seer_path = SeerEndpoint.CODE_REVIEW_PR_CLOSED.value
        request_model: type[
            SeerCodeReviewTaskRequestForPrClosed | SeerCodeReviewTaskRequestForPrReview
        ] = SeerCodeReviewTaskRequestForPrClosed
    else:
        seer_path = SeerEndpoint.CODE_REVIEW_REVIEW_REQUEST.value
        request_model = SeerCodeReviewTaskRequestForPrReview

    try:
        validated = request_model.parse_obj(payload)
    except ValidationError as e:
        sentry_sdk.capture_exception(e, level="warning")
        record_webhook_filtered(
            event.event_type, event.action, WebhookFilteredReason.INVALID_PAYLOAD
        )
        return

    process_github_webhook_event.delay(
        seer_path=seer_path,
        event_payload=json.loads(validated.json()),
        tags={
            "sentry_organization_id": str(organization.id),
            "sentry_organization_slug": organization.slug,
            "sentry_integration_id": str(integration.id),
            "scm_provider": integration.provider,
        },
    )
    record_webhook_enqueued(event.event_type, event.action)
