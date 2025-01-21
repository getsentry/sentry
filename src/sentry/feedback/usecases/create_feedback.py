from __future__ import annotations

import logging
import random
from datetime import UTC, datetime
from enum import Enum
from typing import Any, TypedDict
from uuid import uuid4

import jsonschema
import sentry_sdk

from sentry import features, options
from sentry.constants import DataCategory
from sentry.eventstore.models import Event, GroupEvent
from sentry.feedback.usecases.spam_detection import is_spam, spam_detection_enabled
from sentry.issues.grouptype import FeedbackGroup
from sentry.issues.issue_occurrence import IssueEvidence, IssueOccurrence
from sentry.issues.json_schemas import EVENT_PAYLOAD_SCHEMA, LEGACY_EVENT_PAYLOAD_SCHEMA
from sentry.issues.producer import PayloadType, produce_occurrence_to_kafka
from sentry.issues.status_change_message import StatusChangeMessage
from sentry.models.group import GroupStatus
from sentry.models.project import Project
from sentry.signals import first_feedback_received, first_new_feedback_received
from sentry.types.group import GroupSubStatus
from sentry.utils import metrics
from sentry.utils.outcomes import Outcome, track_outcome
from sentry.utils.safe import get_path

logger = logging.getLogger(__name__)

UNREAL_FEEDBACK_UNATTENDED_MESSAGE = "Sent in the unattended mode"


class FeedbackCreationSource(Enum):
    NEW_FEEDBACK_ENVELOPE = "new_feedback_envelope"
    USER_REPORT_DJANGO_ENDPOINT = "user_report_sentry_django_endpoint"
    USER_REPORT_ENVELOPE = "user_report_envelope"
    CRASH_REPORT_EMBED_FORM = "crash_report_embed_form"
    UPDATE_USER_REPORTS_TASK = "update_user_reports_task"

    @classmethod
    def new_feedback_category_values(cls) -> set[str]:
        return {
            c.value
            for c in [
                cls.NEW_FEEDBACK_ENVELOPE,
            ]
        }

    @classmethod
    def old_feedback_category_values(cls) -> set[str]:
        return {
            c.value
            for c in [
                cls.CRASH_REPORT_EMBED_FORM,
                cls.USER_REPORT_ENVELOPE,
                cls.USER_REPORT_DJANGO_ENDPOINT,
                cls.UPDATE_USER_REPORTS_TASK,
            ]
        }


def make_evidence(feedback, source: FeedbackCreationSource, is_message_spam: bool | None):
    evidence_data = {}
    evidence_display = []
    if feedback.get("associated_event_id"):
        evidence_data["associated_event_id"] = feedback["associated_event_id"]
        evidence_display.append(
            IssueEvidence(
                name="associated_event_id", value=feedback["associated_event_id"], important=False
            )
        )
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

    if is_message_spam is True:
        evidence_data["is_spam"] = is_message_spam
        evidence_display.append(
            IssueEvidence(name="is_spam", value=str(is_message_spam), important=False)
        )

    return evidence_data, evidence_display


def fix_for_issue_platform(event_data: dict[str, Any]) -> dict[str, Any]:
    """
    The issue platform has slightly different requirements than ingest for event schema,
    so we need to massage the data a bit.
    * event["tags"] is coerced to a dict.
    * If event["user"]["email"] is missing we try to set using the feedback context.

    Returns:
        A dict[str, Any] conforming to sentry.issues.json_schemas.EVENT_PAYLOAD_SCHEMA.
    """
    ret_event: dict[str, Any] = {}

    ret_event["timestamp"] = datetime.fromtimestamp(event_data["timestamp"], UTC).isoformat()

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

    # Force `tags` to be a dict if it's initially a list,
    # since we can't guarantee its type here.
    tags = event_data.get("tags", {})
    tags_dict = {}
    if isinstance(tags, list):
        for [k, v] in tags:
            tags_dict[k] = v
    else:
        tags_dict = tags
    ret_event["tags"] = tags_dict

    # Set the event message to the feedback message.
    ret_event["logentry"] = {"message": feedback_obj.get("message")}

    return ret_event


def validate_issue_platform_event_schema(event_data):
    """
    The issue platform schema validation does not run in dev atm so we have to do the validation
    ourselves, or else our tests are not representative of what happens in prod.
    """
    try:
        jsonschema.validate(event_data, EVENT_PAYLOAD_SCHEMA)
    except jsonschema.exceptions.ValidationError:
        try:
            jsonschema.validate(event_data, LEGACY_EVENT_PAYLOAD_SCHEMA)
        except jsonschema.exceptions.ValidationError:
            metrics.incr("feedback.create_feedback_issue.invalid_schema")
            raise


