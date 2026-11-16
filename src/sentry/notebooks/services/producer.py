from __future__ import annotations

import abc
from collections.abc import Collection, Iterable, Mapping, Sequence
from typing import TYPE_CHECKING, Any, ClassVar, Union
from uuid import UUID

from django.db.models import Q, QuerySet

from sentry.notebooks.models import Notebook, NotebookActionRequest
from sentry.notebooks.services.action_kinds.base import FollowUpCommand
from sentry.notebooks.services.notebooks import archive_notebook_row, update_notebook_row
from sentry.viewer_context import ActorId

if TYPE_CHECKING:
    from sentry.notebooks.endpoints.serializers.action_request import (
        NotebookActionRequestFollowUpResponse,
    )
    from sentry.notebooks.endpoints.serializers.notebook import (
        NotebookOrchestrationSerializerResponse,
    )


class NotebookProducerRun(abc.ABC):
    """The producer's run for one notebook, read under the apply locks."""

    @abc.abstractmethod
    def record_applied(
        self, action_request: NotebookActionRequest, *, applied_by: int | None
    ) -> None: ...

    @abc.abstractmethod
    def queue_follow_up(self, command: FollowUpCommand, actor_id: int | None) -> UUID:
        """Send the producer a command for an action request, and return its request ID."""

    @abc.abstractmethod
    def queue_recheck(self, action_request: NotebookActionRequest, actor_id: int) -> UUID | None:
        """Ask the producer to check the request's report again, and return the command's
        request ID. None if the producer can't do that now.
        """

    @abc.abstractmethod
    def follow_up_failed(self, action_request: NotebookActionRequest) -> bool: ...

    @abc.abstractmethod
    def retry_recheck(self, action_request: NotebookActionRequest, actor_id: int) -> bool:
        """Send a failed re-check again if the producer never got it. Return False if it needs
        a new one, and raise ApplyFailed if it can't go yet.
        """

    @abc.abstractmethod
    def can_resend_follow_up(self, action_request: NotebookActionRequest) -> bool:
        """Whether the request's failed follow-up never reached the producer and can go again."""

    @abc.abstractmethod
    def resend_follow_up(self, action_request: NotebookActionRequest) -> None: ...


class NotebookProducer(abc.ABC):
    """What a producer that writes notebooks plugs into the notebook API."""

    # Type hints for the API schema of a follow-up's status, reason, and rerun.
    follow_up_status_hint: ClassVar[object] = str
    follow_up_reason_hint: ClassVar[object] = str | None
    follow_up_rerun_hint: ClassVar[object] = str | None
    # What the notebook list accepts for runStatus.
    run_statuses: ClassVar[Sequence[str]] = ()

    @abc.abstractmethod
    def lock_run(self, notebook: Notebook, *, lock: bool) -> NotebookProducerRun:
        """Read the notebook's run, locking it if asked. Callers hold the notebook lock."""

    @abc.abstractmethod
    def follow_ups(
        self, item_list: Sequence[NotebookActionRequest]
    ) -> Mapping[tuple[int, UUID], NotebookActionRequestFollowUpResponse]:
        """What the producer did with each request's follow-up, by notebook and request ID."""

    @abc.abstractmethod
    def orchestration_summaries(
        self, notebooks: Sequence[Notebook]
    ) -> Mapping[int, NotebookOrchestrationSerializerResponse]:
        """The producer's run state for each notebook that has one."""

    @abc.abstractmethod
    def has_run_status(self, statuses: Collection[str]) -> Q:
        """Match notebooks whose run is in one of the statuses."""

    @abc.abstractmethod
    def archive_notebook(
        self, *, notebook: Notebook, expected_version: int, actor: ActorId
    ) -> Notebook:
        """Archive the notebook and stop the producer's work on it."""

    @abc.abstractmethod
    def update_notebook(
        self,
        *,
        notebook: Notebook,
        expected_version: int,
        fields: dict[str, Any],
        project_ids: list[int] | None,
    ) -> Notebook:
        """Update the notebook, keeping the producer's state in step."""


