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

from sentry import features, nodestore
from sentry.conf.server import SEER_SIMILARITY_MODEL_VERSION
from sentry.eventstore.models import Event
from sentry.grouping.grouping_info import get_grouping_info
from sentry.issues.grouptype import ErrorGroupType
from sentry.issues.occurrence_consumer import EventLookupError
from sentry.models.group import Group, GroupStatus
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
from sentry.seer.similarity.utils import filter_null_from_event_title, get_stacktrace_string
from sentry.snuba.dataset import Dataset
from sentry.snuba.referrer import Referrer
from sentry.utils import json, metrics, redis
from sentry.utils.iterators import chunked
from sentry.utils.query import RangeQuerySetWrapper
from sentry.utils.safe import get_path
from sentry.utils.snuba import bulk_snuba_queries

BACKFILL_NAME = "backfill_grouping_records"
BULK_DELETE_METADATA_CHUNK_SIZE = 100
SNUBA_QUERY_RATELIMIT = 4

logger = logging.getLogger(__name__)


class FeatureError(Exception):
    pass


class GroupEventRow(TypedDict):
    event_id: str
    group_id: int


class GroupStacktraceData(TypedDict):
    data: list[CreateGroupingRecordData]
    stacktrace_list: list[str]


def filter_snuba_results(snuba_results, groups_to_backfill_with_no_embedding, project):
    if not snuba_results or not snuba_results[0].get("data"):
        logger.info(
            "tasks.backfill_seer_grouping_records.results",
            extra={
                "project_id": project.id,
                "group_id_batch": json.dumps(groups_to_backfill_with_no_embedding),
            },
        )
        return
    filtered_snuba_results: list[GroupEventRow] = [
        snuba_result["data"][0] for snuba_result in snuba_results if snuba_result["data"]
    ]

    groups_to_backfill_with_no_embedding_has_snuba_row = []
    row_group_ids = {row["group_id"] for row in filtered_snuba_results}
    for group_id in groups_to_backfill_with_no_embedding:
        if group_id in row_group_ids:
            groups_to_backfill_with_no_embedding_has_snuba_row.append(group_id)
        else:
            logger.info(
                "tasks.backfill_seer_grouping_records.no_snuba_event",
                extra={
                    "organization_id": project.organization.id,
                    "project_id": project.id,
                    "group_id": group_id,
                },
            )
    return filtered_snuba_results, groups_to_backfill_with_no_embedding_has_snuba_row


@sentry_sdk.tracing.trace
def initialize_backfill(project_id, last_processed_index):
    logger.info(
        "backfill_seer_grouping_records.start",
        extra={
            "project_id": project_id,
            "last_processed_index": last_processed_index,
        },
    )
    project = Project.objects.get_from_cache(id=project_id)
    if not features.has("projects:similarity-embeddings-backfill", project):
        raise FeatureError("Project does not have feature")

    redis_client = redis.redis_clusters.get(settings.SENTRY_MONITORS_REDIS_CLUSTER)

    if last_processed_index is None:
        last_processed_index = int(redis_client.get(make_backfill_redis_key(project_id)) or 0)
    return project, redis_client, last_processed_index


