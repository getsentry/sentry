from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any, Mapping, Optional, Tuple

from django.db import IntegrityError, router
from django.utils import timezone
from snuba_sdk import Column, Condition, Entity, Op, Query, Request

from sentry import analytics, eventstore, features
from sentry.api.serializers import serialize
from sentry.eventstore.models import Event
from sentry.feedback.usecases.create_feedback import create_feedback_issue
from sentry.models.eventuser import EventUser
from sentry.models.userreport import UserReport
from sentry.signals import user_feedback_received
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.utils import metrics
from sentry.utils.db import atomic_transaction
from sentry.utils.safe import get_path
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

        if features.has("organizations:eventuser-from-snuba", project.organization) and event:
            try:
                find_and_compare_eventuser_data(event, euser)
            except Exception:
                logger.exception(
                    "Error when attempting to compare EventUser with Snuba results & Event data"
                )

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

        if features.has("organizations:user-feedback-ingest", project.organization, actor=None):
            _shim_to_feedback(report, event, project)

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


def find_and_compare_eventuser_data(event: Event, eventuser: EventUser):
    """
    Compare the EventUser record, the query results from Snuba and
    the Event data property with each other.
    Log the results of the comparisons.
    """
    try:
        snuba_eventuser = find_eventuser_with_snuba(event)
    except Exception:
        return logger.exception("Error when attempting to fetch EventUser data from Snuba")

    # Compare Snuba result with EventUser record
    snuba_eventuser_equality = _is_snuba_result_equal_to_eventuser(snuba_eventuser, eventuser)
    # Compare Event data result with EventUser record
    event_eventuser_equality = _is_event_data_equal_to_eventuser(event, eventuser)
    # Compare Snuba result with Event data
    snuba_event_equality = _is_event_data_equal_to_snuba_result(event, snuba_eventuser)

    logger.info(
        "EventUser equality checks with Snuba and Event.",
        extra={
            "eventuser": serialize(eventuser),
            "dataset_results": snuba_eventuser,
            "event_id": event.event_id,
            "project_id": event.project_id,
            "group_id": event.group_id,
            "event.data.user": event.data.get("user", {}),
            "snuba_eventuser_equality": snuba_eventuser_equality,
            "event_eventuser_equality": event_eventuser_equality,
            "snuba_event_equality": snuba_event_equality,
        },
    )

    analytics.record(
        "eventuser_equality.check",
        event_id=event.event_id,
        project_id=event.project_id,
        group_id=event.group_id,
        snuba_eventuser_equality=snuba_eventuser_equality,
        event_eventuser_equality=event_eventuser_equality,
        snuba_event_equality=snuba_event_equality,
    )


def find_eventuser_with_snuba(event: Event):
    """
    Query Snuba to get the EventUser information for an Event.
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
        logger.info(
            "Errors dataset query to find EventUser did not return any results.",
            extra={
                "event_id": event.event_id,
                "project_id": event.project_id,
                "group_id": event.group_id,
            },
        )
        return {}

    return data_results[0]


def _is_snuba_result_equal_to_eventuser(snuba_result: Mapping[str, Any], eventuser: EventUser):
    EVENTUSER_TO_SNUBA_KEY_MAP = {
        "project_id": ["project_id"],
        "ident": ["user_id"],
        "email": ["user_email"],
        "username": ["user_name"],
        "ip_address": ["ip_address_v6", "ip_address_v4"],
    }

    for eventuser_key, snuba_result_keys in EVENTUSER_TO_SNUBA_KEY_MAP.items():
        value = getattr(eventuser, eventuser_key) if eventuser is not None else None
        if value not in [snuba_result[key] for key in snuba_result_keys]:
            return False

    return True


def get_nested_value(d, value):
    """
    Return the value from a nested object of a path in dot notation.
    """
    for key in value.split("."):
        d = d.get(key, None)

    return d


def _is_event_data_equal_to_eventuser(event: Event, eventuser: EventUser):
    EVENTUSER_TO_EVENT_DATA_KEY_MAP = {
        "ident": ["user.id"],
        "email": ["user.email"],
        "username": ["user.username"],
        "ip_address": ["user.ip_address"],
    }
    for eventuser_key, event_data_keys in EVENTUSER_TO_EVENT_DATA_KEY_MAP.items():
        value = getattr(eventuser, eventuser_key) if eventuser is not None else None
        if value not in [get_nested_value(event.data, key) for key in event_data_keys]:
            return False

    return True


def _is_event_data_equal_to_snuba_result(event: Event, snuba_result: Mapping[str, Any]):
    EVENT_DATA_TO_SNUBA_KEY_MAP = {
        "user.id": ["user_id"],
        "user.email": ["user_email"],
        "user.username": ["user_name"],
        "user.ip_address": ["ip_address_v6", "ip_address_v4"],
    }

    for event_data_key, snuba_result_keys in EVENT_DATA_TO_SNUBA_KEY_MAP.items():
        if get_nested_value(event.data, event_data_key) not in [
            snuba_result[key] for key in snuba_result_keys
        ]:
            return False

    return True


def _generate_entity_dataset_query(
    project_id: Optional[int],
    group_id: Optional[int],
    event_id: str,
    start_date: datetime,
    end_date: datetime,
) -> Query:

    """This simply generates a query based on the passed parameters"""
    where_conditions = [
        Condition(Column("event_id"), Op.EQ, event_id),
        Condition(Column("timestamp"), Op.GTE, start_date),
        Condition(Column("timestamp"), Op.LT, end_date),
    ]
    if project_id:
        where_conditions.append(Condition(Column("project_id"), Op.EQ, project_id))

    if group_id:
        where_conditions.append(Condition(Column("group_id"), Op.EQ, group_id))

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
        where=where_conditions,
    )


def _start_and_end_dates(time: datetime) -> Tuple[datetime, datetime]:
    """Return the 10 min range start and end time range ."""
    return time - timedelta(minutes=5), time + timedelta(minutes=5)


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
                "email": report["email"],
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
