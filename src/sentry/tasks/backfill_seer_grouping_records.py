import copy
import logging
import time
from dataclasses import asdict
from datetime import UTC, datetime, timedelta
from typing import Any, TypedDict

import sentry_sdk
from django.conf import settings
from google.api_core.exceptions import DeadlineExceeded, ServiceUnavailable
from redis.client import StrictRedis
from rediscluster import RedisCluster
from snuba_sdk import Column, Condition, Entity, Limit, Op, Query, Request

from sentry import features, nodestore, options
from sentry.conf.server import SEER_SIMILARITY_MODEL_VERSION
from sentry.eventstore.models import Event
from sentry.grouping.grouping_info import get_grouping_info
from sentry.issues.grouptype import ErrorGroupType
from sentry.issues.occurrence_consumer import EventLookupError
from sentry.models.group import Group, GroupStatus
from sentry.models.grouphash import GroupHash
from sentry.models.project import Project
from sentry.seer.similarity.backfill import (
    CreateGroupingRecordData,
    CreateGroupingRecordsRequest,
    delete_grouping_records,
    post_bulk_grouping_records,
)
from sentry.seer.similarity.types import (
    IncompleteSeerDataError,
    SeerSimilarIssueData,
    SimilarGroupNotFoundError,
)
from sentry.seer.similarity.utils import get_stacktrace_string
from sentry.silo.base import SiloMode
from sentry.snuba.dataset import Dataset
from sentry.snuba.referrer import Referrer
from sentry.tasks.base import instrumented_task
from sentry.utils import json, metrics, redis
from sentry.utils.iterators import chunked
from sentry.utils.query import RangeQuerySetWrapper
from sentry.utils.safe import get_path
from sentry.utils.snuba import bulk_snuba_queries

