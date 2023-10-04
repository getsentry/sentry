import datetime
from uuid import uuid4

from sentry.issues.grouptype import FeedbackGroup
from sentry.issues.issue_occurrence import IssueEvidence, IssueOccurrence
from sentry.issues.producer import produce_occurrence_to_kafka
from sentry.utils.dates import ensure_aware


def create_feedback_issue(event, project_id):
    occurrence = IssueOccurrence(
        id=uuid4().hex,
        event_id=event["event_id"],
        project_id=project_id,
        fingerprint=[
            uuid4().hex
        ],  # random UUID for fingerprint so feedbacks are grouped individually
        issue_title="User Feedback",
        subtitle=event["feedback"]["message"],
        resource_id=None,
        evidence_data={
            "contact_email": event["feedback"]["contact_email"],
            "message": event["feedback"]["message"],
        },
        evidence_display=[
            IssueEvidence(
                name="contact_email",
                value=event["feedback"]["contact_email"],
                important=True,
            ),
            IssueEvidence(
                name="message",
                value=event["feedback"]["message"],
                important=True,
            ),
        ],
        type=FeedbackGroup,
        detection_time=ensure_aware(datetime.datetime.fromtimestamp(event["timestamp"])),
        culprit="user",  # TODO: fill in culprit correctly -- URL or paramaterized route/tx name?
        level="info",  # TODO: severity based on input?
    )
    event_data = {"fingerprint": occurrence.fingerprint, "project_id": project_id, **event}

    produce_occurrence_to_kafka(occurrence, event_data=event_data)
