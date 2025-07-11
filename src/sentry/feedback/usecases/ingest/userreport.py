from __future__ import annotations

import logging
import random
import uuid
from datetime import datetime, timedelta

from django.core.exceptions import PermissionDenied
from django.db import IntegrityError, router
from django.utils import timezone

from sentry import eventstore, options
from sentry.api.exceptions import BadRequest
from sentry.constants import DataCategory
from sentry.eventstore.models import Event, GroupEvent
from sentry.feedback.lib.types import UserReportDict
from sentry.feedback.lib.utils import (
    UNREAL_FEEDBACK_UNATTENDED_MESSAGE,
    FeedbackCreationSource,
    is_in_feedback_denylist,
)
from sentry.feedback.usecases.ingest.shim_to_feedback import shim_to_feedback
from sentry.models.project import Project
from sentry.models.userreport import UserReport
from sentry.signals import user_feedback_received
from sentry.utils import metrics
from sentry.utils.db import atomic_transaction
from sentry.utils.outcomes import Outcome, track_outcome

logger = logging.getLogger(__name__)


class Conflict(Exception):
    pass


def save_userreport(
    project: Project,
    report: UserReportDict,
    source: FeedbackCreationSource,
    start_time: datetime | None = None,
) -> UserReport | None:
    with metrics.timer("userreport.create_user_report", tags={"referrer": source.value}):
        if start_time is None:
            start_time = timezone.now()

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
                timestamp=start_time,
                event_id=None,  # Note report["event_id"] is id of the associated event, not the report itself.
                category=DataCategory.USER_REPORT_V2,
                quantity=1,
            )
            if (
                source == FeedbackCreationSource.USER_REPORT_DJANGO_ENDPOINT
                or source == FeedbackCreationSource.CRASH_REPORT_EMBED_FORM
            ):
                raise PermissionDenied()
            return None

        should_filter, metrics_reason, display_reason = validate_user_report(
            report, project.id, source=source
        )
        if should_filter:
            metrics.incr(
                "user_report.create_user_report.filtered",
                tags={"reason": metrics_reason, "referrer": source.value},
            )
            track_outcome(
                org_id=project.organization_id,
                project_id=project.id,
                key_id=None,
                outcome=Outcome.INVALID,
                reason=display_reason,
                timestamp=start_time,
                event_id=None,  # Note report["event_id"] is id of the associated event, not the report itself.
                category=DataCategory.USER_REPORT_V2,
                quantity=1,
            )
            if (
                source == FeedbackCreationSource.USER_REPORT_DJANGO_ENDPOINT
                or source == FeedbackCreationSource.CRASH_REPORT_EMBED_FORM
            ):
                raise BadRequest(display_reason)
            return None

        # XXX(dcramer): enforce case insensitivity by coercing this to a lowercase string
        report["event_id"] = report["event_id"].lower()
        report["project_id"] = project.id

        # Use the associated event to validate and update the report.
        event: Event | GroupEvent | None = eventstore.backend.get_event_by_id(
            project.id, report["event_id"]
        )

        if event:
            # if the event is more than 30 minutes old, we don't allow updates
            # as it might be abusive
            if event.datetime < start_time - timedelta(minutes=30):
                metrics.incr(
                    "user_report.create_user_report.filtered",
                    tags={"reason": "event_too_old", "referrer": source.value},
                )
                track_outcome(
                    org_id=project.organization_id,
                    project_id=project.id,
                    key_id=None,
                    outcome=Outcome.INVALID,
                    reason="Associated event is too old",
                    timestamp=start_time,
                    event_id=None,
                    category=DataCategory.USER_REPORT_V2,
                    quantity=1,
                )
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
            existing_report = UserReport.objects.get(
                project_id=report["project_id"], event_id=report["event_id"]
            )

            # if the existing report was submitted more than 5 minutes ago, we dont
            # allow updates as it might be abusive (replay attacks)
            if existing_report.date_added < timezone.now() - timedelta(minutes=5):
                metrics.incr(
                    "user_report.create_user_report.filtered",
                    tags={"reason": "duplicate_report", "referrer": source.value},
                )
                track_outcome(
                    org_id=project.organization_id,
                    project_id=project.id,
                    key_id=None,
                    outcome=Outcome.INVALID,
                    reason="Duplicate report",
                    timestamp=start_time,
                    event_id=None,
                    category=DataCategory.USER_REPORT_V2,
                    quantity=1,
                )
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

        metrics.incr(
            "user_report.create_user_report.saved",
            tags={"has_event": bool(event), "referrer": source.value},
        )
        if event and source.value in FeedbackCreationSource.old_feedback_category_values():
            shim_to_feedback(report, event, project, source)
            # XXX(aliu): the update_user_reports task will still try to shim the report after a period, unless group_id or environment is set.

        return report_instance


def validate_user_report(
    report: UserReportDict,
    project_id: int,
    source: FeedbackCreationSource = FeedbackCreationSource.USER_REPORT_ENVELOPE,
) -> tuple[bool, str | None, str | None]:
    """
    Validates required fields, field lengths, and garbage messages. Also checks that event_id is a valid UUID. Does not raise errors.

    Reformatting: strips whitespace from comments and dashes from event_id.

    Returns a tuple of (should_filter, metrics_reason, display_reason). XXX: ensure metrics and outcome reasons have bounded cardinality.
    """
    if "comments" not in report:
        return True, "missing_comments", "Missing comments"  # type: ignore[unreachable]
    if "event_id" not in report:
        return True, "missing_event_id", "Missing event_id"  # type: ignore[unreachable]

    report["comments"] = report["comments"].strip()

    name, email, comments = (
        report.get("name", ""),
        report.get("email", ""),
        report["comments"],
    )

    if options.get("feedback.filter_garbage_messages"):  # Message-based filter kill-switch.
        if not comments:
            return True, "empty", "Empty Feedback Messsage"

        if comments == UNREAL_FEEDBACK_UNATTENDED_MESSAGE:
            return True, "unreal.unattended", "Sent in Unreal Unattended Mode"

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

    max_email_length = UserReport._meta.get_field("email").max_length
    if max_email_length and len(email) > max_email_length:
        return True, "too_large.email", "Email Too Large"

    try:
        # Validates UUID and strips dashes.
        report["event_id"] = uuid.UUID(report["event_id"].lower()).hex
    except ValueError:
        return True, "invalid_event_id", "Invalid Event ID"

    return False, None, None
