import logging
import time
from datetime import datetime, timedelta
from typing import TypedDict

import sentry_sdk
from django.conf import settings
from google.api_core.exceptions import DeadlineExceeded, ServiceUnavailable
from snuba_sdk import Column, Condition, Entity, Function, Op, Query, Request
from snuba_sdk.orderby import Direction, OrderBy

from sentry import features, nodestore
from sentry.api.endpoints.event_grouping_info import get_grouping_info
from sentry.api.endpoints.group_similar_issues_embeddings import get_stacktrace_string
from sentry.eventstore.models import Event
from sentry.issues.occurrence_consumer import EventLookupError
from sentry.models.group import Group
from sentry.models.project import Project
from sentry.seer.utils import (
    CreateGroupingRecordData,
    CreateGroupingRecordsRequest,
    post_bulk_grouping_records,
)
from sentry.silo.base import SiloMode
from sentry.snuba.dataset import Dataset
from sentry.snuba.referrer import Referrer
from sentry.tasks.base import instrumented_task
from sentry.utils import json, metrics, redis
from sentry.utils.iterators import chunked
from sentry.utils.query import RangeQuerySetWrapper
from sentry.utils.snuba import bulk_snuba_queries

ITERATOR_CHUNK = 20
BACKFILL_NAME = "backfill_grouping_records"
LAST_PROCESSED_REDIS_KEY = "grouping_record_backfill.last_processed_id"

logger = logging.getLogger(__name__)

"""
from sentry.tasks.backfill_seer_grouping_records import backfill_seer_grouping_records
"""


class GroupEventRow(TypedDict):
    event_id: str
    group_id: int
    message: str


class GroupStacktraceData(TypedDict):
    data: list[CreateGroupingRecordData]
    stacktrace_list: list[str]


@instrumented_task(
    name="sentry.tasks.backfill_seer_grouping_records",
    queue="default",
    max_retries=0,
    silo_mode=SiloMode.REGION,
)
def backfill_seer_grouping_records(project: Project) -> int:
    num_groups_records_created = 0
    if not features.has("projects:similarity-embeddings-grouping", project):
        return num_groups_records_created

    project_id, organization_id = project.id, project.organization.id
    time = datetime.now()
    events_entity = Entity("events", alias="events")
    redis_client = redis.redis_clusters.get(settings.SENTRY_MONITORS_REDIS_CLUSTER)
    last_processed_id = int(redis_client.get(LAST_PROCESSED_REDIS_KEY) or 0)
    for group_id_batch in chunked(
        RangeQuerySetWrapper(
            Group.objects.filter(
                project_id=project_id, id__gt=last_processed_id, type=1
            ).values_list("id", flat=True),
            result_value_getter=lambda item: item,
        ),
        ITERATOR_CHUNK,
    ):
        query = Query(
            match=events_entity,
            select=[
                Column("group_id"),
                Function("max", [Column("event_id")], "event_id"),
                Column("message"),
            ],
            groupby=[Column("group_id"), Column("message")],
            where=[
                Condition(Column("project_id"), Op.EQ, project_id),
                Condition(Column("group_id"), Op.IN, group_id_batch),
                Condition(
                    Column("timestamp", entity=events_entity), Op.GTE, time - timedelta(days=90)
                ),
                Condition(Column("timestamp", entity=events_entity), Op.LT, time),
            ],
            orderby=[OrderBy(Column("group_id"), Direction.ASC)],
        )

        request = Request(
            dataset=Dataset.Events.value,
            app_id=Referrer.GROUPING_RECORDS_BACKFILL_REFERRER.value,
            query=query,
            tenant_ids={
                "referrer": Referrer.GROUPING_RECORDS_BACKFILL_REFERRER.value,
                "organization_id": organization_id,
            },
        )
        result = bulk_snuba_queries(
            [request], referrer=Referrer.GROUPING_RECORDS_BACKFILL_REFERRER.value
        )

        if result and result[0].get("data"):
            rows: list[GroupEventRow] = result[0]["data"]
            data = lookup_group_data_stacktrace_bulk_with_fallback(project, rows)
            response = post_bulk_grouping_records(
                CreateGroupingRecordsRequest(
                    group_id_list=group_id_batch,
                    data=data["data"],
                    stacktrace_list=data["stacktrace_list"],
                )
            )
            if response["success"]:
                redis_client.set(
                    f"{LAST_PROCESSED_REDIS_KEY}", group_id_batch[-1], ex=60 * 60 * 24 * 7
                )
                groups = Group.objects.filter(id__in=group_id_batch)
                for group in groups:
                    if group.data.get("metadata"):
                        group.data["metadata"].update({"has_embeddings_record_v1": True})
                    else:
                        group.data["metadata"] = {"has_embeddings_record_v1": True}
                num_groups_records_created += Group.objects.bulk_update(groups, ["data"])

    return num_groups_records_created


def lookup_group_data_stacktrace_bulk_with_fallback(
    project: Project,
    rows: list[GroupEventRow],
) -> GroupStacktraceData:
    bulk_event_ids, bulk_group_data_stacktraces = lookup_group_data_stacktrace_bulk(project, rows)
    for row in rows:
        event_id, group_id, message = row["event_id"], row["group_id"], row["message"]
        if event_id not in bulk_event_ids:
            try:
                group_data, stacktrace_string = lookup_group_data_stacktrace_single(
                    project, event_id, int(group_id), message
                )
                if group_data and stacktrace_string:
                    bulk_group_data_stacktraces["data"].append(group_data)
                    bulk_group_data_stacktraces["stacktrace_list"].append(stacktrace_string)
            except EventLookupError:
                extra = {
                    "organization_id": project.organization.id,
                    "project_id": project.id,
                    "group_id": group_id,
                    "event_id": event_id,
                }
                logger.info("tasks.backfill_seer_grouping_records.event_lookup_error", extra=extra)
                continue

    return bulk_group_data_stacktraces


