from __future__ import annotations

import logging
from collections import defaultdict
from collections.abc import Mapping
from concurrent.futures import ThreadPoolExecutor, wait
from typing import Any
from uuid import UUID

import jsonschema
import orjson
import sentry_sdk
from arroyo.backends.kafka.consumer import KafkaPayload
from arroyo.processing.strategies.batching import ValuesBatch
from arroyo.types import BrokerValue, Message
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone
from sentry_sdk.tracing import NoOpSpan, Span, Transaction

from sentry import features, nodestore, options
from sentry.event_manager import GroupInfo
from sentry.eventstore.models import Event
from sentry.issues.grouptype import get_group_type_by_type_id
from sentry.issues.ingest import hash_fingerprint_parts, save_issue_occurrence
from sentry.issues.issue_occurrence import DEFAULT_LEVEL, IssueOccurrence, IssueOccurrenceData
from sentry.issues.json_schemas import EVENT_PAYLOAD_SCHEMA, LEGACY_EVENT_PAYLOAD_SCHEMA
from sentry.issues.producer import PayloadType
from sentry.issues.status_change_consumer import process_status_change_message
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.ratelimits.sliding_windows import Quota, RedisSlidingWindowRateLimiter, RequestedQuota
from sentry.types.actor import parse_and_validate_actor
from sentry.utils import metrics

logger = logging.getLogger(__name__)

rate_limiter = RedisSlidingWindowRateLimiter(cluster=settings.SENTRY_RATE_LIMIT_REDIS_CLUSTER)


class InvalidEventPayloadError(Exception):
    pass


class EventLookupError(Exception):
    pass


def create_rate_limit_key(project_id: int, fingerprint: str) -> str:
    rate_limit_key = f"occurrence_rate_limit:{project_id}-{fingerprint}"
    return rate_limit_key


def is_rate_limited(
    project_id: int,
    fingerprint: str,
) -> bool:
    try:
        rate_limit_enabled = options.get("issues.occurrence-consumer.rate-limit.enabled")
        if not rate_limit_enabled:
            return False

        rate_limit_key = create_rate_limit_key(project_id, fingerprint)
        rate_limit_quota = Quota(**options.get("issues.occurrence-consumer.rate-limit.quota"))
        granted_quota = rate_limiter.check_and_use_quotas(
            [
                RequestedQuota(
                    rate_limit_key,
                    1,
                    [rate_limit_quota],
                )
            ]
        )[0]
        return not granted_quota.granted
    except Exception:
        logger.exception("Failed to check issue platform rate limiter")
        return False


@sentry_sdk.tracing.trace
def save_event_from_occurrence(
    data: dict[str, Any],
    **kwargs: Any,
) -> Event:
    from sentry.event_manager import EventManager

    data["type"] = "generic"

    project_id = data.pop("project_id")

    with metrics.timer("occurrence_consumer.save_event_occurrence.event_manager.save"):
        manager = EventManager(data, remove_other=False)
        event = manager.save(project_id=project_id)

        return event


@sentry_sdk.tracing.trace
def lookup_event(project_id: int, event_id: str) -> Event:
    data = nodestore.backend.get(Event.generate_node_id(project_id, event_id))
    if data is None:
        raise EventLookupError(f"Failed to lookup event({event_id}) for project_id({project_id})")
    event = Event(event_id=event_id, project_id=project_id)
    event.data = data
    return event


@sentry_sdk.tracing.trace
def create_event(project_id: int, event_id: str, event_data: dict[str, Any]) -> Event:
    return Event(
        event_id=event_id,
        project_id=project_id,
        snuba_data={
            "event_id": event_data["event_id"],
            "project_id": event_data["project_id"],
            "timestamp": event_data["timestamp"],
            "release": event_data.get("release"),
            "environment": event_data.get("environment"),
            "platform": event_data.get("platform"),
            "tags.key": [tag[0] for tag in event_data.get("tags", [])],
            "tags.value": [tag[1] for tag in event_data.get("tags", [])],
        },
    )


