import datetime
from uuid import uuid4

from sentry.issues.grouptype import FeedbackGroup
from sentry.issues.issue_occurrence import IssueEvidence, IssueOccurrence
from sentry.issues.producer import produce_occurrence_to_kafka
from sentry.utils.dates import ensure_aware


def make_evidence(feedback):
    evidence_data = {}
    evidence_display = []
    if feedback.get("contact_email"):
        evidence_data["contact_email"] = feedback["contact_email"]
        evidence_display.append(
            IssueEvidence(name="contact_email", value=feedback["contact_email"], important=True)
        )
    if feedback.get("message"):
        evidence_data["message"] = feedback["message"]
        evidence_display.append(
            IssueEvidence(name="message", value=feedback["message"], important=True)
        )
    return evidence_data, evidence_display


def create_feedback_issue(event, project_id):
    # Note that some of the fields below like title and subtitle
    # are not used by the feedback UI, but are required.

    event["event_id"] = event.get("event_id") or uuid4().hex
    evidcence_data, evidence_display = make_evidence(event["feedback"])
    occurrence = IssueOccurrence(
        id=uuid4().hex,
        event_id=event.get("event_id") or uuid4().hex,
        project_id=project_id,
        fingerprint=[
            uuid4().hex
        ],  # random UUID for fingerprint so feedbacks are grouped individually
        issue_title="User Feedback",
        subtitle=event["feedback"]["message"],
        resource_id=None,
        evidence_data=evidcence_data,
        evidence_display=evidence_display,
        type=FeedbackGroup,
        detection_time=ensure_aware(datetime.datetime.fromtimestamp(event["timestamp"])),
        culprit="user",  # TODO: fill in culprit correctly -- URL or paramaterized route/tx name?
        level="info",  # TODO: severity based on input?
    )
    event_data = {"fingerprint": occurrence.fingerprint, "project_id": project_id, **event}

    produce_occurrence_to_kafka(occurrence, event_data=event_data)
