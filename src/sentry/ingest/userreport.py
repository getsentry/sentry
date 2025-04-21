from __future__ import annotations

import logging
import random
import uuid
from datetime import datetime, timedelta

from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import IntegrityError, router
from django.utils import timezone

from sentry import eventstore, options
from sentry.constants import DataCategory
from sentry.eventstore.models import Event, GroupEvent
from sentry.feedback.lib.types import UserReportDict
from sentry.feedback.usecases.create_feedback import (
    UNREAL_FEEDBACK_UNATTENDED_MESSAGE,
    FeedbackCreationSource,
    is_in_feedback_denylist,
    shim_to_feedback,
)
from sentry.models.project import Project
from sentry.models.userreport import UserReport
from sentry.signals import user_feedback_received
from sentry.utils import metrics
from sentry.utils.db import atomic_transaction
from sentry.utils.eventuser import EventUser
from sentry.utils.outcomes import Outcome, track_outcome
from sentry.utils.rollback_metrics import incr_rollback_metrics

logger = logging.getLogger(__name__)


class Conflict(Exception):
    pass


def save_userreport(
    project: Project,
    report: UserReportDict,
    source: FeedbackCreationSource,
    start_time: datetime | None = None,
) -> UserReport | None:
    with metrics.timer("sentry.ingest.userreport.save_userreport", tags={"referrer": source.value}):
        if is_in_feedback_denylist(project.organization):
            metrics.incr(
                "user_report.create_user_report.filtered",
                tags={"reason": "org.denylist", "referrer": source.value},
            )
            track_outcome(
                org_id=project.organization_id,
                project_id=project.id,
                key_id=None,
                outcome=Outcome.RATE_LIMITED,
                reason="feedback_denylist",
                timestamp=start_time or timezone.now(),
                event_id=None,  # Note report["event_id"] is id of the associated event, not the report itself.
                category=DataCategory.USER_REPORT_V2,
                quantity=1,
            )
            return None

        report["comments"] = report["comments"].strip()

        should_filter, reason_tag, filter_reason = should_filter_user_report(
            report, project.id, source=source
        )
        if should_filter:
            metrics.incr(
                "user_report.create_user_report.filtered",
                tags={"reason": reason_tag, "referrer": source.value},
            )
            track_outcome(
                org_id=project.organization_id,
                project_id=project.id,
                key_id=None,
                outcome=Outcome.INVALID,
                reason=filter_reason,
                timestamp=start_time or timezone.now(),
                event_id=None,  # Note report["event_id"] is id of the associated event, not the report itself.
                category=DataCategory.USER_REPORT_V2,
                quantity=1,
            )
            return None

        if start_time is None:
            start_time = timezone.now()

        # XXX(dcramer): enforce case insensitivity by coercing this to a lowercase string
        report["event_id"] = report["event_id"].lower()
        report["project_id"] = project.id

        # Use the associated event to validate and update the report.
        event: Event | GroupEvent | None = eventstore.backend.get_event_by_id(
            project.id, report["event_id"]
        )

        euser = find_event_user(event)

        if euser and not euser.name and report.get("name"):
            euser.name = report["name"]

        if event:
            # if the event is more than 30 minutes old, we don't allow updates
            # as it might be abusive
            if event.datetime < start_time - timedelta(minutes=30):
                raise Conflict("Feedback for this event cannot be modified.")

            report["environment_id"] = event.get_environment().id
            if event.group_id:
                report["group_id"] = event.group_id

        # Save the report.
        try:
            with atomic_transaction(using=router.db_for_write(UserReport)):
                report_instance = UserReport.objects.create(**report)

        except IntegrityError:
            # There was a duplicate, so just overwrite the existing
            # row with the new one. The only way this ever happens is
            # if someone is messing around with the API, or doing
            # something wrong with the SDK, but this behavior is
            # more reasonable than just hard erroring and is more
            # expected.
            incr_rollback_metrics(UserReport)
            existing_report = UserReport.objects.get(
                project_id=report["project_id"], event_id=report["event_id"]
            )

            # if the existing report was submitted more than 5 minutes ago, we dont
            # allow updates as it might be abusive (replay attacks)
            if existing_report.date_added < timezone.now() - timedelta(minutes=5):
                raise Conflict("Feedback for this event cannot be modified.")

            existing_report.update(
                name=report.get("name", ""),
                email=report.get("email", ""),
                comments=report["comments"],
            )
            report_instance = existing_report

            metrics.incr(
                "user_report.create_user_report.overwrite_duplicate",
                tags={"referrer": source.value},
            )

        else:
            if report_instance.group_id:
                report_instance.notify()

        # Additionally processing if save is successful.
        user_feedback_received.send_robust(project=project, sender=save_userreport)

        logger.info(
            "ingest.user_report",
            extra={
                "project_id": project.id,
                "event_id": report["event_id"],
                "has_event": bool(event),
            },
        )
        metrics.incr(
            "user_report.create_user_report.saved",
            tags={"has_event": bool(event), "referrer": source.value},
        )
        if event and source.value in FeedbackCreationSource.old_feedback_category_values():
            logger.info(
                "ingest.user_report.shim_to_feedback",
                extra={"project_id": project.id, "event_id": report["event_id"]},
            )
            shim_to_feedback(report, event, project, source)
            # XXX(aliu): the update_user_reports task will still try to shim the report after a period, unless group_id or environment is set.

        return report_instance


def find_event_user(event: Event | GroupEvent | None) -> EventUser | None:
    if not event:
        return None
    return EventUser.from_event(event)


def should_filter_user_report(
    report: UserReportDict,
    project_id: int,
    source: FeedbackCreationSource = FeedbackCreationSource.USER_REPORT_ENVELOPE,
) -> tuple[bool, str | None, str | None]:
    """
    We don't care about empty user reports, or ones that
    the unreal SDKs send.
    """
    for field in ["name", "email", "comments", "event_id"]:
        if field not in report:
            return True, "missing_required_field", "Missing required field"

    name, email, comments = (
        report["name"],
        report["email"],
        report["comments"],
    )

    max_comment_length = UserReport._meta.get_field("comments").max_length
    if max_comment_length and len(comments) > max_comment_length:
        metrics.distribution(
            "feedback.large_message",
            len(comments),
            tags={
                "entrypoint": "save_userreport",
                "referrer": source.value,
            },
        )
        if random.random() < 0.1:
            logger.info(
                "Feedback message exceeds max size.",
                extra={
                    "project_id": project_id,
                    "entrypoint": "save_userreport",
                    "referrer": source.value,
                    "length": len(comments),
                    "feedback_message": comments[:100],
                },
            )
        return True, "too_large.message", "Message Too Large"

    max_name_length = UserReport._meta.get_field("name").max_length
    if max_name_length and len(name) > max_name_length:
        return True, "too_large.name", "Name Too Large"

    try:
        validate_email(email)
    except ValidationError:
        return True, "invalid_email", "Invalid Email"

    max_email_length = UserReport._meta.get_field("email").max_length
    if max_email_length and len(email) > max_email_length:
        return True, "too_large.email", "Email Too Large"

    try:
        # Validates UUID and strips dashes.
        report["event_id"] = uuid.UUID(report["event_id"].lower()).hex
    except ValueError:
        return True, "invalid_event_id", "Invalid Event ID"

    if options.get("feedback.filter_garbage_messages"):  # Message-based filter kill-switch.
        if not comments:
            return True, "empty", "Empty Feedback Messsage"

        if comments == UNREAL_FEEDBACK_UNATTENDED_MESSAGE:
            return True, "unreal.unattended", "Sent in Unreal Unattended Mode"

    return False, None, None
