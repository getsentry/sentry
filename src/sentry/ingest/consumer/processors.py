import functools
import logging
import os
from collections.abc import Mapping, MutableMapping
from typing import Any

import orjson
import sentry_sdk
from django.conf import settings
from django.core.cache import cache
from usageaccountant import UsageUnit

from sentry import eventstore, features
from sentry.attachments import CachedAttachment, attachment_cache
from sentry.event_manager import EventManager, save_attachment
from sentry.eventstore.processing import event_processing_store, transaction_processing_store
from sentry.feedback.usecases.create_feedback import FeedbackCreationSource, is_in_feedback_denylist
from sentry.ingest.types import ConsumerType
from sentry.ingest.userreport import Conflict, save_userreport
from sentry.killswitches import killswitch_matches_context
from sentry.models.project import Project
from sentry.signals import event_accepted
from sentry.tasks.store import preprocess_event, save_event_feedback, save_event_transaction
from sentry.usage_accountant import record
from sentry.utils import metrics
from sentry.utils.cache import cache_key_for_event
from sentry.utils.dates import to_datetime
from sentry.utils.event_tracker import TransactionStageStatus, track_sampled_event
from sentry.utils.sdk import set_current_event_project
from sentry.utils.snuba import RateLimitExceeded

logger = logging.getLogger(__name__)

CACHE_TIMEOUT = 3600

IngestMessage = Mapping[str, Any]


class Retriable(Exception):
    pass


def trace_func(**span_kwargs):
    def wrapper(f):
        @functools.wraps(f)
        def inner(*args, **kwargs):
            # First we check a local env var
            # if that's not set we check our conf file
            # if neither are set use 0
            sample_rate = float(
                os.getenv(
                    "SENTRY_INGEST_CONSUMER_APM_SAMPLING",
                    default=getattr(settings, "SENTRY_INGEST_CONSUMER_APM_SAMPLING", 0),
                )
            )
            # New behavior is to add a custom `sample_rate` that is picked up by `traces_sampler`
            span_kwargs.setdefault(
                "custom_sampling_context",
                {"sample_rate": sample_rate},
            )
            with sentry_sdk.start_transaction(**span_kwargs):
                return f(*args, **kwargs)

        return inner

    return wrapper


def process_transaction_no_celery(
    data: MutableMapping[str, Any], project_id: int, attachments: Any, start_time: float
) -> None:
    set_current_event_project(project_id)

    manager = EventManager(data)
    # event.project.organization is populated after this statement.
    manager.save(
        project_id,
        assume_normalized=True,
        start_time=start_time,
    )
    # Put the updated event back into the cache so that post_process
    # has the most recent data.
    data = manager.get_data()
    if not isinstance(data, dict):
        data = dict(data.items())

    with sentry_sdk.start_span(op="event_processing_store.store"):
        cache_key = transaction_processing_store.store(data)
    save_attachments(attachments, cache_key)


