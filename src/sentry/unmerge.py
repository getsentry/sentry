import abc
import dataclasses
from dataclasses import dataclass
from typing import Any, Collection, Mapping, Optional, Sequence, Tuple, Union

from sentry import eventstream
from sentry.eventstore.models import Event
from sentry.models.grouphash import GroupHash
from sentry.models.project import Project
from sentry.utils.datastructures import BidirectionalMapping

_DEFAULT_UNMERGE_KEY = "default"

# Weird type, but zero runtime cost in casting it to `Destinations`!
InitialDestinations = Mapping[str, Tuple[int, None]]

Destinations = Mapping[str, Tuple[int, Any]]

EventstreamState = Any


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
            if isinstance(replacement, dict):
                replacement = _REPLACEMENT_TYPE_LABELS.get_key(replacement.pop("type"))(
                    **replacement
                )
            assert isinstance(replacement, UnmergeReplacement)
            return replacement
        elif fingerprints is not None:
            # TODO(markus): Deprecate once we no longer use `fingerprints` arg
            # (need to change group_hashes endpoint first)
            return PrimaryHashUnmergeReplacement(fingerprints=fingerprints)
        else:
            raise TypeError("Either fingerprints or replacement argument is required.")

    @abc.abstractmethod
    def get_unmerge_key(
        self, event: Event, locked_primary_hashes: Collection[str]
    ) -> Optional[str]:
        """
        The unmerge task iterates through all events of a group. This function
        should return which of them should land in the new group.

        If the event should be moved, a string should be returned. Events with
        the same string are moved into the same issue.
        """

        raise NotImplementedError()

    @abc.abstractproperty
    def primary_hashes_to_lock(self) -> Collection[str]:
        raise NotImplementedError()

    @abc.abstractmethod
    def start_snuba_replacement(
        self, project: Project, source_id: int, destination_id: int
    ) -> EventstreamState:
        raise NotImplementedError()

    @abc.abstractmethod
    def stop_snuba_replacement(self, eventstream_state: EventstreamState) -> None:
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

    def get_unmerge_key(
        self, event: Event, locked_primary_hashes: Collection[str]
    ) -> Optional[str]:
        primary_hash = event.get_primary_hash()
        if primary_hash in self.fingerprints and primary_hash in locked_primary_hashes:
            return _DEFAULT_UNMERGE_KEY

        return None

    @property
    def primary_hashes_to_lock(self) -> Collection[str]:
        return self.fingerprints

    def start_snuba_replacement(
        self, project: Project, source_id: int, destination_id: int
    ) -> EventstreamState:
        return eventstream.start_unmerge(project.id, self.fingerprints, source_id, destination_id)

    def stop_snuba_replacement(self, eventstream_state: EventstreamState) -> None:
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


_REPLACEMENT_TYPE_LABELS: BidirectionalMapping = BidirectionalMapping(
    {
        PrimaryHashUnmergeReplacement: "primary_hash",
    }
)


@dataclass(frozen=True)
class UnmergeArgsBase(abc.ABC):
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
    actor_id: Optional[int]
    batch_size: int

    @staticmethod
    def parse_arguments(
        project_id: int,
        source_id: int,
        destination_id: Optional[int],
        fingerprints: Sequence[str],
        actor_id: Optional[int],
        last_event: Optional[Mapping[str, Any]] = None,
        batch_size: int = 500,
        source_fields_reset: bool = False,
        eventstream_state: EventstreamState = None,
        replacement: Optional[UnmergeReplacement] = None,
        locked_primary_hashes: Optional[Collection[str]] = None,
        destinations: Optional[Destinations] = None,
    ) -> "UnmergeArgs":
        if destinations is None:
            if destination_id is not None:
                destinations = {_DEFAULT_UNMERGE_KEY: (destination_id, eventstream_state)}
            else:
                destinations = {}

        if last_event is None:
            assert eventstream_state is None
            assert not source_fields_reset

            return InitialUnmergeArgs(
                project_id=project_id,
                source_id=source_id,
                replacement=UnmergeReplacement.parse_arguments(fingerprints, replacement),
                actor_id=actor_id,
                batch_size=batch_size,
                destinations=destinations,
            )
        else:
            assert locked_primary_hashes is not None or fingerprints is not None
            return SuccessiveUnmergeArgs(
                project_id=project_id,
                source_id=source_id,
                replacement=UnmergeReplacement.parse_arguments(fingerprints, replacement),
                actor_id=actor_id,
                batch_size=batch_size,
                last_event=last_event,
                destinations=destinations,
                locked_primary_hashes=locked_primary_hashes or fingerprints or [],
                source_fields_reset=source_fields_reset,
            )

    def dump_arguments(self) -> Mapping[str, Any]:
        rv = dataclasses.asdict(self)
        rv["fingerprints"] = None
        rv["destination_id"] = None
        rv["replacement"]["type"] = _REPLACEMENT_TYPE_LABELS[type(self.replacement)]
        return rv


@dataclass(frozen=True)
class InitialUnmergeArgs(UnmergeArgsBase):
    # In tests the destination task is passed in explicitly from the outside,
    # so we support unmerging into an existing destination group. In production
    # this does not happen.
    destinations: InitialDestinations


@dataclass(frozen=True)
class SuccessiveUnmergeArgs(UnmergeArgsBase):
    last_event: Optional[Any]
    locked_primary_hashes: Collection[str]

    # unmerge may only start mutating data on a successive page, once it
    # actually has found an event that needs to be migrated.
    # (unmerge_key) -> (group_id, eventstream_state)
    destinations: Destinations

    # likewise unmerge may only find "source" events (events that should not be
    # migrated) on the second page, only then (and only once) it can reset
    # group attributes such as last_seen.
    source_fields_reset: bool


UnmergeArgs = Union[InitialUnmergeArgs, SuccessiveUnmergeArgs]
