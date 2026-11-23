import logging

from sentry import options
from sentry.feedback.lib.seer_api import SpamShadowScoreRequest, make_spam_shadow_score_request
from sentry.seer.signed_seer_api import SeerViewerContext
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import issues_tasks
from sentry.utils import metrics
from sentry.viewer_context import Actor, ActorType, ViewerContext, viewer_context_scope

logger = logging.getLogger(__name__)

SEER_TIMEOUT_S = 20
SEER_RETRIES = 0


@instrumented_task(
    name="sentry.feedback.tasks.spam_shadow.spam_shadow_score",
    namespace=issues_tasks,
    processing_deadline_duration=30,
    retry=None,
    silo_mode=SiloMode.CELL,
)
def spam_shadow_score(
    organization_id: int,
    project_id: int,
    feedback_event_id: str,
    feedback_message: str,
    llm_is_spam: bool,
) -> None:
    """
    Sends a feedback message to the shadow spam classifier in Seer, alongside the LLM spam
    verdict. Seer records agreement metrics; the result is not used by Sentry. This task
    never raises, since shadow traffic must not affect product behavior.
    """
    try:
        # Seer only logs the message text on a mismatch when this is set. The text can contain
        # PII, so this is restricted to an explicit allowlist of internal organizations.
        log_mismatch_message = organization_id in options.get(
            "feedback.spam-shadow.message-log-org-ids"
        )
        body = SpamShadowScoreRequest(
            organization_id=organization_id,
            project_id=project_id,
            feedback_event_id=feedback_event_id,
            feedback_message=feedback_message,
            llm_is_spam=llm_is_spam,
            log_mismatch_message=log_mismatch_message,
        )
        with viewer_context_scope(
            ViewerContext(
                actor=Actor(type=ActorType.SYSTEM),
                organization_id=organization_id,
                project_id=project_id,
            )
        ):
            response = make_spam_shadow_score_request(
                body,
                timeout=SEER_TIMEOUT_S,
                retries=SEER_RETRIES,
                viewer_context=SeerViewerContext(organization_id=organization_id),
            )
    except Exception:
        metrics.incr("feedback.spam_shadow.error", tags={"reason": "request"})
        logger.warning(
            "feedback.spam_shadow.request_failed",
            exc_info=True,
            extra={"organization_id": organization_id, "project_id": project_id},
        )
        return

    if response.status < 200 or response.status >= 300:
        metrics.incr(
            "feedback.spam_shadow.error",
            tags={"reason": "status", "status": str(response.status)},
        )
        logger.warning(
            "feedback.spam_shadow.bad_status",
            extra={
                "organization_id": organization_id,
                "project_id": project_id,
                "status_code": response.status,
            },
        )
        return

    try:
        response_data = response.json()
        skipped = isinstance(response_data, dict) and bool(response_data.get("skipped"))
    except Exception:
        metrics.incr("feedback.spam_shadow.error", tags={"reason": "invalid_response"})
        logger.warning(
            "feedback.spam_shadow.invalid_response",
            exc_info=True,
            extra={"organization_id": organization_id, "project_id": project_id},
        )
        return

    metrics.incr("feedback.spam_shadow.scored", tags={"skipped": skipped})