def lookup_group_data_stacktrace_bulk(
    project: Project, rows: list[GroupEventRow]
) -> tuple[set[str], GroupStacktraceData]:
    with metrics.timer(f"{BACKFILL_NAME}._lookup_event_bulk", sample_rate=1.0):
        project_id = project.id
        node_id_to_group_data = {
            Event.generate_node_id(project_id, event_id=row["event_id"]): (
                row["event_id"],
                row["group_id"],
                row["message"],
            )
            for row in rows
        }

        try:
            bulk_data = nodestore.backend.get_multi(list(node_id_to_group_data.keys()))
        except (ServiceUnavailable, DeadlineExceeded):
            time.sleep(2)
            try:
                bulk_data = nodestore.backend.get_multi(list(node_id_to_group_data.keys()))
            except (ServiceUnavailable, DeadlineExceeded):
                time.sleep(4)
                try:
                    bulk_data = nodestore.backend.get_multi(list(node_id_to_group_data.keys()))
                except (ServiceUnavailable, DeadlineExceeded) as e:
                    bulk_data = {}
                    extra = {
                        "organization_id": project.organization.id,
                        "project_id": project.id,
                        "group_data": json.dumps(rows),
                        "error": e.message,
                    }
                    logger.info(
                        "tasks.backfill_seer_grouping_records.bulk_event_lookup_exception",
                        extra=extra,
                    )

        group_data = []
        stacktrace_strings = []
        bulk_event_ids = set()
        with sentry_sdk.start_transaction(op="embeddings_grouping.get_latest_event"):
            for node_id, data in bulk_data.items():
                if node_id in node_id_to_group_data:
                    event_id, group_id, message = (
                        node_id_to_group_data[node_id][0],
                        node_id_to_group_data[node_id][1],
                        node_id_to_group_data[node_id][2],
                    )
                    event = Event(event_id=event_id, project_id=project_id, group_id=group_id)
                    event.data = data
                    if (
                        event.data
                        and event.data.get("exception")
                        and event.group
                        and not (
                            event.group.data.get("metadata")
                            and event.group.data["metadata"].get("has_embeddings_record_v1")
                        )
                    ):
                        grouping_info = get_grouping_info(
                            None, project=project, event_id=event.event_id, event=event
                        )
                        stacktrace_string = get_stacktrace_string(grouping_info)
                        if stacktrace_string == "":
                            continue
                        group_data.append(
                            CreateGroupingRecordData(
                                group_id=group_id, project_id=project_id, message=message
                            )
                        )
                        stacktrace_strings.append(stacktrace_string)
                        bulk_event_ids.add(event_id)

        metrics.gauge(
            f"{BACKFILL_NAME}._lookup_event_bulk.hit_ratio",
            round(len(bulk_data.items()) / len(rows)) * 100,
            sample_rate=1.0,
        )

        return (
            bulk_event_ids,
            GroupStacktraceData(data=group_data, stacktrace_list=stacktrace_strings),
        )


def lookup_group_data_stacktrace_single(
    project: Project, event_id: str, group_id: int, message: str
) -> tuple[CreateGroupingRecordData | None, str]:
    with metrics.timer(f"{BACKFILL_NAME}._lookup_event_single", sample_rate=1.0):
        project_id = project.id
        try:
            event = lookup_event(project_id=project_id, event_id=event_id, group_id=group_id)
        except (ServiceUnavailable, DeadlineExceeded):
            time.sleep(2)
            try:
                event = lookup_event(project_id=project_id, event_id=event_id, group_id=group_id)
            except (ServiceUnavailable, DeadlineExceeded):
                time.sleep(4)
                try:
                    event = lookup_event(
                        project_id=project_id, event_id=event_id, group_id=group_id
                    )
                except (ServiceUnavailable, DeadlineExceeded) as e:
                    event = None
                    extra = {
                        "organization_id": project.organization.id,
                        "project_id": project.id,
                        "group_id": group_id,
                        "event_id": event_id,
                        "error": e.message,
                    }
                    logger.info(
                        "tasks.backfill_seer_grouping_records.event_lookup_exception", extra=extra
                    )

        if (
            event
            and event.data
            and event.data.get("exception")
            and event.group
            and not (
                event.group.data.get("metadata")
                and event.group.data["metadata"].get("has_embeddings_record_v1")
            )
        ):
            with sentry_sdk.start_transaction(op="embeddings_grouping.get_latest_event"):
                grouping_info = get_grouping_info(
                    None, project=project, event_id=event.event_id, event=event
                )
            stacktrace_string = get_stacktrace_string(grouping_info)
            group_data = (
                CreateGroupingRecordData(group_id=group_id, project_id=project_id, message=message)
                if stacktrace_string != ""
                else None
            )

            return (group_data, stacktrace_string)

        return (None, "")


def lookup_event(project_id: int, event_id: str, group_id: int) -> Event:
    data = nodestore.backend.get(Event.generate_node_id(project_id, event_id))
    if data is None:
        raise EventLookupError(f"Failed to lookup event({event_id}) for project_id({project_id})")
    event = Event(event_id=event_id, project_id=project_id, group_id=group_id)
    event.data = data
    return event