@trace_func(name="ingest_consumer.process_event")
@metrics.wraps("ingest_consumer.process_event")
def process_event(
    consumer_type: str,
    message: IngestMessage,
    project: Project,
    reprocess_only_stuck_events: bool = False,
    no_celery_mode: bool = False,
) -> None:
    """
    Perform some initial filtering and deserialize the message payload.
    """
    payload = message["payload"]
    start_time = float(message["start_time"])
    event_id = message["event_id"]
    project_id = int(message["project_id"])
    remote_addr = message.get("remote_addr")
    attachments = message.get("attachments") or ()

    if consumer_type == ConsumerType.Transactions:
        processing_store = transaction_processing_store
    else:
        processing_store = event_processing_store

    sentry_sdk.set_extra("event_id", event_id)
    sentry_sdk.set_extra("len_attachments", len(attachments))

    # check that we haven't already processed this event (a previous instance of the forwarder
    # died before it could commit the event queue offset)
    #
    # XXX(markus): I believe this code is extremely broken:
    #
    # * it practically uses memcached in prod which has no consistency
    #   guarantees (no idea how we don't run into issues there)
    #
    # * a TTL of 1h basically doesn't guarantee any deduplication at all. It
    #   just guarantees a good error message... for one hour.
    #
    # This code has been ripped from the old python store endpoint. We're
    # keeping it around because it does provide some protection against
    # reprocessing good events if a single consumer is in a restart loop.
    with sentry_sdk.start_span(op="deduplication_check"):
        deduplication_key = f"ev:{project_id}:{event_id}"

        try:
            cached_value = cache.get(deduplication_key)
        except Exception as exc:
            raise Retriable(exc)

        if cached_value is not None:
            logger.warning(
                "pre-process-forwarder detected a duplicated event" " with id:%s for project:%s.",
                event_id,
                project_id,
            )
            return  # message already processed do not reprocess

    with sentry_sdk.start_span(
        op="killswitch_matches_context", name="store.load-shed-pipeline-projects"
    ):
        if killswitch_matches_context(
            "store.load-shed-pipeline-projects",
            {
                "project_id": project_id,
                "event_id": event_id,
                "has_attachments": bool(attachments),
            },
        ):
            # This killswitch is for the worst of scenarios and should probably not
            # cause additional load on our logging infrastructure
            return

    # Parse the JSON payload. This is required to compute the cache key and
    # call process_event. The payload will be put into Kafka raw, to avoid
    # serializing it again.
    with sentry_sdk.start_span(op="orjson.loads"):
        data = orjson.loads(payload)

    sentry_sdk.set_extra("event_type", data.get("type"))

    with sentry_sdk.start_span(
        op="killswitch_matches_context", name="store.load-shed-parsed-pipeline-projects"
    ):
        if killswitch_matches_context(
            "store.load-shed-parsed-pipeline-projects",
            {
                "organization_id": project.organization_id,
                "project_id": project.id,
                "event_type": data.get("type") or "null",
                "has_attachments": bool(attachments),
                "event_id": event_id,
            },
        ):
            return

    # Raise the retriable exception and skip DLQ if anything below this point fails as it may be caused by
    # intermittent network issue
    try:
        # If we only want to reprocess "stuck" events, we check if this event is already in the
        # `processing_store`. We only continue here if the event *is* present, as that will eventually
        # process and consume the event from the `processing_store`, whereby getting it "unstuck".
        if reprocess_only_stuck_events:
            with sentry_sdk.start_span(op="event_processing_store.exists"):
                if not processing_store.exists(data):
                    return

        # The no_celery_mode version of the transactions consumer skips one trip to rc-processing
        # Otherwise, we have to store the event in processing store here for the save_event task to
        # fetch later
        if no_celery_mode:
            cache_key = None
        else:
            with metrics.timer("ingest_consumer._store_event"):
                cache_key = processing_store.store(data)
            if consumer_type == ConsumerType.Transactions:
                track_sampled_event(
                    data["event_id"], ConsumerType.Transactions, TransactionStageStatus.REDIS_PUT
                )

            save_attachments(attachments, cache_key)

        try:
            # Records rc-processing usage broken down by
            # event type.
            event_type = data.get("type")
            if event_type == "error":
                app_feature = "errors"
            elif event_type == "transaction":
                app_feature = "transactions"
            else:
                app_feature = None

            if app_feature is not None:
                record(settings.EVENT_PROCESSING_STORE, app_feature, len(payload), UsageUnit.BYTES)
        except Exception:
            pass

        if data.get("type") == "transaction":
            if no_celery_mode:
                with sentry_sdk.start_span(op="ingest_consumer.process_transaction_no_celery"):
                    sentry_sdk.set_tag("no_celery_mode", True)

                    process_transaction_no_celery(data, project_id, attachments, start_time)
            else:
                assert cache_key is not None
                # No need for preprocess/process for transactions thus submit
                # directly transaction specific save_event task.
                save_event_transaction.delay(
                    cache_key=cache_key,
                    data=None,
                    start_time=start_time,
                    event_id=event_id,
                    project_id=project_id,
                )

            try:
                collect_span_metrics(project, data)
            except Exception:
                pass
        elif data.get("type") == "feedback":
            if not is_in_feedback_denylist(project.organization):
                save_event_feedback.delay(
                    cache_key=None,  # no need to cache as volume is low
                    data=data,
                    start_time=start_time,
                    event_id=event_id,
                    project_id=project_id,
                )
            else:
                metrics.incr("feedback.ingest.filtered", tags={"reason": "org.denylist"})
        else:
            # Preprocess this event, which spawns either process_event or
            # save_event. Pass data explicitly to avoid fetching it again from the
            # cache.
            with sentry_sdk.start_span(op="ingest_consumer.process_event.preprocess_event"):
                preprocess_event(
                    cache_key=cache_key,
                    data=data,
                    start_time=start_time,
                    event_id=event_id,
                    project=project,
                    has_attachments=bool(attachments),
                )

        # remember for an 1 hour that we saved this event (deduplication protection)
        with sentry_sdk.start_span(op="cache.set"):
            cache.set(deduplication_key, "", CACHE_TIMEOUT)

        # emit event_accepted once everything is done
        with sentry_sdk.start_span(op="event_accepted.send_robust"):
            event_accepted.send_robust(
                ip=remote_addr, data=data, project=project, sender=process_event
            )
    except Exception as exc:
        if isinstance(exc, KeyError):  # ex: missing event_id in message["payload"]
            raise
        raise Retriable(exc)


