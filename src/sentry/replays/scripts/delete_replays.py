from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime

from sentry.api.event_search import SearchFilter, parse_search_query
from sentry.models.organization import Organization
from sentry.replays.post_process import generate_normalized_output
from sentry.replays.query import query_replays_collection, replay_url_parser_config
from sentry.replays.tasks import delete_replay_recording


def delete_replays(
    project_id: int,
    dry_run: bool,
    batch_size: int,
    environment: list[str],
    tags: list[str],
    start_utc: datetime,
    end_utc: datetime,
) -> None:
    search_filters = translate_cli_tags_param_to_snuba_tag_param(tags)
    offset = 0

    while True:
        replays = list(
            generate_normalized_output(
                query_replays_collection(
                    project_ids=[project_id],
                    start=start_utc,
                    end=end_utc,
                    fields=["id"],
                    limit=batch_size,
                    environment=environment,
                    offset=offset,
                    search_filters=search_filters,
                    sort="started_at",
                    organization=Organization.objects.filter(project__id=project_id).get(),
                )
            )
        )

        offset += len(replays)

        if dry_run:
            print(f"Replays to be deleted (dry run): {len(replays)}")  # NOQA
        else:
            delete_replay_ids(project_id, replay_ids=[r["id"] for r in replays])


def translate_cli_tags_param_to_snuba_tag_param(tags: list[str]) -> Sequence[SearchFilter]:
    return parse_search_query(" AND ".join(tags), config=replay_url_parser_config)


def delete_replay_ids(project_id: int, replay_ids: list[str]) -> None:
    """Delete specific replay-ids from a project."""
    for replay_id in replay_ids:
        delete_replay_recording(project_id, replay_id)

    print(f"Deleted {len(replay_ids)} replays.")  # NOQA
