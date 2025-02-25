import logging
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import asdict
from datetime import UTC, datetime, timedelta
from typing import Any, TypedDict

import sentry_sdk
from django.db.models import Q
from google.api_core.exceptions import DeadlineExceeded, ServiceUnavailable
from snuba_sdk import Column, Condition, Entity, Limit, Op, Query, Request

from sentry import nodestore, options
from sentry.conf.server import SEER_SIMILARITY_MODEL_VERSION
from sentry.eventstore.models import Event
from sentry.grouping.grouping_info import get_grouping_info_from_variants
from sentry.grouping.grouptype import ErrorGroupType
from sentry.models.group import Group, GroupStatus
from sentry.models.project import Project
from sentry.seer.similarity.grouping_records import (
    BulkCreateGroupingRecordsResponse,
    CreateGroupingRecordData,
    CreateGroupingRecordsRequest,
    delete_project_grouping_records,
    post_bulk_grouping_records,
)
from sentry.seer.similarity.types import (
    IncompleteSeerDataError,
    SeerSimilarIssueData,
    SimilarHashMissingGroupError,
    SimilarHashNotFoundError,
)
from sentry.seer.similarity.utils import (
    ReferrerOptions,
    event_content_has_stacktrace,
    filter_null_from_string,
    get_stacktrace_string,
    has_too_many_contributing_frames,
)
from sentry.snuba.dataset import Dataset
from sentry.snuba.referrer import Referrer
from sentry.tasks.delete_seer_grouping_records import delete_seer_grouping_records_by_hash
from sentry.tasks.embeddings_grouping.constants import (
    BACKFILL_BULK_DELETE_METADATA_CHUNK_SIZE,
    BACKFILL_NAME,
    PROJECT_BACKFILL_COMPLETED,
)
from sentry.utils import json, metrics
from sentry.utils.iterators import chunked
from sentry.utils.query import RangeQuerySetWrapper
from sentry.utils.safe import get_path
from sentry.utils.snuba import QueryTooManySimultaneous, RateLimitExceeded, bulk_snuba_queries

SNUBA_RETRY_EXCEPTIONS = (RateLimitExceeded, QueryTooManySimultaneous)
NODESTORE_RETRY_EXCEPTIONS = (ServiceUnavailable, DeadlineExceeded)

logger = logging.getLogger(__name__)


class GroupEventRow(TypedDict):
    event_id: str
    group_id: int


class GroupStacktraceData(TypedDict):
    data: list[CreateGroupingRecordData]
    stacktrace_list: list[str]


def filter_snuba_results(
    snuba_results, groups_to_backfill_with_no_embedding, project, worker_number
):
    """
    Not all of the groups in `groups_to_backfill_with_no_embedding` are guaranteed to have
    corresponding snuba data. Filter both that and the snuba results to weed out groups which don't
    have data in snuba.
    """

    if not snuba_results or not snuba_results[0].get("data"):
        logger.info(
            "backfill_seer_grouping_records.empty_snuba_results",
            extra={
                "project_id": project.id,
                "group_id_batch": json.dumps(groups_to_backfill_with_no_embedding),
                "worker_number": worker_number,
            },
        )
        return [], []
    # First, filter out any results which have no data
    filtered_snuba_results: list[GroupEventRow] = [
        snuba_result["data"][0] for snuba_result in snuba_results if snuba_result["data"]
    ]

    # Then get the group id from any results which do
    row_group_ids = {row["group_id"] for row in filtered_snuba_results}

    # Finally, use these group ids to filter our original list
    groups_to_backfill_with_no_embedding_has_snuba_row = []
    for group_id in groups_to_backfill_with_no_embedding:
        if group_id in row_group_ids:
            groups_to_backfill_with_no_embedding_has_snuba_row.append(group_id)
        else:
            logger.info(
                "backfill_seer_grouping_records.no_snuba_event",
                extra={
                    "organization_id": project.organization.id,
                    "project_id": project.id,
                    "group_id": group_id,
                    "worker_number": worker_number,
                },
            )
    return filtered_snuba_results, groups_to_backfill_with_no_embedding_has_snuba_row


