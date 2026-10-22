import typing
from collections.abc import Iterator, Mapping
from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel

from sentry.issues.action_log.types import FirstSeenAction, GroupAction, GroupActionType

# Existing payload fields with open-ended types. These are debt, not precedent (see the
# GroupAction docstring). Remove entries as fields get fixed shapes; never add to this.
OPEN_ENDED_FIELD_ALLOWLIST = frozenset(
    {
        "AutofixPrCreatedAction.pull_requests",
        "NewProcessingIssuesAction.issues",
        "SetEscalatingAction.expired_snooze",
        "SeerRCACompletedAction.root_cause",
        "SeerSolutionCompletedAction.solution",
        "SeerCodingCompletedAction.changes",
        "SeerPRCreatedAction.pull_requests",
        "SeerPRReadyForReviewAction.pull_requests",
    }
)

_OPEN_ENDED_TYPES: frozenset[Any] = frozenset({Any, object, dict, list, set, tuple, Mapping})
_OPEN_ENDED_ORIGINS: frozenset[Any] = frozenset({dict, Mapping})


def _is_open_ended(tp: Any) -> bool:
    if tp in _OPEN_ENDED_TYPES:
        return True
    if typing.get_origin(tp) in _OPEN_ENDED_ORIGINS:
        return True
    return any(_is_open_ended(arg) for arg in typing.get_args(tp))


def _nested_models(tp: Any) -> Iterator[type[BaseModel]]:
    if isinstance(tp, type) and issubclass(tp, BaseModel):
        yield tp
    for arg in typing.get_args(tp):
        yield from _nested_models(arg)


def _open_ended_fields(model: type[BaseModel], prefix: str, seen: set[type]) -> Iterator[str]:
    if model in seen:
        return
    seen.add(model)
    for name, field in model.__fields__.items():
        path = f"{prefix}.{name}"
        if _is_open_ended(field.outer_type_):
            yield path
        for nested in _nested_models(field.outer_type_):
            yield from _open_ended_fields(nested, path, seen)


def _all_open_ended_fields() -> set[str]:
    found: set[str] = set()
    for cls in GroupAction._registry.values():
        found.update(_open_ended_fields(cls, cls.__name__, set()))
    return found


def test_all_types_are_registered() -> None:
    missing = [member for member in GroupActionType if GroupAction.by_type(member) is None]
    assert missing == [], (
        f"GroupActionType members without a registered GroupAction subclass: "
        f"{[m.name for m in missing]}"
    )


def test_datetime_round_trips_through_json_dict() -> None:
    first_seen = datetime(2026, 10, 8, 19, 13, 56, 56000, tzinfo=UTC)
    data = FirstSeenAction(first_seen=first_seen).json_dict()

    assert data == {"first_seen": first_seen.isoformat()}
    assert FirstSeenAction(**data).first_seen == first_seen


def test_no_new_open_ended_fields() -> None:
    offenders = sorted(_all_open_ended_fields() - OPEN_ENDED_FIELD_ALLOWLIST)
    assert offenders == [], (
        f"GroupAction payload fields with open-ended types: {offenders}. Stored payloads "
        "must be interpretable from the schema alone; use a nested BaseModel, Literal, or "
        "enum instead. See the GroupAction docstring."
    )


def test_allowlist_has_no_stale_entries() -> None:
    stale = sorted(OPEN_ENDED_FIELD_ALLOWLIST - _all_open_ended_fields())
    assert stale == [], f"Remove fixed fields from OPEN_ENDED_FIELD_ALLOWLIST: {stale}"


def test_detects_open_ended_types() -> None:
    assert _is_open_ended(dict[str, int])
    assert _is_open_ended(list[dict[str, str]])
    assert _is_open_ended(int | dict[str, str] | None)
    assert _is_open_ended(list[object])
    assert _is_open_ended(Any)
    assert _is_open_ended(list)
    assert not _is_open_ended(int | None)
    assert not _is_open_ended(list[int])
    assert not _is_open_ended(typing.Literal["a", "b"])
    assert not _is_open_ended(GroupActionType)


def test_checks_nested_models() -> None:
    class Inner(BaseModel):
        blob: dict[str, str]

    class Outer(BaseModel):
        inners: list[Inner] | None = None

    assert list(_open_ended_fields(Outer, "Outer", set())) == ["Outer.inners.blob"]
