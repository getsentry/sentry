from __future__ import annotations

import logging
from datetime import datetime
from enum import Enum
from typing import Any, TypedDict
from uuid import uuid4

import jsonschema

from sentry.eventstore.models import Event
from sentry.issues.grouptype import FeedbackGroup
from sentry.issues.issue_occurrence import IssueEvidence, IssueOccurrence
from sentry.issues.json_schemas import EVENT_PAYLOAD_SCHEMA, LEGACY_EVENT_PAYLOAD_SCHEMA
from sentry.issues.producer import PayloadType, produce_occurrence_to_kafka
from sentry.models.project import Project
from sentry.signals import first_feedback_received, first_new_feedback_received
from sentry.utils import metrics
from sentry.utils.dates import ensure_aware
from sentry.utils.safe import get_path

logger = logging.getLogger(__name__)

UNREAL_FEEDBACK_UNATTENDED_MESSAGE = "Sent in the unattended mode"


class FeedbackCreationSource(Enum):
    NEW_FEEDBACK_ENVELOPE = "new_feedback_envelope"
    NEW_FEEDBACK_DJANGO_ENDPOINT = "new_feedback_sentry_django_endpoint"  # TODO: delete this once feedback_ingest API deprecated
    USER_REPORT_DJANGO_ENDPOINT = "user_report_sentry_django_endpoint"
    USER_REPORT_ENVELOPE = "user_report_envelope"
    CRASH_REPORT_EMBED_FORM = "crash_report_embed_form"


def make_evidence(feedback, source: FeedbackCreationSource):
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

    evidence_data["source"] = source.value
    evidence_display.append(IssueEvidence(name="source", value=source.value, important=False))

    return evidence_data, evidence_display


def fix_for_issue_platform(event_data):
    # the issue platform has slightly different requirements than ingest
    # for event schema, so we need to massage the data a bit
    ret_event: dict[str, Any] = {}

    ret_event["timestamp"] = ensure_aware(
        datetime.fromtimestamp(event_data["timestamp"])
    ).isoformat()

    ret_event["received"] = event_data["received"]

    ret_event["project_id"] = event_data["project_id"]

    ret_event["contexts"] = event_data.get("contexts", {})

    # TODO: remove this once feedback_ingest API deprecated
    # as replay context will be filled in
    if not event_data["contexts"].get("replay") and event_data["contexts"].get("feedback", {}).get(
        "replay_id"
    ):
        ret_event["contexts"]["replay"] = {
            "replay_id": event_data["contexts"].get("feedback", {}).get("replay_id")
        }
    ret_event["event_id"] = event_data["event_id"]
    ret_event["tags"] = event_data.get("tags", [])

    ret_event["platform"] = event_data.get("platform", "other")
    ret_event["level"] = event_data.get("level", "info")

    ret_event["environment"] = event_data.get("environment", "production")
    if event_data.get("sdk"):
        ret_event["sdk"] = event_data["sdk"]
    ret_event["request"] = event_data.get("request", {})

    ret_event["user"] = event_data.get("user", {})

    if event_data.get("dist") is not None:
        del event_data["dist"]
    if event_data.get("user", {}).get("name") is not None:
        del event_data["user"]["name"]
    if event_data.get("user", {}).get("isStaff") is not None:
        del event_data["user"]["isStaff"]

    if event_data.get("user", {}).get("id") is not None:
        event_data["user"]["id"] = str(event_data["user"]["id"])

    # If no user email was provided specify the contact-email as the user-email.
    feedback_obj = event_data.get("contexts", {}).get("feedback", {})
    contact_email = feedback_obj.get("contact_email")
    if not ret_event["user"].get("email", ""):
        ret_event["user"]["email"] = contact_email

    # Set the event message to the feedback message.
    ret_event["logentry"] = {"message": feedback_obj.get("message")}

    return ret_event


def should_filter_feedback(event, project_id, source: FeedbackCreationSource):
    # Right now all unreal error events without a feedback
    # actually get a sent a feedback with this message
    # signifying there is no feedback. Let's go ahead and filter these.
    if event["contexts"]["feedback"]["message"] == UNREAL_FEEDBACK_UNATTENDED_MESSAGE:
        metrics.incr("feedback.filtered", tags={"reason": "unreal.unattended"}, sample_rate=1.0)
        return True

    return False