BACKFILL_NAME = "backfill_grouping_records"
BULK_DELETE_METADATA_CHUNK_SIZE = 100

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
def backfill_seer_grouping_records(
    project_id: int,
    last_processed_index: int | None,
    dry_run: bool = False,
    only_delete=False,
    *args: Any,
    **kwargs: Any,
) -> None:
    """
    Task to backfill seer grouping_records table.
    Pass in last_processed_index = None if calling for the first time. This function will spawn
    child tasks that will pass the last_processed_index
    """
    logger.info(
        "backfill_seer_grouping_records.start",
        extra={
            "project_id": project_id,
            "last_processed_index": last_processed_index,
            "dry_run": dry_run,
        },
    )
    project = Project.objects.get_from_cache(id=project_id)
    if not features.has("projects:similarity-embeddings-backfill", project):
        logger.info(
            "backfill_seer_grouping_records.no_feature",
            extra={"project_id": project.id},
        )
        return

    redis_client = redis.redis_clusters.get(settings.SENTRY_MONITORS_REDIS_CLUSTER)

    if last_processed_index is None:
        last_processed_index = int(redis_client.get(make_backfill_redis_key(project_id)) or 0)

    if only_delete:
        delete_seer_grouping_records(project.id, redis_client)
        logger.info(
            "backfill_seer_grouping_records.deleted_all_records",
            extra={"project_id": project.id},
        )
        return

    group_id_message_data = (
        Group.objects.filter(
            project_id=project.id,
            type=ErrorGroupType.type_id,
            times_seen__gt=1,
            last_seen__gt=(datetime.now(UTC) - timedelta(days=90)),
        )
        .exclude(status__in=[GroupStatus.PENDING_DELETION, GroupStatus.DELETION_IN_PROGRESS])
        .values_list("id", "message", "data")
        .order_by("-times_seen", "id")
    )

    batch_size = options.get("embeddings-grouping.seer.backfill-batch-size")
    batch_end_index = min(last_processed_index + batch_size, len(group_id_message_data))
    group_id_message_data_batch = group_id_message_data[last_processed_index:batch_end_index]

    logger.info(
        "backfill_seer_grouping_records.batch",
        extra={
            "project_id": project.id,
            "batch_len": len(group_id_message_data_batch),
            "last_processed_index": last_processed_index,
            "total_groups_length": len(group_id_message_data),
        },
    )

    if len(group_id_message_data_batch) == 0:
        logger.info(
            "backfill_seer_grouping_records.no_more_groups",
            extra={"project_id": project.id},
        )
        return

    group_id_message_batch_filtered = {
        group_id: message
        for (group_id, message, data) in group_id_message_data_batch
        if get_path(data, "metadata", "seer_similarity", "similarity_model_version") is None
    }
    if len(group_id_message_data_batch) != len(group_id_message_batch_filtered):
        logger.info(
            "backfill_seer_grouping_records.groups_already_had_embedding",
            extra={"project_id": project.id, "num_groups": len(group_id_message_batch_filtered)},
        )

    group_id_batch = list(group_id_message_batch_filtered.keys())
    events_entity = Entity("events", alias="events")
    redis_client = redis.redis_clusters.get(settings.SENTRY_MONITORS_REDIS_CLUSTER)

    # TODO(jangjodi): Only query per group if it has over 1 million events, or batch queries with new where condition
    snuba_requests = []
    for group_id in group_id_batch:
        group = Group.objects.get(id=group_id)
        query = Query(
            match=events_entity,
            select=[
                Column("group_id"),
                Column("event_id"),
            ],
            where=[
                Condition(Column("project_id"), Op.EQ, project.id),
                Condition(Column("group_id"), Op.EQ, group_id),
                Condition(
                    Column("timestamp", entity=events_entity),
                    Op.GTE,
                    group.last_seen - timedelta(minutes=5),
                ),
                Condition(
                    Column("timestamp", entity=events_entity),
                    Op.LT,
                    group.last_seen + timedelta(minutes=5),
                ),
            ],
            limit=Limit(1),
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
        snuba_requests.append(request)

    with metrics.timer(f"{BACKFILL_NAME}.bulk_snuba_queries", sample_rate=1.0):
        snuba_results = bulk_snuba_queries(
            snuba_requests, referrer=Referrer.GROUPING_RECORDS_BACKFILL_REFERRER.value
        )

    group_id_batch_all = copy.deepcopy(group_id_batch)
    if snuba_results and snuba_results[0].get("data"):
        rows: list[GroupEventRow] = [snuba_result["data"][0] for snuba_result in snuba_results]

        # Log if any group does not have any events in snuba and skip it
        if len(rows) != len(group_id_batch):
            row_group_ids = {row["group_id"] for row in rows}
            for group_id in group_id_batch:
                if group_id not in row_group_ids:
                    logger.info(
                        "tasks.backfill_seer_grouping_records.no_snuba_event",
                        extra={
                            "organization_id": project.organization.id,
                            "project_id": project_id,
                            "group_id": group_id,
                        },
                    )
                    group_id_batch.remove(group_id)
                    del group_id_message_batch_filtered[group_id]

        group_hashes = GroupHash.objects.filter(
            project_id=project.id, group_id__in=group_id_batch
        ).distinct("group_id")
        group_hashes_dict = {group_hash.group_id: group_hash.hash for group_hash in group_hashes}
        data = lookup_group_data_stacktrace_bulk_with_fallback(
            project, rows, group_id_message_batch_filtered, group_hashes_dict
        )

        # If nodestore returns no data
        if data["data"] == [] and data["stacktrace_list"] == []:
            logger.info(
                "tasks.backfill_seer_grouping_records.no_data",
                extra={"project_id": project.id, "group_id_batch": json.dumps(group_id_batch)},
            )
            call_next_backfill(
                batch_end_index,
                project_id,
                redis_client,
                len(group_id_message_data),
                group_id_batch_all[-1],
                dry_run,
            )
            return

        with metrics.timer(f"{BACKFILL_NAME}.post_bulk_grouping_records", sample_rate=1.0):
            response = post_bulk_grouping_records(
                CreateGroupingRecordsRequest(
                    group_id_list=group_id_batch,
                    data=data["data"],
                    stacktrace_list=data["stacktrace_list"],
                )
            )

        if response.get("success"):
            groups_with_neighbor = response["groups_with_neighbor"]
            groups = Group.objects.filter(project_id=project.id, id__in=group_id_batch)
            for group in groups:
                seer_similarity = {
                    "similarity_model_version": SEER_SIMILARITY_MODEL_VERSION,
                    "request_hash": group_hashes_dict[group.id],
                }
                if str(group.id) in groups_with_neighbor:
                    # TODO: remove this try catch once the helper is made
                    try:
                        seer_similarity["results"] = [
                            asdict(
                                SeerSimilarIssueData.from_raw(
                                    project_id, groups_with_neighbor[str(group.id)]
                                )
                            )
                        ]
                    # TODO: if we reach this exception, we need to delete the record from seer or this will always happen
                    # we should not update the similarity data for this group cause we'd want to try again once we delete it
                    except (IncompleteSeerDataError, SimilarGroupNotFoundError):
                        logger.exception(
                            "tasks.backfill_seer_grouping_records.invalid_parent_group",
                            extra={
                                "project_id": project_id,
                                "group_id": group.id,
                                "parent_hash": groups_with_neighbor[str(group.id)]["parent_hash"],
                            },
                        )
                        seer_similarity = {}

                if seer_similarity:
                    if group.data.get("metadata"):
                        group.data["metadata"]["seer_similarity"] = seer_similarity
                    else:
                        group.data["metadata"] = {"seer_similarity": seer_similarity}

            if not dry_run:
                num_updated = Group.objects.bulk_update(groups, ["data"])
                logger.info(
                    "backfill_seer_grouping_records.bulk_update",
                    extra={"project_id": project.id, "num_updated": num_updated},
                )

            call_next_backfill(
                batch_end_index,
                project_id,
                redis_client,
                len(group_id_message_data),
                group_id_batch_all[-1],
                dry_run,
            )
        else:
            # If seer is down, we should stop
            logger.info(
                "backfill_seer_bulk_insert_returned_invald_result",
                extra={"project_id": project.id},
            )
    else:
        logger.info(
            "backfill_seer_snuba_returned_empty_result",
            extra={
                "project_id": project.id,
                "snuba_result": json.dumps(snuba_results),
                "group_id_batch": json.dumps(group_id_batch_all),
            },
        )
        call_next_backfill(
            batch_end_index,
            project_id,
            redis_client,
            len(group_id_message_data),
            group_id_batch_all[-1],
            dry_run,
        )


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
                raise

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
                            group_id=group_id,
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
                raise

    if event and event.data and event.data.get("exception"):
        with sentry_sdk.start_transaction(op="embeddings_grouping.get_latest_event"):
            grouping_info = get_grouping_info(None, project=project, event=event)
        stacktrace_string = get_stacktrace_string(grouping_info)
        group_data = (
            CreateGroupingRecordData(
                group_id=group_id, hash=hash, project_id=project_id, message=message
            )
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


def make_backfill_redis_key(project_id: int):
    redis_key = "grouping_record_backfill.last_processed_index"
    return f"{redis_key}-{project_id}"


def delete_seer_grouping_records(
    project_id: int,
    redis_client: RedisCluster | StrictRedis,
):
    """
    Delete seer grouping records for the project_id.
    Delete seer_similarity from the project's groups metadata.
    """
    logger.info(
        "backfill_seer_grouping_records.delete_all_seer_records",
        extra={"project_id": project_id},
    )
    delete_grouping_records(project_id)
    redis_client.delete(make_backfill_redis_key(project_id))

    for groups in chunked(
        RangeQuerySetWrapper(
            Group.objects.filter(project_id=project_id, type=ErrorGroupType.type_id)
        ),
        BULK_DELETE_METADATA_CHUNK_SIZE,
    ):
        groups_with_seer_metadata = [
            group
            for group in groups
            if get_path(group.data, "metadata", "seer_similarity") is not None
        ]

        for group in groups_with_seer_metadata:
            del group.data["metadata"]["seer_similarity"]
        Group.objects.bulk_update(groups_with_seer_metadata, ["data"])


def call_next_backfill(
    last_processed_index: int,
    project_id: int,
    redis_client: RedisCluster | StrictRedis,
    len_group_id_batch_unfiltered: int,
    last_group_id: int,
    dry_run: bool,
):
    redis_client.set(
        f"{make_backfill_redis_key(project_id)}",
        last_processed_index if last_processed_index is not None else 0,
        ex=60 * 60 * 24 * 7,
    )

    if last_processed_index and last_processed_index < len_group_id_batch_unfiltered:
        logger.info(
            "calling next backfill task",
            extra={
                "project_id": project_id,
                "last_processed_index": last_processed_index,
                "last_processed_group_id": last_group_id,
                "dry_run": dry_run,
            },
        )
        backfill_seer_grouping_records.apply_async(
            args=[project_id, last_processed_index, dry_run],
        )
    else:
        logger.info(
            "reached the end of the group id list",
            extra={
                "project_id": project_id,
                "last_processed_index": last_processed_index,
                "dry_run": dry_run,
            },
        )