@sentry_sdk.tracing.trace
def create_event_and_issue_occurrence(
    occurrence_data: IssueOccurrenceData, event_data: dict[str, Any]
) -> tuple[IssueOccurrence, GroupInfo | None]:
    """With standalone span ingestion, we won't be storing events in
    nodestore, so instead we create a light-weight event with a small
    set of fields that lets us create occurrences.
    """
    project_id = occurrence_data["project_id"]
    event_id = occurrence_data["event_id"]
    if occurrence_data["event_id"] != event_data["event_id"]:
        raise ValueError(
            f"event_id in occurrence({occurrence_data['event_id']}) is different from event_id in event_data({event_data['event_id']})"
        )

    event = create_event(project_id, event_id, event_data)

    with metrics.timer(
        "occurrence_consumer._process_message.save_issue_occurrence",
        tags={"method": "create_event_and_issue_occurrence"},
    ):
        return save_issue_occurrence(occurrence_data, event)


@sentry_sdk.tracing.trace
def process_event_and_issue_occurrence(
    occurrence_data: IssueOccurrenceData, event_data: dict[str, Any]
) -> tuple[IssueOccurrence, GroupInfo | None]:
    if occurrence_data["event_id"] != event_data["event_id"]:
        raise ValueError(
            f"event_id in occurrence({occurrence_data['event_id']}) is different from event_id in event_data({event_data['event_id']})"
        )

    event = save_event_from_occurrence(event_data)
    with metrics.timer(
        "occurrence_consumer._process_message.save_issue_occurrence",
        tags={"method": "process_event_and_issue_occurrence"},
    ):
        return save_issue_occurrence(occurrence_data, event)


@sentry_sdk.tracing.trace
def lookup_event_and_process_issue_occurrence(
    occurrence_data: IssueOccurrenceData,
) -> tuple[IssueOccurrence, GroupInfo | None]:
    project_id = occurrence_data["project_id"]
    event_id = occurrence_data["event_id"]
    try:
        event = lookup_event(project_id, event_id)
    except Exception:
        raise EventLookupError(f"Failed to lookup event({event_id}) for project_id({project_id})")

    with metrics.timer(
        "occurrence_consumer._process_message.save_issue_occurrence",
        tags={"method": "lookup_event_and_process_issue_occurrence"},
    ):
        return save_issue_occurrence(occurrence_data, event)


@sentry_sdk.tracing.trace
def _get_kwargs(payload: Mapping[str, Any]) -> Mapping[str, Any]:
    """
    Processes the incoming message payload into a format we can use.

    :raises InvalidEventPayloadError: when payload contains invalid data
    """
    try:
        with metrics.timer("occurrence_ingest.duration", instance="_get_kwargs"):
            metrics.distribution("occurrence.ingest.size.data", len(payload), unit="byte")
            assignee_identifier = None
            payload_assignee = payload.get("assignee")
            if payload_assignee:
                project = Project.objects.get_from_cache(id=payload["project_id"])
                try:
                    assignee = parse_and_validate_actor(payload_assignee, project.organization_id)
                    if assignee:
                        assignee_identifier = assignee.identifier
                except Exception:
                    logger.exception("Failed to validate assignee for occurrence")

            occurrence_data = {
                "id": UUID(payload["id"]).hex,
                "project_id": payload["project_id"],
                "fingerprint": hash_fingerprint_parts(payload["fingerprint"]),
                "issue_title": payload["issue_title"],
                "subtitle": payload["subtitle"],
                "resource_id": payload.get("resource_id"),
                "evidence_data": payload.get("evidence_data"),
                "evidence_display": payload.get("evidence_display"),
                "type": payload["type"],
                "detection_time": payload["detection_time"],
                "level": payload.get("level", DEFAULT_LEVEL),
                "assignee": assignee_identifier,
            }

            if payload.get("event_id"):
                occurrence_data["event_id"] = UUID(payload["event_id"]).hex

            if payload.get("culprit"):
                occurrence_data["culprit"] = payload["culprit"]

            if payload.get("initial_issue_priority") is not None:
                occurrence_data["initial_issue_priority"] = payload["initial_issue_priority"]
            else:
                group_type = get_group_type_by_type_id(occurrence_data["type"])
                occurrence_data["initial_issue_priority"] = group_type.default_priority

            if "event" in payload:
                event_payload = payload["event"]
                if payload["project_id"] != event_payload.get("project_id"):
                    raise InvalidEventPayloadError(
                        f"project_id in occurrence ({payload['project_id']}) is different from project_id in event ({event_payload.get('project_id')})"
                    )
                if not payload.get("event_id") and not event_payload.get("event_id"):
                    raise InvalidEventPayloadError("Payload must contain an event_id")

                if not payload.get("event_id"):
                    occurrence_data["event_id"] = event_payload.get("event_id")

                event_data = {
                    "event_id": UUID(event_payload.get("event_id")).hex,
                    "level": occurrence_data["level"],
                    "project_id": event_payload.get("project_id"),
                    "platform": event_payload.get("platform"),
                    "received": event_payload.get("received", timezone.now()),
                    "tags": event_payload.get("tags"),
                    "timestamp": event_payload.get("timestamp"),
                }

                optional_params = [
                    "breadcrumbs",
                    "contexts",
                    "debug_meta",
                    "dist",
                    "environment",
                    "extra",
                    "modules",
                    "release",
                    "request",
                    "sdk",
                    "server_name",
                    "stacktrace",
                    "trace_id",
                    "transaction",
                    "user",
                ]
                for optional_param in optional_params:
                    if optional_param in event_payload:
                        event_data[optional_param] = event_payload.get(optional_param)

                try:
                    jsonschema.validate(event_data, EVENT_PAYLOAD_SCHEMA)
                except jsonschema.exceptions.ValidationError:
                    metrics.incr(
                        "occurrence_ingest.event_payload_invalid",
                        sample_rate=1.0,
                        tags={"occurrence_type": occurrence_data["type"]},
                    )
                    logger.exception(
                        "Error validating event payload, falling back to legacy validation"
                    )
                    try:
                        jsonschema.validate(event_data, LEGACY_EVENT_PAYLOAD_SCHEMA)
                    except jsonschema.exceptions.ValidationError:
                        metrics.incr(
                            "occurrence_ingest.legacy_event_payload_invalid",
                            sample_rate=1.0,
                            tags={"occurrence_type": occurrence_data["type"]},
                        )
                        raise

                event_data["metadata"] = {
                    # This allows us to show the title consistently in discover
                    "title": occurrence_data["issue_title"],
                }

                return {
                    "occurrence_data": occurrence_data,
                    "event_data": event_data,
                    "is_buffered_spans": payload.get("is_buffered_spans") is True,
                }
            else:
                if not payload.get("event_id"):
                    raise InvalidEventPayloadError(
                        "Payload must contain either event_id or event_data"
                    )

                return {"occurrence_data": occurrence_data}

    except (KeyError, ValueError) as e:
        raise InvalidEventPayloadError(e)


