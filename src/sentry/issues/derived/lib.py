"""
Core framework for the derived-data pipeline.
No Django dependencies — pure Python, fully testable in isolation.
"""

import copy
from collections.abc import Callable, Iterable, Iterator
from dataclasses import dataclass
from enum import Enum
from typing import Any, Protocol, runtime_checkable

_MISSING = object()


# ---------------------------------------------------------------------------
# Codec
# ---------------------------------------------------------------------------


class Codec[T]:
    """Handles serialization of a Feature value to/from JSON-compatible form."""

    def dump(self, value: T) -> Any:
        return value

    def load(self, raw: Any) -> T:
        return raw


IDENTITY_CODEC: Codec[Any] = Codec()


class PydanticDictCodec(Codec[dict[str, Any]]):
    """Codec for dict[str, PydanticModel] values."""

    def __init__(self, model: type[Any]) -> None:
        self._model = model

    def dump(self, value: dict[str, Any]) -> dict[str, Any]:
        return {k: v.dict() for k, v in value.items()}

    def load(self, raw: dict[str, Any]) -> dict[str, Any]:
        return {k: self._model(**v) for k, v in raw.items()}


class FrozenSetCodec(Codec[frozenset[str]]):
    """Codec for frozenset[str] — stored as a JSON list."""

    def dump(self, value: frozenset[str]) -> list[str]:
        return sorted(value)

    def load(self, raw: list[str]) -> frozenset[str]:
        return frozenset(raw)


# ---------------------------------------------------------------------------
# Feature
# ---------------------------------------------------------------------------

FeatureEntry = tuple["Feature[Any]", Any]


class Feature[T]:
    """A named, typed slot in derived state with a default value.

    The `codec` handles conversion to/from JSON-compatible representations.
    Defaults to identity (pass-through) for JSON-native types.
    """

    def __init__(
        self,
        name: str,
        *,
        default: Any = _MISSING,
        default_factory: Callable[[], Any] | None = None,
        codec: Codec[T] | None = None,
    ) -> None:
        if default is _MISSING and default_factory is None:
            raise ValueError("Must provide default or default_factory")
        self.name = name
        self._default = default
        self._default_factory = default_factory
        self._codec = codec or IDENTITY_CODEC
        self._hash = hash(name)

    def initial_value(self) -> T:
        if self._default_factory is not None:
            return self._default_factory()
        return self._default

    def dump(self, value: T) -> Any:
        return self._codec.dump(value)

    def load(self, raw: Any) -> T:
        return self._codec.load(raw)

    def value(self, val: T) -> FeatureEntry:
        return (self, val)

    def __repr__(self) -> str:
        return f"Feature({self.name!r})"

    def __hash__(self) -> int:
        return self._hash

    def __eq__(self, other: object) -> bool:
        if isinstance(other, Feature):
            return self.name == other.name
        return NotImplemented


# ---------------------------------------------------------------------------
# State
# ---------------------------------------------------------------------------


class _FieldStore:
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


class StateUpdate(_FieldStore):
    """Partial state produced by an aggregator, to be merged into a State."""

    def __repr__(self) -> str:
        return f"StateUpdate({{{', '.join(f'{f.name}: {v!r}' for f, v in self._data.items())}}})"


class State(_FieldStore):
    """Complete pipeline state."""

    def view(self, allowed: frozenset[Feature[Any]]) -> "StateView":
        return StateView(self._data, allowed)

    def merge(self, update: StateUpdate) -> None:
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

AggregatorFn = Callable[[StateView, Any], AggregatorResult]


def emit(*entries: FeatureEntry) -> AggregatorResult:
    return StateUpdate(dict(entries))


@dataclass(frozen=True)
class Aggregator:
    """A named function that reads from dep features and writes to output features."""

    name: str
    deps: tuple[Feature[Any], ...]
    outputs: tuple[Feature[Any], ...]
    fn: AggregatorFn
    scope: tuple[int, ...] | None = None


