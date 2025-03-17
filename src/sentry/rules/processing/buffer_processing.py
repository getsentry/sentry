import logging
import math
import uuid
from abc import ABC, abstractmethod
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from itertools import islice
from typing import ClassVar

from celery import Task

from sentry import buffer, options
from sentry.buffer.base import BufferField
from sentry.buffer.redis import BufferHookEvent, redis_buffer_registry
from sentry.db import models
from sentry.utils import metrics
from sentry.utils.registry import NoRegistrationExistsError, Registry

logger = logging.getLogger("sentry.delayed_processing")


@dataclass
class FilterKeys:
    project_id: int


@dataclass
class BufferHashKeys:
    model: type[models.Model]
    filters: FilterKeys


class DelayedProcessingBase(ABC):
    buffer_key: ClassVar[str]
    option: ClassVar[str | None]

    def __init__(self, project_id: int):
        self.project_id = project_id

    @property
    @abstractmethod
    def hash_args(self) -> BufferHashKeys:
        raise NotImplementedError

    @property
    @abstractmethod
    def processing_task(self) -> Task:
        raise NotImplementedError


delayed_processing_registry = Registry[type[DelayedProcessingBase]]()


def fetch_group_to_event_data(
    project_id: int, model: type[models.Model], batch_key: str | None = None
) -> dict[str, str]:
    field: dict[str, models.Model | int | str] = {
        "project_id": project_id,
    }

    if batch_key:
        field["batch_key"] = batch_key

    return buffer.backend.get_hash(model=model, field=field)


def bucket_num_groups(num_groups: int) -> str:
    if num_groups > 1:
        magnitude = 10 ** int(math.log10(num_groups))
        return f">{magnitude}"
    return "1"


def process_in_batches(project_id: int, processing_type: str) -> None:
    """
    This will check the number of alertgroup_to_event_data items in the Redis buffer for a project.

    If the number is larger than the batch size, it will chunk the items and process them in batches.

    The batches are replicated into a new redis hash with a unique filter (a uuid) to identify the batch.
    We need to use a UUID because these batches can be created in multiple processes and we need to ensure
    uniqueness across all of them for the centralized redis buffer. The batches are stored in redis because
    we shouldn't pass objects that need to be pickled and 10k items could be problematic in the celery tasks
    as arguments could be problematic. Finally, we can't use a pagination system on the data because
    redis doesn't maintain the sort order of the hash keys.

    `processing_task` will fetch the batch from redis and process the rules.
    """
    batch_size = options.get("delayed_processing.batch_size")
    should_emit_logs = options.get("delayed_processing.emit_logs")
    log_format = "{}.{}"

    try:
        processing_info = delayed_processing_registry.get(processing_type)(project_id)
    except NoRegistrationExistsError:
        logger.exception(log_format.format(processing_type, "no_registration"))
        return

    hash_args = processing_info.hash_args
    task = processing_info.processing_task
    filters: dict[str, BufferField] = asdict(hash_args.filters)

    event_count = buffer.backend.get_hash_length(model=hash_args.model, field=filters)
    metrics.incr(
        f"{processing_type}.num_groups", tags={"num_groups": bucket_num_groups(event_count)}
    )

    if event_count < batch_size:
        return task.delay(project_id)

    if should_emit_logs:
        logger.info(
            log_format.format(processing_type, "process_large_batch"),
            extra={"project_id": project_id, "count": event_count},
        )

    # if the dictionary is large, get the items and chunk them.
    alertgroup_to_event_data = fetch_group_to_event_data(project_id, hash_args.model)

    with metrics.timer(f"{processing_type}.process_batch.duration"):
        items = iter(alertgroup_to_event_data.items())

        while batch := dict(islice(items, batch_size)):
            batch_key = str(uuid.uuid4())

            buffer.backend.push_to_hash_bulk(
                model=hash_args.model,
                filters={**filters, "batch_key": batch_key},
                data=batch,
            )

            # remove the batched items from the project alertgroup_to_event_data
            buffer.backend.delete_hash(**asdict(hash_args), fields=list(batch.keys()))

            task.delay(project_id, batch_key)


def process_buffer() -> None:
    fetch_time = datetime.now(tz=timezone.utc)
    should_emit_logs = options.get("delayed_processing.emit_logs")

    for processing_type, handler in delayed_processing_registry.registrations.items():
        if handler.option and not options.get(handler.option):
            continue

        with metrics.timer(f"{processing_type}.process_all_conditions.duration"):
            project_ids = buffer.backend.get_sorted_set(
                handler.buffer_key, min=0, max=fetch_time.timestamp()
            )
            if should_emit_logs:
                log_str = ", ".join(
                    f"{project_id}: {timestamp}" for project_id, timestamp in project_ids
                )
                log_name = f"{processing_type}.project_id_list"
                logger.info(log_name, extra={"project_ids": log_str})

            for project_id, _ in project_ids:
                process_in_batches(project_id, processing_type)

            buffer.backend.delete_key(handler.buffer_key, min=0, max=fetch_time.timestamp())


if not redis_buffer_registry.has(BufferHookEvent.FLUSH):
    redis_buffer_registry.add_handler(BufferHookEvent.FLUSH, process_buffer)
