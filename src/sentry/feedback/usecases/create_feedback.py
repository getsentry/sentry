from uuid import uuid4

from sentry.feedback.models import Feedback
from sentry.issues.grouptype import FeedbackGroup
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.producer import produce_occurrence_to_kafka
from sentry.utils.dates import ensure_aware


def create_feedback(result):

    Feedback.objects.create(**result)

    occurrence = IssueOccurrence(
        id=uuid4().hex,
        event_id=str(result["feedback_id"]).replace("-", ""),
        project_id=result["project_id"],
        fingerprint=[
            uuid4().hex
        ],  # random UUID for fingerprint so feedbacks are grouped individually
        issue_title="User Feedback",
        subtitle=result["message"],
        resource_id=None,
        evidence_data={},
        evidence_display=[],
        type=FeedbackGroup,
        detection_time=ensure_aware(result["date_added"]),
        culprit="user",  # TODO: fill in culprit correctly -- URL or paramaterized route/tx name
        level="info",  # TODO: severity based on input?
    )
    event_data = {
        "event_id": occurrence.event_id,
        "fingerprint": occurrence.fingerprint,
        "environment": result["environment"].name,
        "platform": result["data"]["platform"],
        "project_id": result["project_id"],
        "received": result["date_added"].isoformat(),
        "tags": {},
        "timestamp": result["date_added"].isoformat(),
    }

    produce_occurrence_to_kafka(occurrence, event_data=event_data)
