"""
Core framework for the derived-data pipeline.
No Django dependencies — pure Python, fully testable in isolation.
"""

import base64
import copy
import hashlib
from collections.abc import Callable, Iterable, Iterator
from dataclasses import dataclass
from datetime import datetime
from enum import IntEnum, StrEnum
from typing import Any, ClassVar, Final, Protocol, runtime_checkable

_MISSING = object()


# ---------------------------------------------------------------------------
# Codec
# ---------------------------------------------------------------------------


class Codec[T]:
    """Converts a Feature's Python value to/from storage representations.

    Two pairs of methods handle different storage backends:

    * ``to_json`` / ``from_json`` — for the ``data`` JSONField blob.
    * ``to_column`` / ``from_column`` — for dedicated Django model columns.

    The default implementation is identity for both pairs.  Override as
    needed (e.g. ``EnumCodec`` wraps raw strings back into enum members
    on ``from_column`` so that column-loaded values are real enum instances).
    """

    def to_json(self, value: T) -> Any:
        return value

    def from_json(self, raw: Any) -> T:
        return raw

    def to_column(self, value: T) -> Any:
        return value

    def from_column(self, raw: Any) -> T:
        return raw


IDENTITY_CODEC: Codec[Any] = Codec()


class EnumCodec[E: StrEnum](Codec[E]):
    def __init__(self, enum_cls: type[E]) -> None:
        self._enum_cls = enum_cls

    def to_json(self, value: E) -> str:
        return value.value

    def from_json(self, raw: Any) -> E:
        return self._enum_cls(raw)

    def to_column(self, value: E) -> str:
        return value.value

    def from_column(self, raw: Any) -> E:
        return self._enum_cls(raw)


class DateTimeCodec(Codec[datetime]):
    def to_json(self, value: datetime) -> str:
        return value.isoformat()

    def from_json(self, raw: Any) -> datetime:
        return datetime.fromisoformat(raw)


class OptionalCodec[T](Codec[T | None]):
    def __init__(self, inner: Codec[T]) -> None:
        self._inner = inner

    def to_json(self, value: T | None) -> Any:
        return self._inner.to_json(value) if value is not None else None

    def from_json(self, raw: Any) -> T | None:
        return self._inner.from_json(raw) if raw is not None else None

    def to_column(self, value: T | None) -> Any:
        return self._inner.to_column(value) if value is not None else None

    def from_column(self, raw: Any) -> T | None:
        return self._inner.from_column(raw) if raw is not None else None


# ---------------------------------------------------------------------------
# Feature
# ---------------------------------------------------------------------------

FeatureEntry = tuple["Feature[Any]", Any]


class Feature[T]:
    """A named, typed slot in derived state with a default value.

    The ``codec`` handles conversion to/from storage representations.
    JSON-blob features use ``to_json`` / ``from_json``; column-backed
    features use ``to_column`` / ``from_column``.

    Increment ``version`` whenever the feature's aggregation logic changes
    meaningfully so that stale derived data can be detected.
    """

    def __init__(
        self,
        name: str,
        *,
        default: Any = _MISSING,
        default_factory: Callable[[], Any] | None = None,
        codec: Codec[T] | None = None,
        version: int = 0,
    ) -> None:
        if default is _MISSING and default_factory is None:
            raise ValueError("Must provide default or default_factory")
        self.name: Final[str] = name
        self._version: Final[int] = version
        self._default = default
        self._default_factory = default_factory
        self._codec = codec or IDENTITY_CODEC
        self._hash = hash((name, version))

    @property
    def content_id(self) -> str:
        """Versioned identifier for this feature, e.g. ``"view_count:0"``."""
        return f"{self.name}:{self._version}"

    def initial_value(self) -> T:
        if self._default_factory is not None:
            return self._default_factory()
        return self._default

    def to_json(self, value: T) -> Any:
        return self._codec.to_json(value)

    def from_json(self, raw: Any) -> T:
        return self._codec.from_json(raw)

    def to_column(self, value: T) -> Any:
        return self._codec.to_column(value)

    def from_column(self, raw: Any) -> T:
        return self._codec.from_column(raw)

    def value(self, val: T) -> FeatureEntry:
        return (self, val)

    def __repr__(self) -> str:
        if self._version:
            return f"Feature({self.name!r}, v={self._version})"
        return f"Feature({self.name!r})"

    def __hash__(self) -> int:
        return self._hash

    def __eq__(self, other: object) -> bool:
        if isinstance(other, Feature):
            return self.name == other.name and self._version == other._version
        return NotImplemented


# ---------------------------------------------------------------------------
# State
# ---------------------------------------------------------------------------


class _FeatureStore:
    """Type-safe mapping from Features to their values."""

    __slots__ = ("_data",)

    def __init__(self, data: dict[Feature[Any], Any] | None = None) -> None:
        self._data: dict[Feature[Any], Any] = data if data is not None else {}

    def __getitem__[T](self, key: Feature[T]) -> T:
        return self._data[key]

    def __setitem__[T](self, key: Feature[T], value: T) -> None:
        self._data[key] = value

    def __contains__(self, key: object) -> bool:
        return key in self._data

    def _undeclared(self, declared: frozenset[Feature[Any]]) -> set[Feature[Any]]:
        return {f for f in self._data if f not in declared}


