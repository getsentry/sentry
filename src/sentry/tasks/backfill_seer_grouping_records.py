import logging
import time
from datetime import datetime, timedelta
from typing import Any, TypedDict

import sentry_sdk
from django.conf import settings
from google.api_core.exceptions import DeadlineExceeded, ServiceUnavailable
from snuba_sdk import Column, Condition, Entity, Function, Op, Query, Request
from snuba_sdk.orderby import Direction, OrderBy

from sentry import features, nodestore
from sentry.api.endpoints.group_similar_issues_embeddings import get_stacktrace_string
from sentry.eventstore.models import Event
from sentry.grouping.grouping_info import get_grouping_info
from sentry.issues.grouptype import ErrorGroupType
from sentry.issues.occurrence_consumer import EventLookupError
from sentry.models.group import Group
from sentry.models.grouphash import GroupHash
from sentry.models.project import Project
from sentry.seer.utils import (
    CreateGroupingRecordData,
    CreateGroupingRecordsRequest,
    delete_grouping_records,
    post_bulk_grouping_records,
)
from sentry.silo.base import SiloMode
from sentry.snuba.dataset import Dataset
from sentry.snuba.referrer import Referrer
from sentry.tasks.base import instrumented_task
from sentry.utils import json, metrics, redis
from sentry.utils.safe import get_path
from sentry.utils.snuba import bulk_snuba_queries

BATCH_SIZE = 20
BACKFILL_NAME = "backfill_grouping_records"
LAST_PROCESSED_REDIS_KEY = "grouping_record_backfill.last_processed_id"

logger = logging.getLogger(__name__)


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
    soft_time_limit=60 * 15,
    time_limit=60 * 15 + 5,
)
@metrics.wraps(f"{BACKFILL_NAME}.task")
def backfill_seer_grouping_records(
    project_id: int, last_processed_id: int | None, dry_run: bool = False, *args: Any, **kwargs: Any
) -> None:
    """
    Task to backfill seer grouping_records table.
    Pass in last_processed_id = 0 if running project for the first time, else None
    """
    logger.info(
        "backfill_seer_grouping_records.start",
        extra={
            "project_id": project_id,
            "last_processed_id": last_processed_id,
            "dry_run": dry_run,
        },
    )
    project = Project.objects.get_from_cache(id=project_id)
    if not features.has("projects:similarity-embeddings-backfill", project):
        return

    redis_client = redis.redis_clusters.get(settings.SENTRY_MONITORS_REDIS_CLUSTER)
    if last_processed_id is None:
        last_processed_id = int(redis_client.get(LAST_PROCESSED_REDIS_KEY) or 0)
        if last_processed_id == 0 and dry_run:
            delete_grouping_records(project_id)

    group_id_message_data_batch = (
        Group.objects.filter(
            project_id=project.id, id__gt=last_processed_id, type=ErrorGroupType.type_id
        )
        .values_list("id", "message", "data")
        .order_by("id")[:BATCH_SIZE]
    )
    if len(group_id_message_data_batch) == 0:
        return

    group_id_message_batch = {
        group_id: message
        for (group_id, message, data) in group_id_message_data_batch
        if not get_path(data, "metadata", "embeddings_info", "nn_model_version")
    }

    group_id_batch = list(group_id_message_batch.keys())
    time_now = datetime.now()
    events_entity = Entity("events", alias="events")
    redis_client = redis.redis_clusters.get(settings.SENTRY_MONITORS_REDIS_CLUSTER)

    query = Query(
        match=events_entity,
        select=[
            Column("group_id"),
            Function("max", [Column("event_id")], "event_id"),
        ],
        groupby=[Column("group_id")],
        where=[
            Condition(Column("project_id"), Op.EQ, project.id),
            Condition(Column("group_id"), Op.IN, group_id_batch),
            Condition(
                Column("timestamp", entity=events_entity), Op.GTE, time_now - timedelta(days=90)
            ),
            Condition(Column("timestamp", entity=events_entity), Op.LT, time_now),
        ],
        orderby=[OrderBy(Column("group_id"), Direction.ASC)],
    )

    request = Request(
        dataset=Dataset.Events.value,
        app_id=Referrer.GROUPING_RECORDS_BACKFILL_REFERRER.value,
        query=query,
        tenant_ids={
            "referrer": Referrer.GROUPING_RECORDS_BACKFILL_REFERRER.value,
            "cross_org_query": 1,
        },
    )

    with metrics.timer(f"{BACKFILL_NAME}.bulk_snuba_queries", sample_rate=1.0):
        result = bulk_snuba_queries(
            [request], referrer=Referrer.GROUPING_RECORDS_BACKFILL_REFERRER.value
        )

    if result and result[0].get("data"):
        rows: list[GroupEventRow] = result[0]["data"]
        group_hashes = GroupHash.objects.filter(
            project_id=project.id, group_id__in=group_id_batch
        ).distinct("group_id")
        group_hashes_dict = {group_hash.group_id: group_hash.hash for group_hash in group_hashes}
        data = lookup_group_data_stacktrace_bulk_with_fallback(
            project, rows, group_id_message_batch, group_hashes_dict
        )

        with metrics.timer(f"{BACKFILL_NAME}.post_bulk_grouping_records", sample_rate=1.0):
            response = post_bulk_grouping_records(
                CreateGroupingRecordsRequest(
                    group_id_list=group_id_batch,
                    data=data["data"],
                    stacktrace_list=data["stacktrace_list"],
                )
            )
        if response["success"]:
            groups = Group.objects.filter(project_id=project.id, id__in=group_id_batch)
            for group in groups:
                if group.data.get("metadata"):
                    group.data["metadata"]["embeddings_info"] = {
                        "nn_model_version": 0,
                        "group_hash": json.dumps([group_hashes_dict[group.id]]),
                    }
                else:
                    group.data["metadata"] = {
                        "embeddings_info": {
                            "nn_model_version": 0,
                            "group_hash": json.dumps([group_hashes_dict[group.id]]),
                        }
                    }
            if not dry_run:
                Group.objects.bulk_update(groups, ["data"])

        last_processed_id = group_id_message_data_batch[len(group_id_message_data_batch) - 1][0]
        redis_client.set(
            f"{LAST_PROCESSED_REDIS_KEY}",
            last_processed_id if last_processed_id is not None else 0,
            ex=60 * 60 * 24 * 7,
        )  # needed for typing
        backfill_seer_grouping_records.apply_async(
            args=[project.id, last_processed_id, dry_run],
        )
        return


