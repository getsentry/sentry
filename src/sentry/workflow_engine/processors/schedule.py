import logging
import math
import uuid
from dataclasses import asdict
from datetime import datetime, timezone
from itertools import islice

from sentry import options
from sentry.buffer.base import BufferField
from sentry.db import models
from sentry.utils import metrics
from sentry.workflow_engine.buffer import get_backend
from sentry.workflow_engine.buffer.redis_hash_sorted_set_buffer import RedisHashSortedSetBuffer
from sentry.workflow_engine.tasks.delayed_workflows import (
    DelayedWorkflow,
    process_delayed_workflows,
)

logger = logging.getLogger(__name__)


def fetch_group_to_event_data(
    buffer: RedisHashSortedSetBuffer,
    project_id: int,
    model: type[models.Model],
    batch_key: str | None = None,
) -> dict[str, str]:
    field: dict[str, models.Model | int | str] = {
        "project_id": project_id,
    }

    if batch_key:
        field["batch_key"] = batch_key

    return buffer.get_hash(model=model, field=field)


def bucket_num_groups(num_groups: int) -> str:
    if num_groups > 1:
        magnitude = 10 ** int(math.log10(num_groups))
        return f">{magnitude}"
    return "1"


def process_in_batches(buffer: RedisHashSortedSetBuffer, project_id: int) -> None:
    """
    This will check the number of alertgroup_to_event_data items in the Redis buffer for a project.

    If the number is larger than the batch size, it will chunk the items and process them in batches.

    The batches are replicated into a new redis hash with a unique filter (a uuid) to identify the batch.
    We need to use a UUID because these batches can be created in multiple processes and we need to ensure
    uniqueness across all of them for the centralized redis buffer. The batches are stored in redis because
    we shouldn't pass objects that need to be pickled and 10k items could be problematic in the celery tasks
    as arguments could be problematic. Finally, we can't use a pagination system on the data because
    redis doesn't maintain the sort order of the hash keys.
    """
    batch_size = options.get(
        "delayed_processing.batch_size"
    )  # TODO: Use workflow engine-specific option.
    processing_info = DelayedWorkflow(project_id)

    hash_args = processing_info.hash_args
    filters: dict[str, BufferField] = asdict(hash_args.filters)

    event_count = buffer.get_hash_length(model=hash_args.model, field=filters)
    metrics.incr("delayed_workflow.num_groups", tags={"num_groups": bucket_num_groups(event_count)})
    metrics.distribution("delayed_workflow.event_count", event_count)

    if event_count < batch_size:
        return process_delayed_workflows.apply_async(
            kwargs={"project_id": project_id}, headers={"sentry-propagate-traces": False}
        )

    logger.info(
        "delayed_workflow.process_large_batch",
        extra={"project_id": project_id, "count": event_count},
    )

    # if the dictionary is large, get the items and chunk them.
    alertgroup_to_event_data = fetch_group_to_event_data(buffer, project_id, hash_args.model)

    with metrics.timer("delayed_workflow.process_batch.duration"):
        items = iter(alertgroup_to_event_data.items())

        while batch := dict(islice(items, batch_size)):
            batch_key = str(uuid.uuid4())

            buffer.push_to_hash_bulk(
                model=hash_args.model,
                filters={**filters, "batch_key": batch_key},
                data=batch,
            )

            # remove the batched items from the project alertgroup_to_event_data
            buffer.delete_hash(**asdict(hash_args), fields=list(batch.keys()))

            process_delayed_workflows.apply_async(
                kwargs={"project_id": project_id, "batch_key": batch_key},
                headers={"sentry-propagate-traces": False},
            )


def process_buffered_workflows() -> None:
    option_name = DelayedWorkflow.option
    if option_name and not options.get(option_name):
        logger.info("delayed_workflow.disabled", extra={"option": option_name})
        return

    buffer = get_backend()

    with metrics.timer("delayed_workflow.process_all_conditions.duration"):
        # We need to use a very fresh timestamp here; project scores (timestamps) are
        # updated with each relevant event, and some can be updated every few milliseconds.
        # The staler this timestamp, the more likely it'll miss some recently updated projects,
        # and the more likely we'll have frequently updated projects that are never actually
        # retrieved and processed here.
        fetch_time = datetime.now(tz=timezone.utc).timestamp()
        buffer_keys = DelayedWorkflow.get_buffer_keys()
        all_project_ids_and_timestamps = buffer.bulk_get_sorted_set(
            buffer_keys,
            min=0,
            max=fetch_time,
        )

        log_str = ", ".join(
            f"{project_id}: {timestamps}"
            for project_id, timestamps in all_project_ids_and_timestamps.items()
        )
        logger.info("delayed_workflow.project_id_list", extra={"project_ids": log_str})

        project_ids = list(all_project_ids_and_timestamps.keys())
        for project_id in project_ids:
            process_in_batches(buffer, project_id)

        buffer.delete_keys(
            buffer_keys,
            min=0,
            max=fetch_time,
        )
