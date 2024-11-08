from __future__ import annotations

import logging
from datetime import timedelta

import sentry_sdk
from django.db import IntegrityError, router
from django.utils import timezone

from sentry import eventstore, options
from sentry.eventstore.models import Event, GroupEvent
from sentry.feedback.usecases.create_feedback import (
    UNREAL_FEEDBACK_UNATTENDED_MESSAGE,
    is_in_feedback_denylist,
    shim_to_feedback,
)
from sentry.models.userreport import UserReport
from sentry.signals import user_feedback_received
from sentry.utils import metrics
from sentry.utils.db import atomic_transaction
from sentry.utils.eventuser import EventUser

logger = logging.getLogger(__name__)


class Conflict(Exception):
    pass


def save_userreport(
    project,
    report,
    source,
    start_time=None,
):
    with metrics.timer("sentry.ingest.userreport.save_userreport"):
        if is_in_feedback_denylist(project.organization):
            metrics.incr("user_report.create_user_report.filtered", tags={"reason": "org.denylist"})
            return
        if should_filter_user_report(report["comments"]):
            return

        max_comment_length = UserReport._meta.get_field("comments").max_length
        if max_comment_length and len(report["comments"]) > max_comment_length:
            metrics.distribution(
                "feedback.large_message",
                len(report["comments"]),
                tags={
                    "entrypoint": "save_userreport",
                    "referrer": source.value,
                },
            )
            logger.info(
                "Feedback message exceeds max size.",
                extra={
                    "project_id": project.id,
                    "entrypoint": "save_userreport",
                    "referrer": source.value,
                },
            )
            # Sentry will capture `feedback_message` in local variables (truncated).
            sentry_sdk.capture_message("Feedback message exceeds max size.", "warning")
            report["comments"] = report["comments"][:max_comment_length]

        if start_time is None:
            start_time = timezone.now()

        # XXX(dcramer): enforce case insensitivity by coercing this to a lowercase string
        report["event_id"] = report["event_id"].lower()
        report["project_id"] = project.id

        event = eventstore.backend.get_event_by_id(project.id, report["event_id"])

        euser = find_event_user(event)

        if euser and not euser.name and report.get("name"):
            euser.name = report["name"]

        if event:
            # if the event is more than 30 minutes old, we don't allow updates
            # as it might be abusive
            if event.datetime < start_time - timedelta(minutes=30):
                raise Conflict("Feedback for this event cannot be modified.")

            report["environment_id"] = event.get_environment().id
            report["group_id"] = event.group_id

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
                raise Conflict("Feedback for this event cannot be modified.")

            existing_report.update(
                name=report.get("name", ""),
                email=report["email"],
                comments=report["comments"],
            )
            report_instance = existing_report

            metrics.incr("user_report.create_user_report.overwrite_duplicate")

        else:
            if report_instance.group_id:
                report_instance.notify()

        user_feedback_received.send(project=project, sender=save_userreport)

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
            tags={"has_event": bool(event)},
        )
        if event:
            logger.info(
                "ingest.user_report.shim_to_feedback",
                extra={"project_id": project.id, "event_id": report["event_id"]},
            )
            shim_to_feedback(report, event, project, source)

        return report_instance


def find_event_user(event: Event | GroupEvent | None) -> EventUser | None:
    if not event:
        return None
    return EventUser.from_event(event)


def should_filter_user_report(comments: str):
    """
    We don't care about empty user reports, or ones that
    the unreal SDKs send.
    """

    if not options.get("feedback.filter_garbage_messages"):
        return False

    if not comments:
        metrics.incr("user_report.create_user_report.filtered", tags={"reason": "empty"})
        return True

    if comments == UNREAL_FEEDBACK_UNATTENDED_MESSAGE:
        metrics.incr(
            "user_report.create_user_report.filtered", tags={"reason": "unreal.unattended"}
        )
        return True

    return False