@sentry_sdk.tracing.trace
@metrics.wraps("occurrence_consumer.process_occurrence_message")
def process_occurrence_message(
    message: Mapping[str, Any], txn: Transaction | NoOpSpan | Span
) -> tuple[IssueOccurrence, GroupInfo | None] | None:
    with metrics.timer("occurrence_consumer._process_message._get_kwargs"):
        kwargs = _get_kwargs(message)
    occurrence_data = kwargs["occurrence_data"]
    metric_tags = {"occurrence_type": occurrence_data["type"]}
    is_buffered_spans = kwargs.get("is_buffered_spans", False)

    metrics.incr(
        "occurrence_ingest.messages",
        sample_rate=1.0,
        tags=metric_tags,
    )
    txn.set_tag("occurrence_type", occurrence_data["type"])

    project = Project.objects.get_from_cache(id=occurrence_data["project_id"])
    organization = Organization.objects.get_from_cache(id=project.organization_id)

    txn.set_tag("organization_id", organization.id)
    txn.set_tag("organization_slug", organization.slug)
    txn.set_tag("project_id", project.id)
    txn.set_tag("project_slug", project.slug)

    group_type = get_group_type_by_type_id(occurrence_data["type"])
    if not group_type.allow_ingest(organization):
        metrics.incr(
            "occurrence_ingest.dropped_feature_disabled",
            sample_rate=1.0,
            tags=metric_tags,
        )
        txn.set_tag("result", "dropped_feature_disabled")
        return None

    if is_rate_limited(project.id, fingerprint=occurrence_data["fingerprint"][0]):
        metrics.incr(
            "occurrence_ingest.dropped_rate_limited",
            sample_rate=1.0,
            tags=metric_tags,
        )
        txn.set_tag("result", "dropped_rate_limited")
        return None

    if "event_data" in kwargs and is_buffered_spans:
        return create_event_and_issue_occurrence(kwargs["occurrence_data"], kwargs["event_data"])
    elif "event_data" in kwargs:
        txn.set_tag("result", "success")
        with metrics.timer(
            "occurrence_consumer._process_message.process_event_and_issue_occurrence",
            tags=metric_tags,
        ):
            return process_event_and_issue_occurrence(
                kwargs["occurrence_data"], kwargs["event_data"]
            )
    else:
        txn.set_tag("result", "success")
        with metrics.timer(
            "occurrence_consumer._process_message.lookup_event_and_process_issue_occurrence",
            tags=metric_tags,
        ):
            return lookup_event_and_process_issue_occurrence(kwargs["occurrence_data"])


