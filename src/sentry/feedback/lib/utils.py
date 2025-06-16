import logging
from datetime import datetime

from django.conf import settings
from django.utils import timezone

from sentry.constants import DataCategory
from sentry.feedback.usecases.create_feedback import FeedbackCreationSource
from sentry.issues.grouptype import FeedbackGroup
from sentry.models.project import Project
from sentry.ratelimits.sliding_windows import RedisSlidingWindowRateLimiter, RequestedQuota
from sentry.utils import metrics
from sentry.utils.outcomes import Outcome, track_outcome

feedback_rate_limiter = RedisSlidingWindowRateLimiter(
    **settings.SENTRY_USER_FEEDBACK_RATE_LIMITER_OPTIONS
)

logger = logging.getLogger(__name__)


def check_feedback_quota_granted(
    project_id: int,
    event_id: str | None,
    source: FeedbackCreationSource,
    dt: datetime | None = None,
) -> bool:
    """
    Checks the feedback rate limiter, emitting an outcome, metric, log, and returning False if exceeded.
    We apply this in creation sources to prevent abuse of the feedback system and protect downstream infra.
    """
    granted_quota = feedback_rate_limiter.check_and_use_quotas(
        [
            RequestedQuota(
                f"issue-platform-issues:{project_id}:{FeedbackGroup.slug}",  # noqa E231 missing whitespace after ':'
                1,
                [FeedbackGroup.creation_quota],
            )
        ]
    )[0]

    if not granted_quota.granted:
        project = Project.objects.get_from_cache(id=project_id)
        track_outcome(
            org_id=project.organization_id,
            project_id=project_id,
            key_id=None,
            outcome=Outcome.RATE_LIMITED,
            reason="feedback_abuse_quota",
            timestamp=dt or timezone.now(),
            event_id=event_id,
            category=DataCategory.USER_REPORT_V2,
            quantity=1,
        )

        metrics.incr("feedback.abuse_quota_exceeded", tags={"referrer": source.value})
        logger.warning(
            "Feedback abuse quota exceeded",
            extra={
                "project_id": project_id,
                "project_slug": project.slug,
                "organization_id": project.organization_id,
                "organization_slug": project.organization.slug,
                "source": source.value,
            },
        )
        return False

    return True
