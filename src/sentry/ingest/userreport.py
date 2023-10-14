import logging
from datetime import datetime, timedelta
from typing import Any, Mapping, Tuple

from django.db import IntegrityError, router
from django.utils import timezone
from snuba_sdk import Column, Condition, Entity, Op, Query, Request

from sentry import eventstore, features
from sentry.api.serializers import serialize
from sentry.eventstore.models import Event
from sentry.models.eventuser import EventUser
from sentry.models.userreport import UserReport
from sentry.signals import user_feedback_received
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.utils import metrics
from sentry.utils.db import atomic_transaction
from sentry.utils.snuba import raw_snql_query

logger = logging.getLogger(__name__)

REFERRER = "sentry.ingest.userreport"


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
        euser = find_event_user(report, event)

        if features.has("organizations:eventuser-from-snuba", project.organization):
            try:
                find_event_user_with_snuba(event, euser)
            except Exception as e:
                logger.exception(e)

        if euser and not euser.name and report.get("name"):
            euser.update(name=report["name"])
        if euser:
            report["event_user_id"] = euser.id

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


def find_event_user_with_snuba(event: Event, eventuser: EventUser):
    """
    Query Snuba to get the EventUser information for an Event.
    Then compare with the EventUser record and confirm that the
    query result is equivalent.
    """
    start_date, end_date = _start_and_end_dates(event.datetime)

    query = _generate_entity_dataset_query(
        event.project_id, event.group_id, event.event_id, start_date, end_date
    )
    request = Request(
        dataset=Dataset.Events.value,
        app_id=REFERRER,
        query=query,
        tenant_ids={"referrer": REFERRER, "organization_id": event.project.organization.id},
    )
    data_results = raw_snql_query(request, referrer=REFERRER)["data"]

    if len(data_results) == 0:
        return logger.info(
            "Errors dataset query to find EventUser did not return any results.",
            extra={
                "eventuser": serialize(eventuser),
                "event_id": event.event_id,
                "project_id": event.project_id,
                "group_id": event.group_id,
            },
        )

    if not _is_equal_to_eventuser(eventuser, data_results[0]):
        return logger.info(
            "EventUser not the same as Errors dataset query.",
            extra={
                "eventuser": serialize(eventuser),
                "dataset_results": data_results[0],
                "event_id": event.event_id,
                "project_id": event.project_id,
                "group_id": event.group_id,
            },
        )

    else:
        return logger.info(
            "EventUser equal to results from Errors dataset query.",
            extra={
                "event_id": event.event_id,
                "project_id": event.project_id,
                "group_id": event.group_id,
            },
        )


def _is_equal_to_eventuser(eventuser: EventUser, snuba_result: Mapping[str, Any]):
    EVENTUSER_TO_SNUBA_KEY_MAP = {
        "project_id": ["project_id"],
        "ident": ["user_id"],
        "email": ["user_email"],
        "username": ["user_name"],
        "ip_address": ["ip_address_v6", "ip_address_v4"],
    }
    for eventuser_key, snuba_result_keys in EVENTUSER_TO_SNUBA_KEY_MAP.items():
        if getattr(eventuser, eventuser_key) not in [
            snuba_result[key] for key in snuba_result_keys
        ]:
            return False

    return True


def _generate_entity_dataset_query(
    project_id: int,
    group_id: int,
    event_id: str,
    start_date: datetime,
    end_date: datetime,
) -> Query:

    """This simply generates a query based on the passed parameters"""

    return Query(
        match=Entity(EntityKey.Events.value),
        select=[
            Column("project_id"),
            Column("group_id"),
            Column("ip_address_v6"),
            Column("ip_address_v4"),
            Column("event_id"),
            Column("user_id"),
            Column("user"),
            Column("user_name"),
            Column("user_email"),
        ],
        where=[
            Condition(Column("project_id"), Op.EQ, project_id),
            Condition(Column("group_id"), Op.EQ, group_id),
            Condition(Column("event_id"), Op.EQ, event_id),
            Condition(Column("timestamp"), Op.GTE, start_date),
            Condition(Column("timestamp"), Op.LT, end_date),
        ],
    )


def _start_and_end_dates(time: datetime) -> Tuple[datetime, datetime]:
    """Return the 10 min range start and end time range ."""
    return time - timedelta(minutes=5), time + timedelta(minutes=5)