@sentry_sdk.tracing.trace
def get_current_batch_groups_from_postgres(project, last_processed_index, batch_size):
    groups_to_backfill_query = (
        Group.objects.filter(
            project_id=project.id,
            type=ErrorGroupType.type_id,
            times_seen__gt=1,
            last_seen__gt=(datetime.now(UTC) - timedelta(days=90)),
        )
        .exclude(status__in=[GroupStatus.PENDING_DELETION, GroupStatus.DELETION_IN_PROGRESS])
        .values_list("id", "data")
        .order_by("-times_seen", "id")
    )
    total_groups_to_backfill_length = len(groups_to_backfill_query)

    batch_end_index = min(last_processed_index + batch_size, total_groups_to_backfill_length)
    groups_to_backfill_batch = groups_to_backfill_query[last_processed_index:batch_end_index]

    logger.info(
        "backfill_seer_grouping_records.batch",
        extra={
            "project_id": project.id,
            "batch_len": len(groups_to_backfill_batch),
            "last_processed_index": last_processed_index,
            "total_groups_length": total_groups_to_backfill_length,
        },
    )

    if len(groups_to_backfill_batch) == 0:
        logger.info(
            "backfill_seer_grouping_records.no_more_groups",
            extra={"project_id": project.id},
        )
        return (
            groups_to_backfill_batch,
            batch_end_index,
            total_groups_to_backfill_length,
        )

    groups_to_backfill_with_no_embedding = [
        group_id
        for (group_id, data) in groups_to_backfill_batch
        if get_path(data, "metadata", "seer_similarity", "similarity_model_version") is None
    ]
    if len(groups_to_backfill_batch) != len(groups_to_backfill_with_no_embedding):
        logger.info(
            "backfill_seer_grouping_records.groups_already_had_embedding",
            extra={
                "project_id": project.id,
                "num_groups": len(groups_to_backfill_with_no_embedding),
            },
        )
    return (
        groups_to_backfill_with_no_embedding,
        batch_end_index,
        total_groups_to_backfill_length,
    )


@sentry_sdk.tracing.trace
def get_data_from_snuba(project, groups_to_backfill_with_no_embedding):
    # TODO(jangjodi): Only query per group if it has over 1 million events, or batch queries with new where condition
    events_entity = Entity("events", alias="events")

    snuba_results = []
    for group_ids_chunk in chunked(groups_to_backfill_with_no_embedding, SNUBA_QUERY_RATELIMIT):
        snuba_requests = []
        for group_id in group_ids_chunk:
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
            snuba_results_chunk = bulk_snuba_queries(
                snuba_requests, referrer=Referrer.GROUPING_RECORDS_BACKFILL_REFERRER.value
            )
        snuba_results += snuba_results_chunk

    return snuba_results


@sentry_sdk.tracing.trace
def get_events_from_nodestore(
    project, snuba_results, groups_to_backfill_with_no_embedding_has_snuba_row
):
    nodestore_events = lookup_group_data_stacktrace_bulk(project, snuba_results)
    # If nodestore returns no data
    if len(nodestore_events) == 0:
        logger.info(
            "tasks.backfill_seer_grouping_records.no_data",
            extra={
                "project_id": project.id,
                "group_id_batch": json.dumps(groups_to_backfill_with_no_embedding_has_snuba_row),
            },
        )
        return (
            GroupStacktraceData(data=[], stacktrace_list=[]),
            {},
        )

    group_data = []
    stacktrace_strings = []
    invalid_event_group_ids = []
    bulk_event_ids = set()
    for group_id, event in nodestore_events.items():
        if event and event.data and event.data.get("exception"):
            grouping_info = get_grouping_info(None, project=project, event=event)
            stacktrace_string = get_stacktrace_string(grouping_info)
            if stacktrace_string == "":
                invalid_event_group_ids.append(group_id)
                continue
            primary_hash = event.get_primary_hash()
            if not primary_hash:
                invalid_event_group_ids.append(group_id)
                continue

            group_data.append(
                CreateGroupingRecordData(
                    group_id=group_id,
                    project_id=project.id,
                    message=filter_null_from_event_title(event.title),
                    exception_type=get_path(event.data, "exception", "values", -1, "type"),
                    hash=primary_hash,
                )
            )
            stacktrace_strings.append(stacktrace_string)
            bulk_event_ids.add(event.event_id)
        else:
            invalid_event_group_ids.append(group_id)

    group_hashes_dict = {
        group_stacktrace_data["group_id"]: group_stacktrace_data["hash"]
        for group_stacktrace_data in group_data
    }
    if len(invalid_event_group_ids) > 0:
        logger.info(
            "backfill_seer_grouping_records.invalid_group_ids",
            extra={
                "project_id": project.id,
                "invalid_group_ids": invalid_event_group_ids,
            },
        )

    return (
        GroupStacktraceData(data=group_data, stacktrace_list=stacktrace_strings),
        group_hashes_dict,
    )


