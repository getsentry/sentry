from datetime import datetime
from typing import Any

from sentry.utils.services import Service


class ReprocessingStore(Service):
    __all__ = (
        "event_count_for_hashes",
        "pop_batched_events",
        "pop_batched_events_by_key",
        "get_old_primary_hashes",
        "expire_hash",
        "add_hash",
        "get_remaining_event_count",
        "rename_key",
        "mark_event_reprocessed",
        "start_reprocessing",
        "get_pending",
        "get_progress",
    )

    def __init__(self, **options: Any) -> None:
        pass

    def event_count_for_hashes(
        self, project_id: int, group_id: int, old_primary_hashes: set[str]
    ) -> int:
        raise NotImplementedError()

    def pop_batched_events(
        self, project_id: int, group_id: int, primary_hash: str
    ) -> tuple[list[str], datetime | None, datetime | None]:
        raise NotImplementedError()

    def pop_batched_events_by_key(
        self, key: str
    ) -> tuple[list[str], datetime | None, datetime | None]:
        raise NotImplementedError()

    def get_old_primary_hashes(self, project_id: int, group_id: int) -> set[Any]:
        raise NotImplementedError()

    def expire_hash(
        self,
        project_id: int,
        group_id: int,
        event_id: str,
        date_val: datetime,
        old_primary_hash: str,
    ) -> None:
        raise NotImplementedError()

    def add_hash(self, project_id: int, group_id: int, hash: str) -> None:
        raise NotImplementedError()

    def get_remaining_event_count(
        self, project_id: int, old_group_id: int, datetime_to_event: list[tuple[datetime, str]]
    ) -> int:
        raise NotImplementedError()

    def rename_key(self, project_id: int, old_group_id: int) -> str | None:
        raise NotImplementedError()

    def mark_event_reprocessed(self, group_id: int, num_events: int) -> bool:
        raise NotImplementedError()

    def start_reprocessing(
        self, group_id: int, date_created: Any, sync_count: int, event_count: int
    ) -> None:
        raise NotImplementedError()

    def get_pending(self, group_id: int) -> Any:
        raise NotImplementedError()

    def get_progress(self, group_id: int) -> dict[str, Any] | None:
        raise NotImplementedError()