def create_project_cohort(
    worker_number: int,
    skip_processed_projects: bool,
    last_processed_project_id: int | None,
) -> list[int]:
    """
    Create project cohort by hashing and modding project ids, to assign projects uniquely to
    the worker with the given number.
    """
    project_id_filter = Q()
    if last_processed_project_id is not None:
        project_id_filter = Q(id__gt=last_processed_project_id)
    total_worker_count = options.get("similarity.backfill_total_worker_count")
    cohort_size = options.get("similarity.backfill_project_cohort_size")

    query = Project.objects.filter(project_id_filter)
    if skip_processed_projects:
        query = query.exclude(projectoption__key=PROJECT_BACKFILL_COMPLETED)
    project_cohort_list = (
        query.values_list("id", flat=True)
        .extra(
            where=["abs(hashtext(cast(id as varchar))) %% %s = %s"],
            params=[total_worker_count, worker_number],
        )
        .order_by("id")[:cohort_size]
    )
    return list(project_cohort_list)


def _make_postgres_call_with_filter(group_id_filter: Q, project_id: int, batch_size: int):
    """
    Return the filtered batch of group ids to be backfilled, the last group id in the raw batch,
    and the length of the raw batch.
    """

    groups_to_backfill_batch_raw = (
        Group.objects.filter(
            group_id_filter,
            project_id=project_id,
            type=ErrorGroupType.type_id,
        )
        .values_list("id", "data", "status", "last_seen", "times_seen")
        .order_by("-id")[:batch_size]
    )
    backfill_batch_raw_length = len(groups_to_backfill_batch_raw)

    # Filter out groups that are pending deletion, are too old, or have times_seen > 1 in here
    # rather than in the database so postgres won't make a bad query plan
    groups_to_backfill_batch = []
    for group in groups_to_backfill_batch_raw:
        group_id, data, status, last_seen, times_seen = group
        if (
            status
            not in [
                GroupStatus.PENDING_DELETION,
                GroupStatus.DELETION_IN_PROGRESS,
            ]
            and last_seen > datetime.now(UTC) - timedelta(days=90)
            and times_seen > 1
        ):
            groups_to_backfill_batch.append((group_id, data))

    # Get the group id of the last group in the raw batch; even if it's not valid to be backfilled,
    # we want to keep the value to be used as a filter for the next batch
    batch_raw_end_group_id = (
        None
        if backfill_batch_raw_length == 0
        else groups_to_backfill_batch_raw[backfill_batch_raw_length - 1][0]
    )

    return groups_to_backfill_batch, batch_raw_end_group_id, backfill_batch_raw_length


@sentry_sdk.tracing.trace
def get_current_batch_groups_from_postgres(
    project, last_processed_group_id, batch_size, worker_number, enable_ingestion: bool = False
):
    group_id_filter = Q()
    if last_processed_group_id is not None:
        group_id_filter = Q(id__lt=last_processed_group_id)

    (
        groups_to_backfill_batch,
        batch_end_group_id,
        backfill_batch_raw_length,
    ) = _make_postgres_call_with_filter(group_id_filter, project.id, batch_size)

    logger.info(
        "backfill_seer_grouping_records.batch",
        extra={
            "project_id": project.id,
            "batch_len": len(groups_to_backfill_batch),
            "last_processed_group_id": batch_end_group_id,
            "worker_number": worker_number,
        },
    )

    if backfill_batch_raw_length == 0:
        logger.info(
            "backfill_seer_grouping_records.no_more_groups",
            extra={"project_id": project.id, "worker_number": worker_number},
        )
        if enable_ingestion:
            logger.info(
                "backfill_seer_grouping_records.enable_ingestion",
                extra={"project_id": project.id, "worker_number": worker_number},
            )
            project.update_option(PROJECT_BACKFILL_COMPLETED, int(time.time()))

        return ([], None)

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
                "total_batch_groups": len(groups_to_backfill_batch),
                "groups_with_embedding": (
                    len(groups_to_backfill_batch) - len(groups_to_backfill_with_no_embedding)
                ),
                "worker_number": worker_number,
            },
        )
    return (
        groups_to_backfill_with_no_embedding,
        batch_end_group_id,
    )