def aggregator(
    deps: tuple[Feature[Any], ...] = (),
    outputs: tuple[Feature[Any], ...] = (),
    scope: tuple[Enum, ...] | None = None,
) -> Callable[[AggregatorFn], Aggregator]:
    """Decorator to create an Aggregator. `scope` accepts enum members directly."""
    raw_scope = tuple(s.value for s in scope) if scope is not None else None

    def decorator(fn: AggregatorFn) -> Aggregator:
        return Aggregator(name=fn.__name__, deps=deps, outputs=outputs, fn=fn, scope=raw_scope)

    return decorator


# ---------------------------------------------------------------------------
# Pipeline
# ---------------------------------------------------------------------------


class Pipeline:
    def __init__(
        self,
        aggregators: Iterable[Aggregator],
        *,
        version: int,
        check_mutations: bool = False,
    ) -> None:
        self._version = version
        self._check_mutations = check_mutations
        aggregators = tuple(aggregators)
        self._aggregators, self._fields = _validate_and_sort(aggregators)
        self._steps = tuple(
            (agg, frozenset({*agg.deps, *agg.outputs}), frozenset(agg.outputs))
            for agg in self._aggregators
        )

    @property
    def version(self) -> int:
        return self._version

    @property
    def aggregators(self) -> tuple[Aggregator, ...]:
        return self._aggregators

    @property
    def fields(self) -> tuple[Feature[Any], ...]:
        return self._fields

    def initial_state(self) -> State:
        return State({f: f.initial_value() for f in self._fields})

    def step(self, state: State, entry: HasType) -> State:
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

    def run(self, entries: Iterable[HasType], state: State | None = None) -> State:
        if state is None:
            state = self.initial_state()
        for entry in entries:
            state = self.step(state, entry)
        return state


def resolve(
    targets: Iterable[Feature[Any]],
    registry: Iterable[Aggregator],
) -> list[Aggregator]:
    """Given desired output fields, return the minimal set of aggregators needed."""
    by_output: dict[Feature[Any], Aggregator] = {}
    all_aggs = list(registry)
    for agg in all_aggs:
        for field in agg.outputs:
            by_output[field] = agg

    needed: set[str] = set()
    stack = list(targets)
    while stack:
        field = stack.pop()
        if field not in by_output:
            raise ValueError(f"No aggregator produces {field.name!r}")
        agg = by_output[field]
        if agg.name not in needed:
            needed.add(agg.name)
            stack.extend(agg.deps)

    return [agg for agg in all_aggs if agg.name in needed]


def _validate_and_sort(
    aggregators: tuple[Aggregator, ...],
) -> tuple[tuple[Aggregator, ...], tuple[Feature[Any], ...]]:
    output_owners: dict[str, Aggregator] = {}
    for agg in aggregators:
        for field in agg.outputs:
            if field.name in output_owners:
                other = output_owners[field.name]
                raise ValueError(
                    f"Feature {field.name!r} is output by both {other.name!r} and {agg.name!r}"
                )
            output_owners[field.name] = agg

    for agg in aggregators:
        for dep in agg.deps:
            if dep.name not in output_owners:
                raise ValueError(
                    f"Aggregator {agg.name!r} depends on {dep.name!r}, "
                    f"which is not output by any aggregator in the pipeline"
                )

    agg_by_name: dict[str, Aggregator] = {a.name: a for a in aggregators}
    predecessors: dict[str, set[str]] = {a.name: set() for a in aggregators}
    successors: dict[str, set[str]] = {a.name: set() for a in aggregators}

    for agg in aggregators:
        for dep in agg.deps:
            producer = output_owners[dep.name]
            if producer.name != agg.name:
                predecessors[agg.name].add(producer.name)
                successors[producer.name].add(agg.name)

    queue: list[str] = [name for name, preds in predecessors.items() if not preds]
    order: list[Aggregator] = []

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

    all_fields: dict[str, Feature[Any]] = {}
    for agg in aggregators:
        for f in (*agg.deps, *agg.outputs):
            all_fields[f.name] = f

    return tuple(order), tuple(all_fields.values())
