from unittest.mock import patch

from sentry.tasks.delete_seer_grouping_records_by_hash import delete_seer_grouping_records_by_hash


@patch(
    "sentry.tasks.delete_seer_grouping_records_by_hash.delete_seer_grouping_records_by_hash.apply_async"
)
def test_delete_seer_grouping_records_by_hash_batches(
    mock_delete_seer_grouping_records_by_hash_apply_async,
):
    """
    Test that when delete_seer_grouping_records_by_hash is called with over 20 hashes, it spawns
    another task with the end index of the previous batch.
    """
    project_id, hashes = 1, [str(i) for i in range(21)]
    delete_seer_grouping_records_by_hash(project_id, hashes, 0)
    assert mock_delete_seer_grouping_records_by_hash_apply_async.call_args[1] == {
        "args": [project_id, hashes, 20]
    }