def should_filter_feedback(event, project_id, source: FeedbackCreationSource):
    # Right now all unreal error events without a feedback
    # actually get a sent a feedback with this message
    # signifying there is no feedback. Let's go ahead and filter these.

    if (
        event.get("contexts") is None
        or event["contexts"].get("feedback") is None
        or event["contexts"]["feedback"].get("message") is None
    ):
        metrics.incr(
            "feedback.create_feedback_issue.filtered",
            tags={
                "reason": "missing_context",
                "referrer": source.value,
            },
        )
        # Temporary log for debugging.
        if random.random() < 0.1:
            project = Project.objects.get_from_cache(id=project_id)
            contexts = event.get("contexts", {})
            feedback = contexts.get("feedback", {})
            feedback_msg = feedback.get("message")
            logger.info(
                "Filtered missing context or message.",
                extra={
                    "project_id": project_id,
                    "organization_id": project.organization_id,
                    "has_contexts": contexts != {},
                    "has_feedback": feedback != {},
                    "event_type": event.get("type"),
                    "feedback_message": feedback_msg,
                    "platform": project.platform,
                    "referrer": source.value,
                },
            )
        return True

    if event["contexts"]["feedback"]["message"] == UNREAL_FEEDBACK_UNATTENDED_MESSAGE:
        metrics.incr(
            "feedback.create_feedback_issue.filtered",
            tags={
                "reason": "unreal.unattended",
                "referrer": source.value,
            },
        )
        return True

    if event["contexts"]["feedback"]["message"].strip() == "":
        metrics.incr(
            "feedback.create_feedback_issue.filtered",
            tags={
                "reason": "empty",
                "referrer": source.value,
            },
        )
        # Temporary log for debugging.
        project = Project.objects.get_from_cache(id=project_id)
        logger.info(
            "Filtered empty feedback message.",
            extra={
                "project_id": project_id,
                "organization_id": project.organization_id,
                "platform": project.platform,
                "referrer": source.value,
            },
        )
        return True

    return False


