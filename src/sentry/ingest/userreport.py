from __future__ import annotations

import logging
from datetime import timedelta

from django.db import IntegrityError, router
from django.utils import timezone

from sentry import eventstore, features
from sentry.eventstore.models import Event
from sentry.feedback.usecases.create_feedback import shim_to_feedback
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
                date_added=timezone.now(),
            )
            report_instance = existing_report

        else:
            if report_instance.group_id:
                report_instance.notify()

        user_feedback_received.send(project=project, sender=save_userreport)

        if features.has("organizations:user-feedback-ingest", project.organization, actor=None):
            shim_to_feedback(report, event, project, source)

        return report_instance


def find_event_user(event: Event):
    if not event:
        return None
    eventuser = EventUser.from_event(event)
    return eventuser
