from typing import Any

from sentry import options
from sentry.seer.similarity.grouping_records import delete_grouping_records_by_hash
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task


@instrumented_task(
    name="sentry.tasks.delete_seer_grouping_records_by_hash",
    queue="delete_seer_grouping_records_by_hash",
    max_retries=0,
    silo_mode=SiloMode.REGION,
)
def delete_seer_grouping_records_by_hash(
    project_id: int,
    hashes: list[str],
    last_deleted_index: int = 0,
    soft_time_limit=60 * 15,
    time_limit=60 * (15 + 5),
    *args: Any,
    **kwargs: Any,
) -> None:
    """
    Task to delete seer grouping records by hash list.
    Calls the seer delete by hash endpoint with batches of hashes of size `BATCH_SIZE`.
    """
    batch_size = options.get("embeddings-grouping.seer.delete-record-batch-size")
    len_hashes = len(hashes)
    end_index = min(last_deleted_index + batch_size, len_hashes)
    delete_grouping_records_by_hash(project_id, hashes[last_deleted_index:end_index])
    if end_index < len_hashes:
        delete_seer_grouping_records_by_hash.apply_async(args=[project_id, hashes, end_index])
