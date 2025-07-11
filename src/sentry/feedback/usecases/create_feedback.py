from __future__ import annotations

import logging
import random
from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

import jsonschema

from sentry import options
from sentry.constants import DataCategory
from sentry.eventstore.models import Event, GroupEvent
from sentry.feedback.lib.types import UserReportDict
from sentry.feedback.lib.utils import (
    UNREAL_FEEDBACK_UNATTENDED_MESSAGE,
    FeedbackCreationSource,
    is_in_feedback_denylist,
)
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
from sentry.utils.projectflags import set_project_flag_and_signal
from sentry.utils.safe import get_path

logger = logging.getLogger(__name__)


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

    evidence_data["source"] = source.value  # Used by alerts post process.
    # Exluding this from the display, since it's not useful to users.

    if is_message_spam is True:
        evidence_data["is_spam"] = is_message_spam  # Used by alerts post process.
        evidence_display.append(
            IssueEvidence(name="is_spam", value=str(is_message_spam), important=False)
        )

    return evidence_data, evidence_display


def fix_for_issue_platform(event_data: dict[str, Any]) -> dict[str, Any]:
    """
    The issue platform has slightly different requirements than ingest for event schema,
    so we need to massage the data a bit.
    * event["timestamp"] is converted to a UTC ISO string.
    * event["tags"] is coerced to a dict.
    * If user or replay context is missing we try to set it using the feedback context.
    * level defaults to "info" and environment defaults to "production".

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

    environment = event_data.get("environment")
    ret_event["environment"] = environment or "production"

    release_value = event_data.get("release")
    if release_value:
        ret_event["release"] = release_value

    if event_data.get("sdk"):
        ret_event["sdk"] = event_data["sdk"]
    ret_event["request"] = event_data.get("request", {})

    ret_event["user"] = event_data.get("user", {})
    if "name" in ret_event["user"]:
        del ret_event["user"]["name"]

    if "isStaff" in ret_event["user"]:
        del ret_event["user"]["isStaff"]

    if "id" in ret_event["user"]:
        ret_event["user"]["id"] = str(ret_event["user"]["id"])

    # If no user email was provided specify the contact-email as the user-email.
    feedback_obj = event_data.get("contexts", {}).get("feedback", {})
    if "email" not in ret_event["user"]:
        ret_event["user"]["email"] = feedback_obj.get("contact_email", "")

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


def should_filter_feedback(
    event, project_id, source: FeedbackCreationSource
) -> tuple[bool, str | None]:
    # Right now all unreal error events without a feedback
    # actually get a sent a feedback with this message
    # signifying there is no feedback. Let's go ahead and filter these.

    if (
        event.get("contexts") is None
        or event["contexts"].get("feedback") is None
        or event["contexts"]["feedback"].get("message") is None
    ):
        project = Project.objects.get_from_cache(id=project_id)
        metrics.incr(
            "feedback.create_feedback_issue.filtered",
            tags={
                "platform": project.platform,
                "reason": "missing_context",
                "referrer": source.value,
            },
        )
        return True, "Missing Feedback Context"

    message = event["contexts"]["feedback"]["message"]

    if message == UNREAL_FEEDBACK_UNATTENDED_MESSAGE:
        metrics.incr(
            "feedback.create_feedback_issue.filtered",
            tags={
                "reason": "unreal.unattended",
                "referrer": source.value,
            },
        )
        return True, "Sent in Unreal Unattended Mode"

    if message.strip() == "":
        project = Project.objects.get_from_cache(id=project_id)
        metrics.incr(
            "feedback.create_feedback_issue.filtered",
            tags={
                "platform": project.platform,
                "reason": "empty",
                "referrer": source.value,
            },
        )
        return True, "Empty Feedback Message"

    if len(message) > options.get("feedback.message.max-size"):
        # Note options are cached.
        metrics.distribution(
            "feedback.large_message",
            len(message),
            tags={
                "entrypoint": "create_feedback_issue",
                "referrer": source.value,
            },
        )
        if random.random() < 0.1:
            logger.info(
                "Feedback message exceeds max size.",
                extra={
                    "project_id": project_id,
                    "entrypoint": "create_feedback_issue",
                    "referrer": source.value,
                    "length": len(message),
                    "feedback_message": message[:100],
                },
            )
        return True, "Too Large"

    associated_event_id = get_path(event, "contexts", "feedback", "associated_event_id")
    if associated_event_id:
        try:
            UUID(str(associated_event_id))
        except ValueError:
            metrics.incr(
                "feedback.create_feedback_issue.filtered",
                tags={
                    "reason": "invalid_associated_event_id",
                    "referrer": source.value,
                },
            )
            return True, "Invalid Event ID"

    return False, None


def get_feedback_title(feedback_message: str, max_words: int = 10) -> str:
    """
    Generate a descriptive title for user feedback issues.
    Format: "User Feedback: [first few words of message]"

    Args:
        feedback_message: The user's feedback message
        max_words: Maximum number of words to include from the message

    Returns:
        A formatted title string
    """
    stripped_message = feedback_message.strip()

    # Clean and split the message into words
    words = stripped_message.split()

    if len(words) <= max_words:
        summary = stripped_message
    else:
        summary = " ".join(words[:max_words])
        if len(summary) < len(stripped_message):
            summary += "..."

    title = f"User Feedback: {summary}"

    # Truncate if necessary (keeping some buffer for external system limits)
    if len(title) > 200:  # Conservative limit
        title = title[:197] + "..."

    return title


def create_feedback_issue(
    event: dict[str, Any], project_id: int, source: FeedbackCreationSource
) -> dict[str, Any] | None:
    """
    Produces a feedback issue occurrence to kafka for issues processing. Applies filters, spam filters, and event validation.

    Returns the formatted event data that was sent to issue platform.
    """

    metrics.incr(
        "feedback.create_feedback_issue.entered",
        tags={
            "referrer": source.value,
        },
    )

    project = Project.objects.get_from_cache(id=project_id)

    should_filter, filter_reason = should_filter_feedback(event, project_id, source)
    if should_filter:
        track_outcome(
            org_id=project.organization_id,
            project_id=project_id,
            key_id=None,
            outcome=Outcome.INVALID,
            reason=filter_reason,
            timestamp=datetime.fromtimestamp(event["timestamp"], UTC),
            event_id=event["event_id"],
            category=DataCategory.USER_REPORT_V2,
            quantity=1,
        )
        return None

    feedback_message = event["contexts"]["feedback"]["message"]

    # Spam detection.
    is_message_spam = None
    if spam_detection_enabled(project):
        try:
            is_message_spam = is_spam(feedback_message)
        except Exception:
            # until we have LLM error types ironed out, just catch all exceptions
            logger.exception("Error checking if message is spam", extra={"project_id": project_id})
        metrics.incr(
            "feedback.create_feedback_issue.spam_detection",
            tags={
                "is_spam": is_message_spam,
                "referrer": source.value,
            },
            sample_rate=1.0,
        )

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
        issue_title=get_feedback_title(feedback_message),
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

    # add the associated_event_id and has_linked_error to tags
    associated_event_id = get_path(event, "contexts", "feedback", "associated_event_id")
    if associated_event_id:
        event_fixed["tags"]["associated_event_id"] = associated_event_id
        event_fixed["tags"]["has_linked_error"] = "true"
    else:
        event_fixed["tags"]["has_linked_error"] = "false"

    if event_fixed.get("release"):
        event_fixed["tags"]["release"] = event_fixed["release"]

    # make sure event data is valid for issue platform
    validate_issue_platform_event_schema(event_fixed)

    # Analytics
    set_project_flag_and_signal(project, "has_feedbacks", first_feedback_received)

    if source == FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE:
        set_project_flag_and_signal(project, "has_new_feedbacks", first_new_feedback_received)

    # Send to issue platform for processing.
    produce_occurrence_to_kafka(
        payload_type=PayloadType.OCCURRENCE, occurrence=occurrence, event_data=event_fixed
    )
    # Mark as spam. We need this since IP doesn't currently support an initial status of IGNORED.
    if is_message_spam:
        produce_occurrence_to_kafka(
            payload_type=PayloadType.STATUS_CHANGE,
            status_change=StatusChangeMessage(
                fingerprint=issue_fingerprint,
                project_id=project.id,
                new_status=GroupStatus.IGNORED,  # we use ignored in the UI for the spam tab
                new_substatus=GroupSubStatus.FOREVER,
            ),
        )

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

    return event_fixed


###########
# Shim code
###########


def shim_to_feedback(
    report: UserReportDict,
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
        track_outcome(
            org_id=project.organization_id,
            project_id=project.id,
            key_id=None,
            outcome=Outcome.RATE_LIMITED,
            reason="feedback_denylist",
            timestamp=datetime.fromisoformat(event.timestamp),
            event_id=event.event_id,
            category=DataCategory.USER_REPORT_V2,
            quantity=1,
        )
        return

    try:
        name = (
            report.get("name")
            or get_path(event.data, "user", "name")
            or get_path(event.data, "user", "username")
            or ""
        )
        contact_email = report.get("email") or get_path(event.data, "user", "email") or ""

        feedback_event: dict[str, Any] = {
            "contexts": {
                "feedback": {
                    "name": name,
                    "contact_email": contact_email,
                    "message": report["comments"],
                    "associated_event_id": event.event_id,
                },
            },
        }

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

        # Entrypoint for "new" (issue platform based) feedback. This emits outcomes.
        create_feedback_issue(feedback_event, project.id, source)
    except Exception:
        logger.exception("Error attempting to create new user feedback by shimming a user report")
        metrics.incr("feedback.shim_to_feedback.failed", tags={"referrer": source.value})
