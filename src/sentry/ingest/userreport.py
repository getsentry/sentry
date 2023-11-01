from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any

from django.db import IntegrityError, router
from django.utils import timezone

from sentry import eventstore, features
from sentry.eventstore.models import Event
from sentry.feedback.usecases.create_feedback import create_feedback_issue
from sentry.models.eventuser import EventUser
from sentry.models.userreport import UserReport
from sentry.signals import user_feedback_received
from sentry.utils import metrics
from sentry.utils.db import atomic_transaction
from sentry.utils.safe import get_path

logger = logging.getLogger(__name__)


class Conflict(Exception):
    pass


def save_userreport(project, report, start_time=None):
    with metrics.timer("sentry.ingest.userreport.save_userreport"):
        if start_time is None:
            start_time = timezone.now()

        # XXX(dcramer): enforce case insensitivity by coercing this to a lowercase string
        report["event_id"] = report["event_id"].lower()
        report["project_id"] = project.id

        event = eventstore.backend.get_event_by_id(project.id, report["event_id"])

        # TODO(dcramer): we should probably create the user if they dont
        # exist, and ideally we'd also associate that with the event
        euser = find_event_user(event)

        if euser and not euser.name and report.get("name"):
            euser.update(name=report["name"])
        if euser:
            # TODO(nisanthan): Remove this eventually once UserReport model drops the event_user_id column
            report["event_user_id"] = None

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
                date_added=timezone.now(),
                event_user_id=euser.id if euser else None,
            )
            report_instance = existing_report

        else:
            if report_instance.group_id:
                report_instance.notify()

        user_feedback_received.send(project=project, sender=save_userreport)

        if features.has("organizations:user-feedback-ingest", project.organization, actor=None):
            _shim_to_feedback(report, event, project)

        return report_instance


def find_event_user(event: Event):
    if not event:
        return None

    return EventUser(
        project_id=event.project.id,
        email=event.data.get("user", {}).get("email"),
        username=event.data.get("user", {}).get("username"),
        name=event.data.get("user", {}).get("name"),
        ip_address=event.data.get("user", {}).get("ip_address"),
    )


def _shim_to_feedback(report, event, project):
    """
    takes user reports from the legacy user report endpoint and
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
