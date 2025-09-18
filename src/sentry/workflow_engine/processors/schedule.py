import logging
import math
import uuid
from datetime import datetime, timezone
from itertools import islice

from sentry import options
from sentry.utils import metrics
from sentry.workflow_engine.buffer.batch_client import (
    DelayedWorkflowClient,
    ProjectDelayedWorkflowClient,
)
from sentry.workflow_engine.tasks.delayed_workflows import process_delayed_workflows

logger = logging.getLogger(__name__)


def bucket_num_groups(num_groups: int) -> str:
    if num_groups > 1:
        magnitude = 10 ** int(math.log10(num_groups))
        return f">{magnitude}"
    return "1"


def process_in_batches(client: ProjectDelayedWorkflowClient) -> None:
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

    event_count = client.get_hash_length()
    metrics.incr("delayed_workflow.num_groups", tags={"num_groups": bucket_num_groups(event_count)})
    metrics.distribution("delayed_workflow.event_count", event_count)

    if event_count < batch_size:
        return process_delayed_workflows.apply_async(
            kwargs={"project_id": client.project_id},
            headers={"sentry-propagate-traces": False},
        )

    logger.info(
        "delayed_workflow.process_large_batch",
        extra={"project_id": client.project_id, "count": event_count},
    )

    # if the dictionary is large, get the items and chunk them.
    alertgroup_to_event_data = client.get_hash_data(batch_key=None)

    with metrics.timer("delayed_workflow.process_batch.duration"):
        items = iter(alertgroup_to_event_data.items())

        while batch := dict(islice(items, batch_size)):
            batch_key = str(uuid.uuid4())

            # Write items to batched hash and delete from original hash.
            client.push_to_hash(
                batch_key=batch_key,
                data=batch,
            )
            client.delete_hash_fields(batch_key=None, fields=list(batch.keys()))

            process_delayed_workflows.apply_async(
                kwargs={"project_id": client.project_id, "batch_key": batch_key},
                headers={"sentry-propagate-traces": False},
            )


def process_buffered_workflows(buffer_client: DelayedWorkflowClient) -> None:
    option_name = buffer_client.option
    if option_name and not options.get(option_name):
        logger.info("delayed_workflow.disabled", extra={"option": option_name})
        return

    with metrics.timer("delayed_workflow.process_all_conditions.duration"):
        # We need to use a very fresh timestamp here; project scores (timestamps) are
        # updated with each relevant event, and some can be updated every few milliseconds.
        # The staler this timestamp, the more likely it'll miss some recently updated projects,
        # and the more likely we'll have frequently updated projects that are never actually
        # retrieved and processed here.
        fetch_time = datetime.now(tz=timezone.utc).timestamp()
        all_project_ids_and_timestamps = buffer_client.get_project_ids(
            min=0,
            max=fetch_time,
        )

        metrics.distribution(
            "workflow_engine.schedule.projects", len(all_project_ids_and_timestamps)
        )
        logger.info(
            "delayed_workflow.project_id_list",
            extra={"project_ids": sorted(all_project_ids_and_timestamps.keys())},
        )

        project_ids = list(all_project_ids_and_timestamps.keys())
        for project_id in project_ids:
            process_in_batches(buffer_client.for_project(project_id))

        if options.get("workflow_engine.scheduler.use_conditional_delete"):
            member_maxes = [
                (project_id, max(timestamps))
                for project_id, timestamps in all_project_ids_and_timestamps.items()
            ]
            try:
                with metrics.timer("workflow_engine.conditional_delete_from_sorted_sets.duration"):
                    deleted = buffer.conditional_delete_from_sorted_sets(buffer_keys, member_maxes)

                deleted_project_ids = set().union(*deleted.values())
                logger.info(
                    "process_buffered_workflows.project_ids_deleted",
                    extra={
                        "deleted_project_ids": sorted(deleted_project_ids),
                        "processed_project_ids": sorted(project_ids),
                    },
                )
            except Exception:
                logger.exception(
                    "process_buffered_workflows.conditional_delete_from_sorted_sets_error"
                )
                # Fallback.
                buffer.delete_keys(
                    buffer_keys,
                    min=0,
                    max=fetch_time,
                )
        else:
            buffer.delete_keys(
                buffer_keys,
                min=0,
                max=fetch_time,
            )