@sentry_sdk.tracing.trace
def get_data_from_snuba(project, groups_to_backfill_with_no_embedding, worker_number=None):
    # TODO(jangjodi): Only query per group if it has over 1 million events, or batch queries with new where condition
    events_entity = Entity("events", alias="events")

    snuba_results = []
    for group_ids_chunk in chunked(
        groups_to_backfill_with_no_embedding,
        options.get("similarity.backfill_snuba_concurrent_requests"),
    ):
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
                        group.last_seen - timedelta(minutes=1),
                    ),
                    Condition(
                        Column("timestamp", entity=events_entity),
                        Op.LT,
                        group.last_seen + timedelta(minutes=1),
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

        with metrics.timer(
            f"{BACKFILL_NAME}.bulk_snuba_queries",
            sample_rate=options.get("seer.similarity.metrics_sample_rate"),
        ):
            snuba_results_chunk = _make_snuba_call(
                project,
                snuba_requests,
                Referrer.GROUPING_RECORDS_BACKFILL_REFERRER.value,
                worker_number,
            )

        snuba_results += snuba_results_chunk

    return snuba_results


def _make_snuba_call(project, snuba_requests, referrer, worker_number):
    try:
        snuba_results = _retry_operation(
            bulk_snuba_queries,
            snuba_requests,
            referrer,
            retries=6,
            delay=15,
            exceptions=SNUBA_RETRY_EXCEPTIONS,
        )
    except SNUBA_RETRY_EXCEPTIONS as e:
        message = (
            "Snuba Rate Limit Exceeded"
            if isinstance(e, RateLimitExceeded)
            else "Too Many Simultaneous Snuba Queries"
        )
        extra = {
            "organization_id": project.organization.id,
            "project_id": project.id,
            "error": message,
            "worker_number": worker_number,
        }
        logger.exception(
            "backfill_seer_grouping_records.snuba_query_limit_exceeded",
            extra=extra,
        )
        raise

    return snuba_results


@sentry_sdk.tracing.trace
def get_events_from_nodestore(
    project, snuba_results, groups_to_backfill_with_no_embedding_has_snuba_row, worker_number=None
):
    nodestore_events = lookup_group_data_stacktrace_bulk(project, snuba_results, worker_number)
    # If nodestore returns no data
    if len(nodestore_events) == 0:
        logger.info(
            "backfill_seer_grouping_records.no_nodestore_events",
            extra={
                "project_id": project.id,
                "group_id_batch": json.dumps(groups_to_backfill_with_no_embedding_has_snuba_row),
                "worker_number": worker_number,
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
        event._project_cache = project
        stacktrace_string = None

        if event and event_content_has_stacktrace(event):
            variants = event.get_grouping_variants(normalize_stacktraces=True)

            if not has_too_many_contributing_frames(event, variants, ReferrerOptions.BACKFILL):
                grouping_info = get_grouping_info_from_variants(variants)
                stacktrace_string = get_stacktrace_string(grouping_info)

            if not stacktrace_string:
                invalid_event_group_ids.append(group_id)
                continue
            primary_hash = event.get_primary_hash()
            if not primary_hash:
                invalid_event_group_ids.append(group_id)
                continue

            exception_type = get_path(event.data, "exception", "values", -1, "type")
            group_data.append(
                CreateGroupingRecordData(
                    group_id=group_id,
                    project_id=project.id,
                    exception_type=(
                        filter_null_from_string(exception_type) if exception_type else None
                    ),
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
                "worker_number": worker_number,
            },
        )

    return (
        GroupStacktraceData(data=group_data, stacktrace_list=stacktrace_strings),
        group_hashes_dict,
    )


def _make_seer_call(
    create_grouping_records_request: CreateGroupingRecordsRequest, project_id: int
) -> BulkCreateGroupingRecordsResponse | None:
    seer_response = _retry_operation(
        post_bulk_grouping_records,
        create_grouping_records_request,
        retries=20,
        delay=15,
        exceptions=Exception,
    )

    return seer_response


@sentry_sdk.tracing.trace
def send_group_and_stacktrace_to_seer(
    groups_to_backfill_with_no_embedding_has_snuba_row_and_nodestore_row,
    nodestore_results,
    project_id,
):
    with metrics.timer(
        f"{BACKFILL_NAME}.send_group_and_stacktrace_to_seer",
        sample_rate=options.get("seer.similarity.metrics_sample_rate"),
    ):
        return _make_seer_call(
            CreateGroupingRecordsRequest(
                group_id_list=groups_to_backfill_with_no_embedding_has_snuba_row_and_nodestore_row,
                data=nodestore_results["data"],
                stacktrace_list=nodestore_results["stacktrace_list"],
                use_reranking=options.get("similarity.backfill_use_reranking"),
            ),
            project_id,
        )


@sentry_sdk.tracing.trace
def send_group_and_stacktrace_to_seer_multithreaded(
    groups_to_backfill_with_no_embedding_has_snuba_row_and_nodestore_row,
    nodestore_results,
    project_id,
):
    def process_chunk(chunk_data, chunk_stacktrace):
        return _make_seer_call(
            CreateGroupingRecordsRequest(
                group_id_list=chunk_data["group_ids"],
                data=chunk_data["data"],
                stacktrace_list=chunk_stacktrace,
                use_reranking=options.get("similarity.backfill_use_reranking"),
            ),
            project_id,
        )

    with metrics.timer(
        f"{BACKFILL_NAME}.send_group_and_stacktrace_to_seer",
        sample_rate=options.get("seer.similarity.metrics_sample_rate"),
    ):
        chunk_size = options.get("similarity.backfill_seer_chunk_size")
        chunks = [
            {
                "group_ids": groups_to_backfill_with_no_embedding_has_snuba_row_and_nodestore_row[
                    i : i + chunk_size
                ],
                "data": nodestore_results["data"][i : i + chunk_size],
            }
            for i in range(
                0,
                len(groups_to_backfill_with_no_embedding_has_snuba_row_and_nodestore_row),
                chunk_size,
            )
        ]
        stacktrace_chunks = [
            nodestore_results["stacktrace_list"][i : i + chunk_size]
            for i in range(0, len(nodestore_results["stacktrace_list"]), chunk_size)
        ]

        seer_responses = []
        with ThreadPoolExecutor(
            max_workers=options.get("similarity.backfill_seer_threads")
        ) as executor:
            future_to_chunk = {
                executor.submit(process_chunk, chunk, stacktrace_chunks[i]): chunk
                for i, chunk in enumerate(chunks)
            }
            for future in as_completed(future_to_chunk):
                chunk_response = future.result()
                seer_responses.append(chunk_response)

        aggregated_response: dict[str, Any] = {
            "success": True,
            "groups_with_neighbor": {},
        }
        for seer_response in seer_responses:
            if not seer_response["success"]:
                aggregated_response["success"] = False
                aggregated_response.update({"reason": seer_response["reason"]})
                return aggregated_response

            aggregated_response["groups_with_neighbor"].update(
                seer_response["groups_with_neighbor"]
            )

        return aggregated_response


@sentry_sdk.tracing.trace
def update_groups(
    project, seer_response, group_id_batch_filtered, group_hashes_dict, worker_number
):
    groups_with_neighbor = seer_response["groups_with_neighbor"]
    groups = Group.objects.filter(project_id=project.id, id__in=group_id_batch_filtered)
    for group in groups:
        seer_similarity: dict[str, Any] = {
            "similarity_model_version": SEER_SIMILARITY_MODEL_VERSION,
            "request_hash": group_hashes_dict[group.id],
        }
        if str(group.id) in groups_with_neighbor:
            # TODO: remove this try catch once the helper is made
            try:
                seer_similarity["results"] = [
                    asdict(
                        SeerSimilarIssueData.from_raw(
                            project.id, groups_with_neighbor[str(group.id)]
                        )
                    )
                ]
            # we should not update the similarity data for this group cause we'd want to try again once we delete it
            except (
                IncompleteSeerDataError,
                SimilarHashNotFoundError,
                SimilarHashMissingGroupError,
            ) as err:
                parent_hash = groups_with_neighbor[str(group.id)]["parent_hash"]

                if isinstance(err, SimilarHashNotFoundError):
                    # Tell Seer to delete the hash from its database, so it doesn't keep suggesting a group
                    # which doesn't exist
                    delete_seer_grouping_records_by_hash.delay(project.id, [parent_hash])

                logger.exception(
                    "backfill_seer_grouping_records.invalid_parent_group",
                    extra={
                        "project_id": project.id,
                        "group_id": group.id,
                        "parent_hash": parent_hash,
                        "worker_number": worker_number,
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
        extra={
            "project_id": project.id,
            "num_updated": num_updated,
            "worker_number": worker_number,
        },
    )


def _make_nodestore_call(project, node_keys):
    bulk_data = _retry_operation(
        nodestore.backend.get_multi,
        node_keys,
        retries=3,
        delay=2,
        exceptions=NODESTORE_RETRY_EXCEPTIONS,
    )

    return bulk_data


@sentry_sdk.trace
def make_nodestore_call_multithreaded(project, node_keys):
    def process_chunk(chunk):
        return _make_nodestore_call(project, chunk)

    chunk_size = options.get("similarity.backfill_nodestore_chunk_size")
    chunks = [node_keys[i : i + chunk_size] for i in range(0, len(node_keys), chunk_size)]

    bulk_data = {}
    with ThreadPoolExecutor(
        max_workers=options.get("similarity.backfill_nodestore_threads")
    ) as executor:
        future_to_chunk = {executor.submit(process_chunk, chunk): chunk for chunk in chunks}
        for future in as_completed(future_to_chunk):
            bulk_data.update(future.result())

    return bulk_data


@sentry_sdk.tracing.trace
def lookup_group_data_stacktrace_bulk(
    project: Project, rows: list[GroupEventRow], worker_number: int | None = None
) -> dict[int, Event]:
    with metrics.timer(
        f"{BACKFILL_NAME}.lookup_event_bulk",
        sample_rate=options.get("seer.similarity.metrics_sample_rate"),
    ):
        project_id = project.id
        node_id_to_group_data = {
            Event.generate_node_id(project_id, event_id=row["event_id"]): (
                row["event_id"],
                row["group_id"],
            )
            for row in rows
        }

        groups_to_event = {}

        if options.get("similarity.backfill_nodestore_use_multithread"):
            bulk_data = make_nodestore_call_multithreaded(
                project, list(node_id_to_group_data.keys())
            )
        else:
            bulk_data = _make_nodestore_call(project, list(node_id_to_group_data.keys()))

        with sentry_sdk.start_span(op="lookup_event_bulk.loop", name="lookup_event_bulk.loop"):
            for node_id, data in bulk_data.items():
                if node_id in node_id_to_group_data:
                    event_id, group_id = (
                        node_id_to_group_data[node_id][0],
                        node_id_to_group_data[node_id][1],
                    )
                    event = Event(
                        event_id=event_id, project_id=project_id, group_id=group_id, data=data
                    )
                    groups_to_event[group_id] = event

        with sentry_sdk.start_span(
            op="lookup_event_bulk.individual_lookup",
            name="lookup_event_bulk.individual_lookup",
        ):
            # look up individually any that may have failed during bulk lookup
            for node_id, (event_id, group_id) in node_id_to_group_data.items():
                if node_id not in bulk_data:
                    data = _retry_operation(
                        nodestore.backend.get,
                        Event.generate_node_id(project_id, event_id),
                        retries=3,
                        delay=2,
                        exceptions=NODESTORE_RETRY_EXCEPTIONS,
                    )
                    if data is None:
                        extra = {
                            "organization_id": project.organization.id,
                            "project_id": project.id,
                            "group_id": group_id,
                            "event_id": event_id,
                            "worker_number": worker_number,
                        }
                        logger.error(
                            "backfill_seer_grouping_records.event_lookup_error", extra=extra
                        )
                        continue
                    event = Event(event_id=event_id, project_id=project_id, group_id=group_id)
                    event.data = data
                    groups_to_event[group_id] = event

        metrics.gauge(
            f"{BACKFILL_NAME}._lookup_event_bulk.hit_ratio",
            round(len(bulk_data.items()) / len(rows)) * 100,
            sample_rate=options.get("seer.similarity.metrics_sample_rate"),
        )

        return groups_to_event


def _retry_operation(operation, *args, retries, delay, exceptions, **kwargs):
    for attempt in range(retries):
        try:
            return operation(*args, **kwargs)
        except exceptions:
            if attempt < retries - 1:
                time.sleep(delay * (2**attempt))
            else:
                raise


def delete_seer_grouping_records(
    project_id: int,
):
    """
    Delete seer grouping records for the project_id.
    Delete seer_similarity from the project's groups metadata.
    """
    logger.info(
        "backfill_seer_grouping_records.delete_all_seer_records",
        extra={"project_id": project_id},
    )
    delete_project_grouping_records(project_id)

    for groups in chunked(
        RangeQuerySetWrapper(
            Group.objects.filter(project_id=project_id, type=ErrorGroupType.type_id)
        ),
        BACKFILL_BULK_DELETE_METADATA_CHUNK_SIZE,
    ):
        groups_with_seer_metadata = [
            group
            for group in groups
            if get_path(group.data, "metadata", "seer_similarity") is not None
        ]

        for group in groups_with_seer_metadata:
            del group.data["metadata"]["seer_similarity"]
        Group.objects.bulk_update(groups_with_seer_metadata, ["data"])


def get_next_project_from_cohort(current_project_index, cohort_projects):
    next_project_index = current_project_index + 1
    if next_project_index >= len(cohort_projects):
        return None, None

    project_id = cohort_projects[next_project_index]
    return project_id, next_project_index
