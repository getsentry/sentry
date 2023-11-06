from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, TypedDict
from uuid import uuid4

import jsonschema

from sentry.eventstore.models import Event
from sentry.issues.grouptype import FeedbackGroup
from sentry.issues.issue_occurrence import IssueEvidence, IssueOccurrence
from sentry.issues.json_schemas import EVENT_PAYLOAD_SCHEMA, LEGACY_EVENT_PAYLOAD_SCHEMA
from sentry.issues.producer import PayloadType, produce_occurrence_to_kafka
from sentry.models.project import Project
from sentry.signals import first_feedback_received
from sentry.utils.dates import ensure_aware
from sentry.utils.safe import get_path

logger = logging.getLogger(__name__)


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
    if feedback.get("name"):
        evidence_data["name"] = feedback["name"]
        evidence_display.append(IssueEvidence(name="name", value=feedback["name"], important=False))

    return evidence_data, evidence_display


def fix_for_issue_platform(event_data):
    # the issue platform has slightly different requirements than ingest
    # for event schema, so we need to massage the data a bit
    event_data["timestamp"] = ensure_aware(
        datetime.fromtimestamp(event_data["timestamp"])
    ).isoformat()
    if "contexts" not in event_data:
        event_data["contexts"] = {}

    if event_data.get("feedback") and not event_data.get("contexts", {}).get("feedback"):
        event_data["contexts"]["feedback"] = event_data["feedback"]
        del event_data["feedback"]

        if not event_data["contexts"].get("replay") and event_data["contexts"]["feedback"].get(
            "replay_id"
        ):
            event_data["contexts"]["replay"] = {
                "replay_id": event_data["contexts"]["feedback"].get("replay_id")
            }

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
    evidence_data, evidence_display = make_evidence(event["feedback"])
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
        evidence_data=evidence_data,
        evidence_display=evidence_display,
        type=FeedbackGroup,
        detection_time=ensure_aware(datetime.fromtimestamp(event["timestamp"])),
        culprit="user",  # TODO: fill in culprit correctly -- URL or paramaterized route/tx name?
        level="info",  # TODO: severity based on input?
    )
    now = datetime.now()

    event_data = {
        "project_id": project_id,
        "received": now.isoformat(),
        "level": "info",
        "tags": event.get("tags", {}),
        **event,
    }
    fix_for_issue_platform(event_data)

    # make sure event data is valid for issue platform
    validate_issue_platform_event_schema(event_data)

    project = Project.objects.get_from_cache(id=project_id)

    if not project.flags.has_feedbacks:
        first_feedback_received.send_robust(project=project, sender=Project)

    produce_occurrence_to_kafka(
        payload_type=PayloadType.OCCURRENCE, occurrence=occurrence, event_data=event_data
    )


def validate_issue_platform_event_schema(event_data):
    """
    The issue platform schema validation does not run in dev atm so we have to do the validation
    ourselves, or else our tests are not representative of what happens in prod.
    """
    try:
        jsonschema.validate(event_data, EVENT_PAYLOAD_SCHEMA)
    except jsonschema.exceptions.ValidationError:
        jsonschema.validate(event_data, LEGACY_EVENT_PAYLOAD_SCHEMA)


class UserReportShimDict(TypedDict):
    name: str
    email: str
    comments: str


def shim_to_feedback(report: UserReportShimDict, event: Event, project: Project):
    """
    takes user reports from the legacy user report form/endpoint and
    user reports that come from relay envelope ingestion and
    creates a new User Feedback from it.
    User feedbacks are an event type, so we try and grab as much from the
    legacy user report and event to create the new feedback.
    """
    try:
        feedback_event: dict[str, Any] = {
            "feedback": {
                "name": report.get("name", ""),
                "contact_email": report["email"],
                "message": report["comments"],
            },
            "contexts": {},
        }

        if event:
            feedback_event["feedback"]["crash_report_event_id"] = event.event_id

            if get_path(event.data, "contexts", "replay", "replay_id"):
                feedback_event["contexts"]["replay"] = event.data["contexts"]["replay"]
                feedback_event["feedback"]["replay_id"] = event.data["contexts"]["replay"][
                    "replay_id"
                ]
            feedback_event["timestamp"] = event.datetime.timestamp()

            feedback_event["platform"] = event.platform

        else:
            feedback_event["timestamp"] = datetime.utcnow().timestamp()
            feedback_event["platform"] = "other"

        create_feedback_issue(feedback_event, project.id)
    except Exception:
        logger.exception(
            "Error attempting to create new User Feedback from Shiming old User Report"
        )
