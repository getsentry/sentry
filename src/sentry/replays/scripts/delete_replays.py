from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime

from sentry.api.event_search import SearchFilter, parse_search_query
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
    count = 0
    from sentry.models.organization import Organization

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
                    offset=count,
                    search_filters=search_filters,
                    sort="started_at",
                    organization=Organization.objects.filter(project__id=project_id).get(),
                )
            )
        )
        count += len(replays)
        if replays:
            replay_ids = [r["id"] for r in replays]

            if dry_run:
                print_message = "Replays to be deleted (dry run): "
            else:
                print_message = "Replays deleted: "
                for replay_id in replay_ids:
                    delete_replay_recording(project_id, replay_id)

            print(print_message, ", ".join(replay_ids))  # NOQA
        else:
            print(f"All rows were successfully deleted. Total replays deleted: {count}")  # NOQA
            return


def translate_cli_tags_param_to_snuba_tag_param(tags: list[str]) -> Sequence[SearchFilter]:
    search_query = " AND ".join(tags)

    return parse_search_query(search_query, config=replay_url_parser_config)
