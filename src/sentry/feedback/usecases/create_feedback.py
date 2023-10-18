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
            IssueEvidence(name="contact_email", value=feedback["contact_email"], important=False)
        )
    if feedback.get("message"):
        evidence_data["message"] = feedback["message"]
        evidence_display.append(
            IssueEvidence(name="message", value=feedback["message"], important=True)
        )
    return evidence_data, evidence_display


def _fix_for_issue_platform(event_data):
    # the issue platform has slightly different requirements than ingest
    # for event schema, so we need to massage the data a bit
    event_data["timestamp"] = ensure_aware(
        datetime.datetime.fromtimestamp(event_data["timestamp"])
    ).isoformat()

    if event_data.get("feedback"):
        del event_data["feedback"]

    if event_data.get("dist") is not None:
        del event_data["dist"]
    if event_data.get("user", {}).get("name") is not None:
        del event_data["user"]["name"]
    if event_data.get("user", {}).get("isStaff") is not None:
        del event_data["user"]["isStaff"]

    if event_data.get("user", {}).get("id") is not None:
        event_data["user"]["id"] = str(event_data["user"]["id"])


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
    now = datetime.datetime.now()

    event_data = {
        "project_id": project_id,
        "received": now.isoformat(),
        "level": "info",
        "tags": event.get("tags", {}),
        **event,
    }
    _fix_for_issue_platform(event_data)

    produce_occurrence_to_kafka(occurrence, event_data=event_data)
