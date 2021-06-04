import abc
import dataclasses
from dataclasses import dataclass
from typing import Any, Collection, Mapping, Optional, Sequence, Union

from sentry import eventstream
from sentry.eventstore.models import Event
from sentry.models.grouphash import GroupHash
from sentry.models.project import Project


class UnmergeReplacement(abc.ABC):
    """
    A type defining how and by which criteria a subset of events can be
    moved out of a group into a new, different group.

    Right now only one concrete implementation exists, the "classical" unmerge.
    In the future there will be an additional concrete type for splitting up
    groups based on hierarchical_hashes column.
    """

    @staticmethod
    def parse_arguments(fingerprints: Any = None, replacement: Any = None) -> "UnmergeReplacement":
        if replacement is not None:
            assert isinstance(replacement, UnmergeReplacement)
            return replacement
        elif fingerprints is not None:
            return PrimaryHashUnmergeReplacement(fingerprints=fingerprints)
        else:
            raise TypeError("Either fingerprints or replacement argument is required.")

    @abc.abstractmethod
    def should_move(self, event: Event, locked_primary_hashes: Collection[str]) -> bool:
        """
        The unmerge task iterates through all events of a group. This function
        should return which of them should land in the new group.
        """

        raise NotImplementedError()

    @abc.abstractproperty
    def primary_hashes_to_lock(self) -> Collection[str]:
        raise NotImplementedError()

    @abc.abstractmethod
    def start_snuba_replacement(self, project: Project, source_id: int, destination_id: int) -> Any:
        raise NotImplementedError()

    @abc.abstractmethod
    def stop_snuba_replacement(self, eventstream_state: Any) -> None:
        raise NotImplementedError()

    @abc.abstractmethod
    def run_postgres_replacement(
        self, project: Project, destination_id: int, locked_primary_hashes: Collection[str]
    ) -> None:
        raise NotImplementedError()

    @abc.abstractmethod
    def get_activity_args(self) -> Mapping[str, Any]:
        raise NotImplementedError()


@dataclass(frozen=True)
class PrimaryHashUnmergeReplacement(UnmergeReplacement):
    """
    The "classical unmerge": Moving events out of the group based on primary_hash.
    """

    fingerprints: Collection[str]

    def should_move(self, event: Event, locked_primary_hashes: Collection[str]) -> bool:
        primary_hash = event.get_primary_hash()
        return primary_hash in self.fingerprints and primary_hash in locked_primary_hashes

    @property
    def primary_hashes_to_lock(self) -> Collection[str]:
        return self.fingerprints

    def start_snuba_replacement(self, project: Project, source_id: int, destination_id: int) -> Any:
        return eventstream.start_unmerge(project.id, self.fingerprints, source_id, destination_id)

    def stop_snuba_replacement(self, eventstream_state: Any) -> None:
        if eventstream_state:
            eventstream.end_unmerge(eventstream_state)

    def run_postgres_replacement(
        self, project: Project, destination_id: int, locked_primary_hashes: Collection[str]
    ) -> None:
        # Move the group hashes to the destination.
        GroupHash.objects.filter(project_id=project.id, hash__in=locked_primary_hashes).update(
            group=destination_id
        )

    def get_activity_args(self) -> Mapping[str, Any]:
        return {"fingerprints": self.fingerprints}


@dataclass(frozen=True)
class UnmergeArgsBase:
    """
    Parsed arguments of the Sentry unmerge task. Since events of the source
    issue are processed in batches, one can think of each batch as belonging to
    a state in a statemachine.

    That statemachine has only two states: Processing the first page
    (`InitialUnmergeArgs`), processing second, third, ... page
    (`SuccessiveUnmergeArgs`). On the first page postgres hashes are migrated,
    activity models are created, eventstream and pagination state is
    initialized, and so the successive tasks need to carry significantly more
    state with them.
    """

    project_id: int
    source_id: int
    replacement: UnmergeReplacement
    actor_id: int
    batch_size: int

    @staticmethod
    def parse_arguments(
        project_id: int,
        source_id: int,
        destination_id: int,
        fingerprints: Sequence[str],
        actor_id: int,
        last_event: Optional[str] = None,
        batch_size: int = 500,
        source_fields_reset: bool = False,
        eventstream_state: Any = None,
        replacement: Optional[UnmergeReplacement] = None,
        locked_primary_hashes: Optional[Collection[str]] = None,
    ) -> "UnmergeArgs":
        if last_event is None:
            assert eventstream_state is None
            assert not source_fields_reset

            return InitialUnmergeArgs(
                project_id=project_id,
                source_id=source_id,
                replacement=UnmergeReplacement.parse_arguments(fingerprints, replacement),
                actor_id=actor_id,
                batch_size=batch_size,
                destination_id=destination_id,
            )
        else:
            assert locked_primary_hashes
            return SuccessiveUnmergeArgs(
                project_id=project_id,
                source_id=source_id,
                replacement=UnmergeReplacement.parse_arguments(fingerprints, replacement),
                actor_id=actor_id,
                batch_size=batch_size,
                last_event=last_event,
                destination_id=destination_id,
                eventstream_state=eventstream_state,
                locked_primary_hashes=locked_primary_hashes,
                source_fields_reset=source_fields_reset,
            )

    def dump_arguments(self) -> Mapping[str, Any]:
        rv = dataclasses.asdict(self)
        rv["fingerprints"] = None
        rv["replacement"] = self.replacement
        return rv


@dataclass(frozen=True)
class InitialUnmergeArgs(UnmergeArgsBase):
    # In tests the destination task is passed in explicitly from the outside,
    # so we support unmerging into an existing destination group. In production
    # this does not happen.
    destination_id: Optional[int]


@dataclass(frozen=True)
class SuccessiveUnmergeArgs(UnmergeArgsBase):
    last_event: Optional[Any]
    locked_primary_hashes: Collection[str]

    # unmerge may only start mutating data on a successive page, once it
    # actually has found an event that needs to be migrated.
    eventstream_state: Optional[Mapping[Any, Any]]
    destination_id: Optional[int]

    # likewise unmerge may only find "source" events (events that should not be
    # migrated) on the second page, only then (and only once) it can reset
    # group attributes such as last_seen.
    source_fields_reset: bool


UnmergeArgs = Union[InitialUnmergeArgs, SuccessiveUnmergeArgs]