@sentry_sdk.tracing.trace
def send_group_and_stacktrace_to_seer(
    project, groups_to_backfill_with_no_embedding_has_snuba_row_and_nodestore_row, nodestore_results
):
    seer_response = post_bulk_grouping_records(
        CreateGroupingRecordsRequest(
            group_id_list=groups_to_backfill_with_no_embedding_has_snuba_row_and_nodestore_row,
            data=nodestore_results["data"],
            stacktrace_list=nodestore_results["stacktrace_list"],
        )
    )
    return seer_response


@sentry_sdk.tracing.trace
def update_groups(project, seer_response, group_id_batch_filtered, group_hashes_dict):
    groups_with_neighbor = seer_response["groups_with_neighbor"]
    groups = Group.objects.filter(project_id=project.id, id__in=group_id_batch_filtered)
    for group in groups:
        seer_similarity: dict[str, Any] = {
            "similarity_model_version": SEER_SIMILARITY_MODEL_VERSION,
            "request_hash": group_hashes_dict[group.id],
        }
        if str(group.id) in groups_with_neighbor:
            logger.info(
                "backfill_seer_grouping_records.found_neighbor",
                extra={
                    "project_id": project.id,
                    "group_id": group.id,
                },
            )
            # TODO: remove this try catch once the helper is made
            try:
                seer_similarity["results"] = [
                    asdict(
                        SeerSimilarIssueData.from_raw(
                            project.id, groups_with_neighbor[str(group.id)]
                        )
                    )
                ]
            # TODO: if we reach this exception, we need to delete the record from seer or this will always happen
            # we should not update the similarity data for this group cause we'd want to try again once we delete it
            except (IncompleteSeerDataError, SimilarGroupNotFoundError):
                logger.exception(
                    "tasks.backfill_seer_grouping_records.invalid_parent_group",
                    extra={
                        "project_id": project.id,
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

    num_updated = Group.objects.bulk_update(groups, ["data"])
    logger.info(
        "backfill_seer_grouping_records.bulk_update",
        extra={"project_id": project.id, "num_updated": num_updated},
    )


@metrics.wraps(f"{BACKFILL_NAME}.lookup_event_bulk", sample_rate=1.0)
def lookup_group_data_stacktrace_bulk(
    project: Project, rows: list[GroupEventRow]
) -> dict[int, Event]:
    project_id = project.id
    node_id_to_group_data = {
        Event.generate_node_id(project_id, event_id=row["event_id"]): (
            row["event_id"],
            row["group_id"],
        )
        for row in rows
    }

    groups_to_event = {}

    try:
        bulk_data = _retry_operation(
            nodestore.backend.get_multi,
            list(node_id_to_group_data.keys()),
            retries=3,
            delay=2,
        )
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

    for node_id, data in bulk_data.items():
        if node_id in node_id_to_group_data:
            event_id, group_id = (
                node_id_to_group_data[node_id][0],
                node_id_to_group_data[node_id][1],
            )
            event = Event(event_id=event_id, project_id=project_id, group_id=group_id, data=data)
            groups_to_event[group_id] = event

    # look up individually any that may have failed during bulk lookup
    for node_id, (event_id, group_id) in node_id_to_group_data.items():
        if node_id not in bulk_data:
            data = _retry_operation(
                nodestore.backend.get,
                Event.generate_node_id(project_id, event_id),
                retries=3,
                delay=2,
            )
            if data is None:
                extra = {
                    "organization_id": project.organization.id,
                    "project_id": project.id,
                    "group_id": group_id,
                    "event_id": event_id,
                }
                logger.error("tasks.backfill_seer_grouping_records.event_lookup_error", extra=extra)
                continue
            event = Event(event_id=event_id, project_id=project_id, group_id=group_id)
            event.data = data
            groups_to_event[group_id] = event

    metrics.gauge(
        f"{BACKFILL_NAME}._lookup_event_bulk.hit_ratio",
        round(len(bulk_data.items()) / len(rows)) * 100,
        sample_rate=1.0,
    )

    return groups_to_event


def _retry_operation(operation, *args, retries, delay, **kwargs):
    for attempt in range(retries):
        try:
            return operation(*args, **kwargs)
        except (ServiceUnavailable, DeadlineExceeded):
            if attempt < retries - 1:
                time.sleep(delay * (2**attempt))
            else:
                raise


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