class StateUpdate(_FeatureStore):
    """Partial state produced by an aggregator, to be merged into a State."""

    def __repr__(self) -> str:
        return f"StateUpdate({{{', '.join(f'{f.name}: {v!r}' for f, v in self._data.items())}}})"


class State(_FeatureStore):
    """Complete pipeline state."""

    def __init__(self, data: dict[Feature[Any], Any] | None = None) -> None:
        super().__init__(data)
        self._updated: set[Feature[Any]] = set()

    @property
    def updated(self) -> frozenset[Feature[Any]]:
        """Features that aggregators have provided updates for via merge()."""
        return frozenset(self._updated)

    def view(self, allowed: frozenset[Feature[Any]]) -> "StateView":
        return StateView(self._data, allowed)

    def merge(self, update: StateUpdate) -> None:
        self._updated.update(update._data)
        self._data.update(update._data)

    def items(self) -> Iterator[tuple[str, Any]]:
        return ((f.name, v) for f, v in self._data.items())

    def __repr__(self) -> str:
        return f"State({{{', '.join(f'{f.name}: {v!r}' for f, v in self._data.items())}}})"


class StateView:
    """Read-only view of a State restricted to a declared set of features.

    Retrieved values must never be mutated.
    """

    __slots__ = ("_data", "_allowed")

    def __init__(self, data: dict[Feature[Any], Any], allowed: frozenset[Feature[Any]]) -> None:
        self._data = data
        self._allowed = allowed

    def __getitem__[T](self, key: Feature[T]) -> T:
        if key not in self._allowed:
            raise KeyError(f"Feature {key.name!r} is not accessible in this view")
        return self._data[key]

    def __contains__(self, key: object) -> bool:
        return key in self._allowed and key in self._data

    def __repr__(self) -> str:
        names = sorted(f.name for f in self._allowed)
        return f"StateView({names})"


# ---------------------------------------------------------------------------
# Entry protocol
# ---------------------------------------------------------------------------


@runtime_checkable
class HasType(Protocol):
    @property
    def type(self) -> int: ...


# ---------------------------------------------------------------------------
# Aggregator
# ---------------------------------------------------------------------------

AggregatorResult = StateUpdate | None
"""The return type of an aggregator: a StateUpdate if features changed, None otherwise."""

type AggregatorFn[E: HasType] = Callable[[StateView, E], AggregatorResult]


def emit(*entries: FeatureEntry) -> AggregatorResult:
    """Build a StateUpdate from one or more feature assignments.

    >>> return emit(VIEW_COUNT.value(5), STATUS.value(IssueStatus.CLOSED))
    """
    if not entries:
        return None
    return StateUpdate(dict(entries))


@dataclass(frozen=True)
class Aggregator[E: HasType]:
    """A named function that reads from dep features and writes to output features."""

    name: str
    deps: tuple[Feature[Any], ...]
    outputs: tuple[Feature[Any], ...]
    fn: AggregatorFn[E]
    scope: tuple[int, ...] | None = None


class _HasGetType(Protocol):
    @classmethod
    def get_type(cls) -> IntEnum: ...


type ScopeItem = IntEnum | type[_HasGetType]


def _scope_int(item: ScopeItem) -> int:
    if isinstance(item, IntEnum):
        return item.value
    return item.get_type().value


def aggregator[E: HasType](
    outputs: tuple[Feature[Any], ...],
    *,
    deps: tuple[Feature[Any], ...] = (),
    scope: tuple[ScopeItem, ...] | None = None,
) -> Callable[[AggregatorFn[E]], Aggregator[E]]:
    """Decorator to create an Aggregator. `scope` accepts enum members or classes with get_type()."""
    if not outputs:
        raise ValueError("aggregator must declare at least one output")
    raw_scope = tuple(_scope_int(s) for s in scope) if scope is not None else None

    def decorator(fn: AggregatorFn[E]) -> Aggregator[E]:
        return Aggregator(name=fn.__name__, deps=deps, outputs=outputs, fn=fn, scope=raw_scope)

    return decorator


# ---------------------------------------------------------------------------
# Pipeline
# ---------------------------------------------------------------------------