def save_attachments(attachments: Any, cache_key: str) -> None:
    if attachments:
        with sentry_sdk.start_span(op="ingest_consumer.set_attachment_cache"):
            attachment_objects = [
                CachedAttachment(type=attachment.pop("attachment_type"), **attachment)
                for attachment in attachments
            ]
            assert cache_key is not None
            attachment_cache.set(cache_key, attachments=attachment_objects, timeout=CACHE_TIMEOUT)


@trace_func(name="ingest_consumer.process_attachment_chunk")
@metrics.wraps("ingest_consumer.process_attachment_chunk")
def process_attachment_chunk(message: IngestMessage) -> None:
    payload = message["payload"]
    event_id = message["event_id"]
    project_id = message["project_id"]
    id = message["id"]
    chunk_index = message["chunk_index"]
    cache_key = cache_key_for_event({"event_id": event_id, "project": project_id})
    attachment_cache.set_chunk(
        key=cache_key, id=id, chunk_index=chunk_index, chunk_data=payload, timeout=CACHE_TIMEOUT
    )


@trace_func(name="ingest_consumer.process_individual_attachment")
@metrics.wraps("ingest_consumer.process_individual_attachment")
def process_individual_attachment(message: IngestMessage, project: Project) -> None:
    event_id = message["event_id"]
    cache_key = cache_key_for_event({"event_id": event_id, "project": project.id})

    if not features.has("organizations:event-attachments", project.organization, actor=None):
        logger.info("Organization has no event attachments: %s", project.id)
        return

    if killswitch_matches_context(
        "store.load-shed-pipeline-projects",
        {
            "project_id": project.id,
            "event_id": event_id,
            "has_attachments": True,
        },
    ):
        # This killswitch is for the worst of scenarios and should probably not
        # cause additional load on our logging infrastructure
        return

    try:
        # Attachments may be uploaded for events that already exist. Fetch the
        # existing group_id, so that the attachment can be fetched by group-level
        # APIs. This is inherently racy.
        #
        # This is not guaranteed to provide correct results. Eventstore runs queries
        # against Snuba. This is problematic on the critical path on the ingestion
        # pipeline as Snuba can rate limit queries for specific projects when they
        # are above their quota. There is no guarantee that, when a project is within
        # their ingestion quota, they are also within the snuba queries quota.
        # Since there is no dead letter queue on this consumer, the only way to
        # prevent the consumer to crash as of now is to ignore the error and proceed.
        event = eventstore.backend.get_event_by_id(project.id, event_id)
    except RateLimitExceeded as e:
        event = None
        logger.exception(str(e))

    group_id = None
    if event is not None:
        group_id = event.group_id

    attachment_msg = message["attachment"]
    attachment_type = attachment_msg.pop("attachment_type")

    # NOTE: `get_from_chunks` will avoid the cache if `attachment_msg` contains `data` inline
    attachment = attachment_cache.get_from_chunks(
        key=cache_key, type=attachment_type, **attachment_msg
    )

    if attachment_type in ("event.attachment", "event.view_hierarchy"):
        save_attachment(
            cache_key,
            attachment,
            project,
            event_id,
            key_id=None,  # TODO: Inject this from Relay
            group_id=group_id,
            start_time=None,  # TODO: Inject this from Relay
        )
    else:
        logger.error("invalid individual attachment type: %s", attachment_type)

    attachment.delete()


@trace_func(name="ingest_consumer.process_userreport")
@metrics.wraps("ingest_consumer.process_userreport")
def process_userreport(message: IngestMessage, project: Project) -> bool:
    start_time = to_datetime(message["start_time"])
    feedback = orjson.loads(message["payload"])

    try:
        save_userreport(
            project,
            feedback,
            FeedbackCreationSource.USER_REPORT_ENVELOPE,
            start_time=start_time,
        )
        return True
    except Conflict as e:
        logger.info("Invalid userreport: %s", e)
        return False
    except Exception:
        # XXX(markus): Hotfix because we have broken data in kafka
        # If you want to remove this make sure to have triaged all errors in Sentry
        logger.exception("userreport.save.crash")
        return False


def collect_span_metrics(
    project: Project,
    data: MutableMapping[str, Any],
):
    if not features.has("organizations:am3-tier", project.organization) and not features.has(
        "organizations:dynamic-sampling", project.organization
    ):
        amount = (
            len(data.get("spans", [])) + 1
        )  # Segment spans also get added to the total span count.
        metrics.incr(
            "event.save_event.unsampled.spans.count",
            amount=amount,
            tags={"organization": project.organization.slug},
        )
