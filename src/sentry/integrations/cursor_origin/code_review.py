from __future__ import annotations

from sentry import features
from sentry.integrations.cursor_origin.webhook_types import PullRequestEvent
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.models.repositorysettings import CodeReviewTrigger
from sentry.seer.code_review.contributor_seats import record_contributor_action
from sentry.seer.code_review.webhooks.review_request import PullRequestReviewEvent, request_review

EVENT_TYPE = "cursor_origin.pull_request"
REVIEW_TRIGGERS = {
    "pull_request.created": CodeReviewTrigger.ON_READY_FOR_REVIEW,
    "pull_request.published": CodeReviewTrigger.ON_READY_FOR_REVIEW,
    "pull_request.head_ref.pushed": CodeReviewTrigger.ON_NEW_COMMIT,
}
CLOSE_EVENTS = {"pull_request.closed", "pull_request.merged"}


def review_event(event_type: str, event: PullRequestEvent) -> PullRequestReviewEvent | None:
    if event_type in CLOSE_EVENTS:
        trigger = None
    elif event_type in REVIEW_TRIGGERS:
        trigger = REVIEW_TRIGGERS[event_type]
    else:
        return None

    pull_request = event.pull_request
    contributor = pull_request.author.contributor()
    user = pull_request.author.user
    return PullRequestReviewEvent(
        event_type=EVENT_TYPE,
        action=event_type.removeprefix("pull_request."),
        pr_number=int(pull_request.number),
        head_sha=pull_request.head.sha,
        trigger=trigger,
        is_draft=pull_request.draft,
        author_external_id=contributor[0] if contributor else None,
        trigger_user=user.handle if user else None,
        trigger_at=pull_request.updated_at,
    )


def handle_code_review(
    event_type: str,
    event: PullRequestEvent,
    repo: Repository,
    integration: RpcIntegration,
) -> None:
    review = review_event(event_type, event)
    if review is None:
        return

    organization = Organization.objects.get_from_cache(id=repo.organization_id)
    if not features.has("organizations:seer-cursor-origin-support", organization):
        return

    contributor = event.pull_request.author.contributor()
    if contributor is not None:
        external_id, alias = contributor
        record_contributor_action(
            organization=organization,
            repo=repo,
            integration=integration,
            user_id=external_id,
            user_username=alias,
            pr_number=review.pr_number,
            is_opened=event_type == "pull_request.created",
        )

    request_review(review, organization=organization, repo=repo, integration=integration)