def create_feedback_issue(event, project_id, source: FeedbackCreationSource):
    if should_filter_feedback(event, project_id, source):
        return

    metrics.incr("feedback.created", tags={"referrer": source.value}, sample_rate=1.0)
    # Note that some of the fields below like title and subtitle
    # are not used by the feedback UI, but are required.
    event["event_id"] = event.get("event_id") or uuid4().hex
    evidence_data, evidence_display = make_evidence(event["contexts"]["feedback"], source)
    occurrence = IssueOccurrence(
        id=uuid4().hex,
        event_id=event.get("event_id") or uuid4().hex,
        project_id=project_id,
        fingerprint=[
            uuid4().hex
        ],  # random UUID for fingerprint so feedbacks are grouped individually
        issue_title="User Feedback",
        subtitle=event["contexts"]["feedback"]["message"],
        resource_id=None,
        evidence_data=evidence_data,
        evidence_display=evidence_display,
        type=FeedbackGroup,
        detection_time=ensure_aware(datetime.fromtimestamp(event["timestamp"])),
        culprit="user",  # TODO: fill in culprit correctly -- URL or paramaterized route/tx name?
        level=event.get("level", "info"),
    )
    now = datetime.now()

    event_data = {
        "project_id": project_id,
        "received": now.isoformat(),
        "tags": event.get("tags", {}),
        **event,
    }
    event_fixed = fix_for_issue_platform(event_data)

    # make sure event data is valid for issue platform
    validate_issue_platform_event_schema(event_fixed)

    project = Project.objects.get_from_cache(id=project_id)

    if not project.flags.has_feedbacks:
        first_feedback_received.send_robust(project=project, sender=Project)

    if (
        source
        in [
            FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE,
            FeedbackCreationSource.NEW_FEEDBACK_DJANGO_ENDPOINT,
        ]
        and not project.flags.has_new_feedbacks
    ):
        first_new_feedback_received.send_robust(project=project, sender=Project)

    produce_occurrence_to_kafka(
        payload_type=PayloadType.OCCURRENCE, occurrence=occurrence, event_data=event_fixed
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
    event_id: str
    level: str


def shim_to_feedback(
    report: UserReportShimDict,
    event: Event,
    project: Project,
    source: FeedbackCreationSource,
):
    """
    takes user reports from the legacy user report form/endpoint and
    user reports that come from relay envelope ingestion and
    creates a new User Feedback from it.
    User feedbacks are an event type, so we try and grab as much from the
    legacy user report and event to create the new feedback.
    """
    try:
        feedback_event: dict[str, Any] = {
            "contexts": {
                "feedback": {
                    "name": report.get("name", ""),
                    "contact_email": report["email"],
                    "message": report["comments"],
                },
            },
        }

        if event:
            feedback_event["contexts"]["feedback"]["associated_event_id"] = event.event_id

            if get_path(event.data, "contexts", "replay", "replay_id"):
                feedback_event["contexts"]["replay"] = event.data["contexts"]["replay"]
                feedback_event["contexts"]["feedback"]["replay_id"] = event.data["contexts"][
                    "replay"
                ]["replay_id"]
            feedback_event["timestamp"] = event.datetime.timestamp()
            feedback_event["level"] = event.data["level"]
            feedback_event["platform"] = event.platform
            feedback_event["level"] = event.data["level"]
            feedback_event["environment"] = event.get_environment().name
        else:
            feedback_event["timestamp"] = datetime.utcnow().timestamp()
            feedback_event["platform"] = "other"
            feedback_event["level"] = report.get("level", "info")

            if report.get("event_id"):
                feedback_event["contexts"]["feedback"]["associated_event_id"] = report["event_id"]

        create_feedback_issue(feedback_event, project.id, source)
    except Exception:
        logger.exception(
            "Error attempting to create new User Feedback from Shiming old User Report"
        )
