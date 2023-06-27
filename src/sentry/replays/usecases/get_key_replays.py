from sentry.replays.post_process import process_raw_response
from sentry.replays.query import query_key_replays

FIELDS_TO_RETURN = ["count_errors", "id", "duration", "user", "is_archived"]


def get_key_replays(organzation_id, project_id, start, end):
    # ensure that the project has sent at least one replay

    return [
        r
        for r in process_raw_response(
            query_key_replays(organzation_id, project_id, start, end),
            FIELDS_TO_RETURN,
        )
        if not r["is_archived"]
    ]