PRODUCERS: dict[str, NotebookProducer] = {}


def register_producer(source_type: str, producer: NotebookProducer) -> None:
    # Re-running ready() with a new instance is fine; a second producer type isn't.
    existing = PRODUCERS.setdefault(source_type, producer)
    if type(existing) is not type(producer):
        raise ValueError(f"{source_type!r} already has a producer: {type(existing).__name__}")


def get_producer(source_type: str) -> NotebookProducer | None:
    return PRODUCERS.get(source_type)


def _by_producer(notebooks: Iterable[Notebook]) -> dict[NotebookProducer, list[Notebook]]:
    # One call per producer, even when it's registered for several source types.
    groups: dict[NotebookProducer, list[Notebook]] = {}
    for notebook in notebooks:
        producer = get_producer(notebook.source_type)
        if producer is not None:
            groups.setdefault(producer, []).append(notebook)
    return groups


def orchestration_summaries(
    notebooks: Sequence[Notebook],
) -> dict[int, NotebookOrchestrationSerializerResponse]:
    summaries: dict[int, NotebookOrchestrationSerializerResponse] = {}
    for producer, group in _by_producer(notebooks).items():
        summaries.update(producer.orchestration_summaries(group))
    return summaries


def follow_ups(
    item_list: Sequence[NotebookActionRequest], notebooks: Mapping[int, Notebook]
) -> dict[tuple[int, UUID], NotebookActionRequestFollowUpResponse]:
    result: dict[tuple[int, UUID], NotebookActionRequestFollowUpResponse] = {}
    notebook_ids = {item.notebook_id for item in item_list}
    for producer, group in _by_producer(notebooks[nid] for nid in notebook_ids).items():
        ids = {notebook.id for notebook in group}
        result.update(producer.follow_ups([item for item in item_list if item.notebook_id in ids]))
    return result


def archive_notebook(*, notebook: Notebook, expected_version: int, actor: ActorId) -> Notebook:
    producer = get_producer(notebook.source_type)
    if producer is None:
        return archive_notebook_row(notebook=notebook, expected_version=expected_version)
    return producer.archive_notebook(
        notebook=notebook, expected_version=expected_version, actor=actor
    )


def update_notebook(
    *,
    notebook: Notebook,
    expected_version: int,
    fields: dict[str, Any],
    project_ids: list[int] | None,
) -> Notebook:
    producer = get_producer(notebook.source_type)
    if producer is None:
        return update_notebook_row(
            notebook=notebook,
            expected_version=expected_version,
            fields=fields,
            project_ids=project_ids,
        )
    return producer.update_notebook(
        notebook=notebook,
        expected_version=expected_version,
        fields=fields,
        project_ids=project_ids,
    )


def known_run_statuses() -> set[str]:
    return {status for producer in PRODUCERS.values() for status in producer.run_statuses}


def filter_by_run_status(
    notebooks: QuerySet[Notebook], statuses: Collection[str]
) -> QuerySet[Notebook]:
    """Keep notebooks whose producer's run is in one of the statuses. A source type with no
    producer has no run, so its notebooks never match.
    """
    source_types: dict[NotebookProducer, list[str]] = {}
    for source_type, producer in PRODUCERS.items():
        source_types.setdefault(producer, []).append(source_type)
    matches = Q()
    for producer, types in source_types.items():
        matches |= Q(source_type__in=types) & producer.has_run_status(statuses)
    return notebooks.filter(matches) if matches else notebooks.none()


def _producer_hint(attr: str) -> object:
    hints = list(dict.fromkeys(getattr(producer, attr) for producer in PRODUCERS.values()))
    return Union[tuple(hints)] if hints else getattr(NotebookProducer, attr)


def follow_up_status_hint() -> object:
    return _producer_hint("follow_up_status_hint")


def follow_up_reason_hint() -> object:
    return _producer_hint("follow_up_reason_hint")


def follow_up_rerun_hint() -> object:
    return _producer_hint("follow_up_rerun_hint")