def lookup_group_data_stacktrace_bulk_with_fallback(
    project: Project, rows: list[GroupEventRow], messages: dict[int, str], hashes: dict[int, str]
) -> GroupStacktraceData:
    (
        bulk_event_ids,
        invalid_event_ids,
        bulk_group_data_stacktraces,
    ) = lookup_group_data_stacktrace_bulk(project, rows, messages, hashes)
    for row in rows:
        event_id, group_id = row["event_id"], row["group_id"]
        if event_id not in bulk_event_ids and event_id not in invalid_event_ids:
            try:
                group_data, stacktrace_string = lookup_group_data_stacktrace_single(
                    project, event_id, int(group_id), messages[group_id], hashes[group_id]
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
                logger.exception(
                    "tasks.backfill_seer_grouping_records.event_lookup_error", extra=extra
                )
                continue
            except KeyError:
                extra = {
                    "organization_id": project.organization.id,
                    "project_id": project.id,
                    "group_id": group_id,
                }
                logger.exception("tasks.backfill_seer_grouping_records.no_group_hash", extra=extra)
                continue

    return bulk_group_data_stacktraces


@metrics.wraps(f"{BACKFILL_NAME}.lookup_event_bulk", sample_rate=1.0)
def lookup_group_data_stacktrace_bulk(
    project: Project, rows: list[GroupEventRow], messages: dict[int, str], hashes: dict[int, str]
) -> tuple[set[str], set[str], GroupStacktraceData]:
    project_id = project.id
    node_id_to_group_data = {
        Event.generate_node_id(project_id, event_id=row["event_id"]): (
            row["event_id"],
            row["group_id"],
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
                logger.exception(
                    "tasks.backfill_seer_grouping_records.bulk_event_lookup_exception",
                    extra=extra,
                )

    group_data = []
    stacktrace_strings = []
    bulk_event_ids = set()
    invalid_event_ids = set()
    with sentry_sdk.start_transaction(op="embeddings_grouping.get_latest_event"):
        for node_id, data in bulk_data.items():
            if node_id in node_id_to_group_data:
                event_id, group_id = (
                    node_id_to_group_data[node_id][0],
                    node_id_to_group_data[node_id][1],
                )
                event = Event(event_id=event_id, project_id=project_id, group_id=group_id)
                event.data = data
                if event and event.data and event.data.get("exception") and hashes.get(group_id):
                    grouping_info = get_grouping_info(None, project=project, event=event)
                    stacktrace_string = get_stacktrace_string(grouping_info)
                    if stacktrace_string == "":
                        invalid_event_ids.add(event_id)
                        continue
                    group_data.append(
                        CreateGroupingRecordData(
                            project_id=project_id,
                            message=messages[group_id],
                            hash=hashes[group_id],
                        )
                    )
                    stacktrace_strings.append(stacktrace_string)
                    bulk_event_ids.add(event_id)
                else:
                    invalid_event_ids.add(event_id)

    metrics.gauge(
        f"{BACKFILL_NAME}._lookup_event_bulk.hit_ratio",
        round(len(bulk_data.items()) / len(rows)) * 100,
        sample_rate=1.0,
    )

    return (
        bulk_event_ids,
        invalid_event_ids,
        GroupStacktraceData(data=group_data, stacktrace_list=stacktrace_strings),
    )


@metrics.wraps(f"{BACKFILL_NAME}.lookup_event_single")
def lookup_group_data_stacktrace_single(
    project: Project, event_id: str, group_id: int, message: str, hash: str
) -> tuple[CreateGroupingRecordData | None, str]:
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
                event = lookup_event(project_id=project_id, event_id=event_id, group_id=group_id)
            except (ServiceUnavailable, DeadlineExceeded) as e:
                event = None
                extra = {
                    "organization_id": project.organization.id,
                    "project_id": project.id,
                    "group_id": group_id,
                    "event_id": event_id,
                    "error": e.message,
                }
                logger.exception(
                    "tasks.backfill_seer_grouping_records.event_lookup_exception", extra=extra
                )

    if event and event.data and event.data.get("exception"):
        with sentry_sdk.start_transaction(op="embeddings_grouping.get_latest_event"):
            grouping_info = get_grouping_info(None, project=project, event=event)
        stacktrace_string = get_stacktrace_string(grouping_info)
        group_data = (
            CreateGroupingRecordData(hash=hash, project_id=project_id, message=message)
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