class Pipeline[E: HasType]:
    """Applies a set of Aggregators to a State for each event in a sequence, producing a new State."""

    # Bump this manually when pipeline behaviour changes in ways that affect
    # results but the feature set itself is unchanged (e.g. changing
    # aggregator execution order). This value is an input to pipeline_hash.
    _version: ClassVar[int] = 0

    def __init__(
        self,
        aggregators: Iterable[Aggregator[E]],
        *,
        check_mutations: bool = False,
    ) -> None:
        self._check_mutations = check_mutations
        aggregators = tuple(aggregators)
        self._aggregators, self._features = _validate_and_sort(aggregators)
        self._steps = tuple(
            (agg, frozenset({*agg.deps, *agg.outputs}), frozenset(agg.outputs))
            for agg in self._aggregators
        )
        payload = f"{self._version}:" + ",".join(sorted(f.content_id for f in self._features))
        digest = hashlib.blake2b(payload.encode(), digest_size=8).digest()
        self._pipeline_hash = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()

    @property
    def aggregators(self) -> tuple[Aggregator[E], ...]:
        return self._aggregators

    @property
    def features(self) -> tuple[Feature[Any], ...]:
        return self._features

    @property
    def pipeline_hash(self) -> str:
        """Short digest capturing the pipeline version, feature set, and feature versions."""
        return self._pipeline_hash

    def initial_state(self) -> State:
        return State({f: f.initial_value() for f in self._features})

    def step(self, state: State, entry: E) -> State:
        entry_type = entry.type
        for agg, view_fields, output_fields in self._steps:
            if agg.scope is not None and entry_type not in agg.scope:
                continue
            subset = state.view(view_fields)
            snapshot = copy.deepcopy(subset._data) if self._check_mutations else None
            result = agg.fn(subset, entry)
            if snapshot is not None:
                for f, original in snapshot.items():
                    if f in view_fields and subset._data[f] != original:
                        raise RuntimeError(
                            f"Aggregator {agg.name!r} mutated feature {f.name!r} in place"
                        )
            if result is not None:
                undeclared = result._undeclared(output_fields)
                if undeclared:
                    names = {f.name for f in undeclared}
                    raise ValueError(
                        f"Aggregator {agg.name!r} produced undeclared outputs: {names}"
                    )
                state.merge(result)
        return state

    def run(self, entries: Iterable[E], state: State | None = None) -> State:
        if state is None:
            state = self.initial_state()
        for entry in entries:
            state = self.step(state, entry)
        return state


def resolve[E: HasType](
    targets: Iterable[Feature[Any]],
    registry: Iterable[Aggregator[E]],
) -> list[Aggregator[E]]:
    """Given desired output features, return the minimal set of aggregators needed."""
    by_output: dict[Feature[Any], Aggregator[E]] = {}
    all_aggs = list(registry)
    for agg in all_aggs:
        for feature in agg.outputs:
            by_output[feature] = agg

    needed: set[str] = set()
    stack = list(targets)
    while stack:
        feature = stack.pop()
        if feature not in by_output:
            raise ValueError(f"No aggregator produces {feature.name!r}")
        agg = by_output[feature]
        if agg.name not in needed:
            needed.add(agg.name)
            stack.extend(agg.deps)

    return [agg for agg in all_aggs if agg.name in needed]


def _ensure_no_aliasing(features: Iterable[Feature[Any]]) -> tuple[Feature[Any], ...]:
    """Return the unique features, raising if the same name maps to different instances."""
    seen: dict[str, Feature[Any]] = {}
    for f in features:
        existing = seen.get(f.name)
        if existing is not None and existing is not f:
            raise ValueError(
                f"Feature {f.name!r} has multiple distinct instances in the pipeline; "
                f"use the same Feature object everywhere"
            )
        seen[f.name] = f
    return tuple(seen.values())


def _validate_and_sort[E: HasType](
    aggregators: tuple[Aggregator[E], ...],
) -> tuple[tuple[Aggregator[E], ...], tuple[Feature[Any], ...]]:
    output_owners: dict[str, Aggregator[E]] = {}
    for agg in aggregators:
        for feature in agg.outputs:
            if feature.name in output_owners:
                other = output_owners[feature.name]
                raise ValueError(
                    f"Feature {feature.name!r} is output by both {other.name!r} and {agg.name!r}"
                )
            output_owners[feature.name] = agg

    for agg in aggregators:
        for dep in agg.deps:
            if dep.name not in output_owners:
                raise ValueError(
                    f"Aggregator {agg.name!r} depends on {dep.name!r}, "
                    f"which is not output by any aggregator in the pipeline"
                )

    agg_by_name: dict[str, Aggregator[E]] = {a.name: a for a in aggregators}
    predecessors: dict[str, set[str]] = {a.name: set() for a in aggregators}
    successors: dict[str, set[str]] = {a.name: set() for a in aggregators}

    for agg in aggregators:
        for dep in agg.deps:
            producer = output_owners[dep.name]
            if producer.name != agg.name:
                predecessors[agg.name].add(producer.name)
                successors[producer.name].add(agg.name)

    queue: list[str] = [name for name, preds in predecessors.items() if not preds]
    order: list[Aggregator[E]] = []

    while queue:
        queue.sort()
        name = queue.pop(0)
        order.append(agg_by_name[name])
        for succ in successors[name]:
            predecessors[succ].discard(name)
            if not predecessors[succ]:
                queue.append(succ)

    if len(order) != len(aggregators):
        remaining = {a.name for a in aggregators} - {a.name for a in order}
        raise ValueError(f"Cycle detected among aggregators: {remaining}")

    all_features = _ensure_no_aliasing(f for agg in aggregators for f in (*agg.deps, *agg.outputs))

    return tuple(order), all_features
