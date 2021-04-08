from datetime import timedelta

from django.db import IntegrityError, transaction
from django.utils import timezone

from sentry import eventstore
from sentry.models import EventUser, UserReport
from sentry.signals import user_feedback_received


class Conflict(Exception):
    pass


def save_userreport(project, report, start_time=None):
    if start_time is None:
        start_time = timezone.now()

    # XXX(dcramer): enforce case insensitivity by coercing this to a lowercase string
    report["event_id"] = report["event_id"].lower()
    report["project_id"] = project.id

    event = eventstore.get_event_by_id(project.id, report["event_id"])

    # TODO(dcramer): we should probably create the user if they dont
    # exist, and ideally we'd also associate that with the event
    euser = find_event_user(report, event)

    if euser and not euser.name and report.get("name"):
        euser.update(name=report["name"])
    if euser:
        report["event_user_id"] = euser.id

    if event:
        # if the event is more than 30 minutes old, we dont allow updates
        # as it might be abusive
        if event.datetime < start_time - timedelta(minutes=30):
            raise Conflict("Feedback for this event cannot be modified.")

        report["environment_id"] = event.get_environment().id
        report["group_id"] = event.group_id

    try:
        with transaction.atomic():
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

    return report_instance


def find_event_user(report_data, event):
    if not event:
        if not report_data.get("email"):
            return None
        try:
            return EventUser.objects.filter(
                project_id=report_data["project_id"], email=report_data["email"]
            )[0]
        except IndexError:
            return None

    tag = event.get_tag("sentry:user")
    if not tag:
        return None

    try:
        return EventUser.for_tags(project_id=report_data["project_id"], values=[tag])[tag]
    except KeyError:
        pass