@sentry_sdk.tracing.trace
@metrics.wraps("occurrence_consumer.process_message")
def _process_message(
    message: Mapping[str, Any]
) -> tuple[IssueOccurrence | None, GroupInfo | None] | None:
    """
    :raises InvalidEventPayloadError: when the message is invalid
    :raises EventLookupError: when the provided event_id in the message couldn't be found.
    """
    with sentry_sdk.start_transaction(
        op="_process_message",
        name="issues.occurrence_consumer",
    ) as txn:
        try:
            # Messages without payload_type default to an OCCURRENCE payload
            payload_type = message.get("payload_type", PayloadType.OCCURRENCE.value)
            if payload_type == PayloadType.STATUS_CHANGE.value:
                group = process_status_change_message(message, txn)
                if not group:
                    return None

                return None, GroupInfo(group=group, is_new=False, is_regression=False)
            elif payload_type == PayloadType.OCCURRENCE.value:
                return process_occurrence_message(message, txn)
            else:
                metrics.incr(
                    "occurrence_consumer._process_message.dropped_invalid_payload_type",
                    sample_rate=1.0,
                    tags={"payload_type": payload_type},
                )
        except (ValueError, KeyError) as e:
            txn.set_tag("result", "error")
            raise InvalidEventPayloadError(e)
    return None


@sentry_sdk.tracing.trace
@metrics.wraps("occurrence_consumer.process_batch")
def process_occurrence_batch(
    worker: ThreadPoolExecutor, message: Message[ValuesBatch[KafkaPayload]]
) -> None:
    """
    Receives batches of occurrences. This function will take the batch
    and group them together by fingerprint (ensuring order is preserved) and
    execute each group using a ThreadPoolWorker.

    By batching we're able to process occurrences in parallel while guaranteeing
    that no occurrences are processed out of order per group.
    """

    batch = message.payload

    occcurrence_mapping: Mapping[str, list[Mapping[str, Any]]] = defaultdict(list)

    for item in batch:
        assert isinstance(item, BrokerValue)

        try:
            payload = orjson.loads(item.payload.value)
        except Exception:
            logger.exception("Failed to unpack message payload")
            continue

        # group by the fingerprint, there should only be one of them
        partition_key: str = payload["fingerprint"][0] if payload["fingerprint"] else ""

        occcurrence_mapping[partition_key].append(payload)

    # Number of occurrences that are being processed in this batch
    metrics.gauge("occurrence_consumer.checkin.parallel_batch_count", len(batch))

    # Number of groups we've collected to be processed in parallel
    metrics.gauge("occurrence_consumer.checkin.parallel_batch_groups", len(occcurrence_mapping))
    # Submit occurrences & status changes for processing
    with sentry_sdk.start_transaction(op="process_batch", name="occurrence.occurrence_consumer"):
        futures = [
            worker.submit(process_occurrence_group, group) for group in occcurrence_mapping.values()
        ]
        wait(futures)


@metrics.wraps("occurrence_consumer.process_occurrence_group")
def process_occurrence_group(items: list[Mapping[str, Any]]) -> None:
    """
    Process a group of related occurrences (all part of the same group)
    completely serially.
    """

    try:
        project = Project.objects.get_from_cache(id=items[0]["project_id"])
        organization = Organization.objects.get_from_cache(id=project.organization_id)
    except Exception:
        logger.exception("Failed to fetch project or organization")
        organization = None
    if organization and features.has(
        "organizations:occurence-consumer-prune-status-changes", organization
    ):
        status_changes = [
            item for item in items if item.get("payload_type") == PayloadType.STATUS_CHANGE.value
        ]

        if status_changes:
            items = [
                item
                for item in items
                if item.get("payload_type") != PayloadType.STATUS_CHANGE.value
            ] + status_changes[-1:]
            metrics.incr(
                "occurrence_consumer.process_occurrence_group.dropped_status_changes",
                amount=len(status_changes) - 1,
                sample_rate=1.0,
            )

    for item in items:
        cache_key = f"occurrence_consumer.process_occurrence_group.{item['id']}"
        if cache.get(cache_key):
            logger.info("Skipping processing of occurrence %s due to cache hit", item["id"])
            continue
        _process_message(item)
        # just need a 300 second cache
        cache.set(cache_key, 1, 300)