def create_feedback_issue(event, project_id: int, source: FeedbackCreationSource):
    metrics.incr(
        "feedback.create_feedback_issue.entered",
        tags={
            "referrer": source.value,
        },
    )

    if should_filter_feedback(event, project_id, source):
        return

    feedback_message = event["contexts"]["feedback"]["message"]
    max_msg_size = options.get("feedback.message.max-size")  # Note options are cached.
    project = Project.objects.get_from_cache(id=project_id)

    # Spam detection.
    is_message_spam = None
    if spam_detection_enabled(project):
        if len(feedback_message) <= max_msg_size:
            try:
                is_message_spam = is_spam(feedback_message)
            except Exception:
                # until we have LLM error types ironed out, just catch all exceptions
                logger.exception(
                    "Error checking if message is spam", extra={"project_id": project_id}
                )
            metrics.incr(
                "feedback.create_feedback_issue.spam_detection",
                tags={
                    "is_spam": is_message_spam,
                    "referrer": source.value,
                },
                sample_rate=1.0,
            )
        else:
            is_message_spam = True

    if len(feedback_message) > max_msg_size:
        metrics.distribution(
            "feedback.large_message",
            len(feedback_message),
            tags={
                "entrypoint": "create_feedback_issue",
                "referrer": source.value,
            },
        )
        logger.info(
            "Feedback message exceeds max size.",
            extra={
                "project_id": project_id,
                "entrypoint": "create_feedback_issue",
                "referrer": source.value,
            },
        )
        # Sentry will capture `feedback_message` in local variables (truncated).
        sentry_sdk.capture_message("Feedback message exceeds max size.", "warning")
        feedback_message = feedback_message[:max_msg_size]

    # Note that some of the fields below like title and subtitle
    # are not used by the feedback UI, but are required.
    event["event_id"] = event.get("event_id") or uuid4().hex
    detection_time = datetime.fromtimestamp(event["timestamp"], UTC)
    evidence_data, evidence_display = make_evidence(
        event["contexts"]["feedback"], source, is_message_spam
    )
    issue_fingerprint = [uuid4().hex]
    occurrence = IssueOccurrence(
        id=uuid4().hex,
        event_id=event.get("event_id") or uuid4().hex,
        project_id=project_id,
        fingerprint=issue_fingerprint,  # random UUID for fingerprint so feedbacks are grouped individually
        issue_title="User Feedback",
        subtitle=feedback_message,
        resource_id=None,
        evidence_data=evidence_data,
        evidence_display=evidence_display,
        type=FeedbackGroup,
        detection_time=detection_time,
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

    # Set the user.email tag since we want to be able to display user.email on the feedback UI as a tag
    # as well as be able to write alert conditions on it
    user_email = get_path(event_fixed, "user", "email")
    if user_email and "user.email" not in event_fixed["tags"]:
        event_fixed["tags"]["user.email"] = user_email

    # Set the trace.id tag to expose it for the feedback UI.
    trace_id = get_path(event_fixed, "contexts", "trace", "trace_id")
    if trace_id:
        event_fixed["tags"]["trace.id"] = trace_id

    # make sure event data is valid for issue platform
    validate_issue_platform_event_schema(event_fixed)

    # Analytics
    if not project.flags.has_feedbacks:
        first_feedback_received.send_robust(project=project, sender=Project)

    if (
        source
        in [
            FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE,
        ]
        and not project.flags.has_new_feedbacks
    ):
        first_new_feedback_received.send_robust(project=project, sender=Project)

    # Send to issue platform for processing.
    produce_occurrence_to_kafka(
        payload_type=PayloadType.OCCURRENCE, occurrence=occurrence, event_data=event_fixed
    )
    # Mark as spam. We need this since IP doesn't currently support an initial status of IGNORED.
    if is_message_spam:
        auto_ignore_spam_feedbacks(project, issue_fingerprint)
    metrics.incr(
        "feedback.create_feedback_issue.produced_occurrence",
        tags={
            "referrer": source.value,
        },
        sample_rate=1.0,
    )

    track_outcome(
        org_id=project.organization_id,
        project_id=project_id,
        key_id=None,
        outcome=Outcome.ACCEPTED,
        reason=None,
        timestamp=detection_time,
        event_id=event["event_id"],
        category=DataCategory.USER_REPORT_V2,
        quantity=1,
    )


def auto_ignore_spam_feedbacks(project, issue_fingerprint):
    """
    Marks an issue as spam with a STATUS_CHANGE kafka message. The IGNORED status allows the occurrence to skip alerts
    and be picked up by frontend spam queries.
    """
    if features.has("organizations:user-feedback-spam-filter-actions", project.organization):
        metrics.incr("feedback.spam-detection-actions.set-ignored")
        produce_occurrence_to_kafka(
            payload_type=PayloadType.STATUS_CHANGE,
            status_change=StatusChangeMessage(
                fingerprint=issue_fingerprint,
                project_id=project.id,
                new_status=GroupStatus.IGNORED,  # we use ignored in the UI for the spam tab
                new_substatus=GroupSubStatus.FOREVER,
            ),
        )


###########
# Shim code
###########


class UserReportShimDict(TypedDict):
    name: str
    email: str
    comments: str
    event_id: str
    level: str


def shim_to_feedback(
    report: UserReportShimDict,
    event: Event | GroupEvent,
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
    if is_in_feedback_denylist(project.organization):
        return

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

        feedback_event["contexts"]["feedback"]["associated_event_id"] = event.event_id

        if get_path(event.data, "contexts", "replay", "replay_id"):
            feedback_event["contexts"]["replay"] = event.data["contexts"]["replay"]
            feedback_event["contexts"]["feedback"]["replay_id"] = event.data["contexts"]["replay"][
                "replay_id"
            ]

        if get_path(event.data, "contexts", "trace", "trace_id"):
            feedback_event["contexts"]["trace"] = event.data["contexts"]["trace"]

        feedback_event["timestamp"] = event.datetime.timestamp()
        feedback_event["platform"] = event.platform
        feedback_event["level"] = event.data["level"]
        feedback_event["environment"] = event.get_environment().name
        feedback_event["tags"] = [list(item) for item in event.tags]

        create_feedback_issue(feedback_event, project.id, source)
    except Exception:
        logger.exception("Error attempting to create new user feedback by shimming a user report")
        metrics.incr("feedback.shim_to_feedback.failed", tags={"referrer": source.value})


def is_in_feedback_denylist(organization):
    return organization.slug in options.get("feedback.organizations.slug-denylist")
