"""Discover new error issues by their distinct-user threshold crossings."""

from __future__ import annotations

import math
from collections import defaultdict
from collections.abc import Iterator, Mapping, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from statistics import median
from typing import TYPE_CHECKING, NamedTuple

from snuba_sdk import (
    Column,
    Condition,
    Direction,
    Entity,
    Function,
    Limit,
    Offset,
    Op,
    OrderBy,
    Query,
)

from sentry.anomaly_detection.contracts import ChangeEvent, ChangeType, SeriesKey
from sentry.anomaly_detection.inputs.measurements import (
    ERROR_USER,
    MAX_ENVIRONMENTS,
    Row,
    _error_env,
    _error_where,
    _number,
    _project_map,
    _run_errors,
    _utc,
)
from sentry.grouping.grouptype import ErrorGroupType
from sentry.models.group import Group

if TYPE_CHECKING:
    from sentry.models.organization import Organization
    from sentry.models.project import Project
    from sentry.search.events.types import SnubaRow

_REFERRER = "anomaly-detection.enrich"
_ISSUE_LIFETIME = timedelta(hours=1)
_MAX_NEW_GROUPS = 100  # candidate groups per project
_MAX_NEW_ISSUE_TITLES = 25  # Queried titles per project and environment.
_ISSUE_USER_PAGE_SIZE = 10_000  # SnQL limits each page to 10,000 rows.
_MIN_NEW_USERS = 10


@dataclass(frozen=True)
class _FailureScope:
    project: Project
    environment: str
    start: datetime
    end: datetime
    threshold: float


class _IssueCandidate(NamedTuple):
    group: Group
    estimated_users: float
    event_count: float


def new_failure_thresholds(hourly_rows: Sequence[Row]) -> dict[tuple[str, str], float]:
    """Scale the minimum affected-user threshold per project/environment."""
    samples: dict[tuple[str, str], list[float]] = defaultdict(list)
    for _, signal, metric, project, env, dimension, value in hourly_rows:
        if (
            signal == "errors"
            and metric == "count_unique(user)"
            and not dimension
            and value is not None
        ):
            samples[(project, env)].append(value)
    return {scope: max(_MIN_NEW_USERS, 0.05 * median(values)) for scope, values in samples.items()}


def collect_new_failure_modes(
    organization: Organization,
    projects: Sequence[Project],
    thresholds: Mapping[tuple[str, str], float],
    start: datetime,
    end: datetime,
    *,
    current_rows: Sequence[Row],
) -> list[ChangeEvent]:
    """Find new failure modes and weaker corroborating issues in [start, end)."""
    projects_by_id = _project_map(organization, projects)
    start, end = _utc(start), _utc(end)
    if start >= end:
        return []

    active_environments = _active_error_environments(current_rows, start, end)
    changes: list[ChangeEvent] = []
    for project_id, project in projects_by_id.items():
        environments = sorted(active_environments.get(project_id, ()))[:MAX_ENVIRONMENTS]
        if not environments:
            continue
        groups_by_id = _recent_error_groups(project, start, end)
        if not groups_by_id:
            continue
        for environment in environments:
            threshold = thresholds.get((project_id, environment), float(_MIN_NEW_USERS))
            if not math.isfinite(threshold) or threshold <= 0:
                threshold = float(_MIN_NEW_USERS)
            scope = _FailureScope(project, environment, start, end, threshold)
            changes.extend(_collect_environment_failures(organization, scope, groups_by_id))
    return sorted(changes, key=lambda change: (change.detected_at or change.start, change.key))


def _active_error_environments(
    rows: Sequence[Row], start: datetime, end: datetime
) -> dict[str, set[str]]:
    environments_by_project: dict[str, set[str]] = defaultdict(set)
    for minute, signal, metric, project_id, environment, dimension, value in rows:
        if (
            start <= _utc(minute) < end
            and signal == "errors"
            and metric == "count()"
            and not dimension
            and value is not None
            and value > 0
        ):
            environments_by_project[project_id].add(environment)
    return environments_by_project


def _recent_error_groups(project: Project, start: datetime, end: datetime) -> dict[int, Group]:
    groups = Group.objects.filter(
        project_id=project.id,
        type=ErrorGroupType.type_id,
        first_seen__gte=(start - _ISSUE_LIFETIME).replace(tzinfo=UTC),
        first_seen__lt=end.replace(tzinfo=UTC),
    ).order_by("-first_seen", "id")[:_MAX_NEW_GROUPS]
    return {group.id: group for group in groups}


def _collect_environment_failures(
    organization: Organization, scope: _FailureScope, groups_by_id: Mapping[int, Group]
) -> Iterator[ChangeEvent]:
    candidates = _run_errors(
        organization,
        Query(
            match=Entity("events"),
            select=[Function("uniq", [Column(ERROR_USER)], "users"), Function("count", [])],
            groupby=[Column("group_id")],
            where=[
                *_error_where(scope.project, scope.start - _ISSUE_LIFETIME, scope.end),
                Condition(_error_env(), Op.EQ, scope.environment),
                Condition(Column("group_id"), Op.IN, list(groups_by_id)),
            ],
            limit=Limit(_MAX_NEW_GROUPS + 1),
        ),
        _REFERRER,
    )
    issue_titles = _rank_issue_titles(candidates, groups_by_id)
    for title, members in issue_titles[:_MAX_NEW_ISSUE_TITLES]:
        yield from _collect_title_crossings(organization, scope, title, members)


def _rank_issue_titles(
    rows: Sequence[SnubaRow], groups_by_id: Mapping[int, Group]
) -> list[tuple[str, list[_IssueCandidate]]]:
    """Use estimated users to prioritize queries, never to decide a crossing."""
    issue_groups_by_title: dict[str, list[_IssueCandidate]] = defaultdict(list)
    for row in rows:
        group = groups_by_id.get(row["group_id"])
        estimated_users = _number(row.get("users"))
        event_count = _number(row.get("count()"))
        if group is None or estimated_users is None or event_count is None:
            continue
        has_structured_title = group.data and ("title" in group.data or "metadata" in group.data)
        title = group.title if has_structured_title else group.message
        issue_groups_by_title[title].append(_IssueCandidate(group, estimated_users, event_count))

    def estimated_impact(entry: tuple[str, list[_IssueCandidate]]) -> tuple[float, str]:
        title, members = entry
        return -sum(member.estimated_users for member in members), title

    return sorted(issue_groups_by_title.items(), key=estimated_impact)


def _collect_title_crossings(
    organization: Organization,
    scope: _FailureScope,
    title: str,
    members: Sequence[_IssueCandidate],
) -> Iterator[ChangeEvent]:
    if sum(member.event_count for member in members) < min(scope.threshold, _MIN_NEW_USERS):
        return
    ordered_members = sorted(members, key=lambda member: (member.group.first_seen, member.group.id))
    first_group = ordered_members[0].group
    first_seen = _utc(first_group.first_seen)
    window_end = min(first_seen + _ISSUE_LIFETIME, scope.end)
    if window_end <= scope.start:
        return

    first_minute = first_seen.replace(second=0, microsecond=0)
    issue_ids = tuple(member.group.id for member in ordered_members)
    threshold = scope.threshold
    cutoffs = (float(_MIN_NEW_USERS), threshold) if threshold > _MIN_NEW_USERS else (threshold,)
    first_user_times = _first_user_times(
        organization,
        [
            *_error_where(scope.project, first_minute, window_end),
            Condition(_error_env(), Op.EQ, scope.environment),
            Condition(Column("group_id"), Op.IN, list(issue_ids)),
        ],
        math.ceil(cutoffs[-1]),
    )
    for cutoff, crossed_at, users in _crossings(first_user_times, cutoffs):
        if not scope.start <= crossed_at < window_end:
            continue
        yield ChangeEvent(
            key=SeriesKey(
                str(scope.project.id),
                scope.environment,
                "new_issue",
                "count_unique(user)",
                str(first_group.id),
            ),
            change_type=ChangeType.NEW_FAILURE_MODE,
            start=first_minute,
            actual=users,
            expected=threshold,
            confidence=0.9 if cutoff == threshold else 0.5,
            detected_at=crossed_at.replace(second=0, microsecond=0) + timedelta(minutes=1),
            peak_ratio=users / threshold,
            evidence=[title[:200]],
            issue_ids=issue_ids,
        )


def _first_user_times(
    organization: Organization, conditions: list[Condition], users_needed: int
) -> Iterator[datetime]:
    # Deduplicate across all issues with this title before applying the limit: a flood
    # from one user must not hide later first occurrences from other users.
    user = Column(ERROR_USER)
    first_seen = Function("min", [Column("timestamp")], "first_seen")
    where = [*conditions, Condition(user, Op.NEQ, "")]
    for offset in range(0, users_needed, _ISSUE_USER_PAGE_SIZE):
        limit = min(users_needed - offset, _ISSUE_USER_PAGE_SIZE)
        rows = _run_errors(
            organization,
            Query(
                match=Entity("events"),
                select=[first_seen],
                where=where,
                groupby=[user],
                orderby=[
                    OrderBy(Column("first_seen"), Direction.ASC),
                    OrderBy(user, Direction.ASC),
                ],
                limit=Limit(limit),
                offset=Offset(offset) if offset else None,
            ),
            _REFERRER,
        )
        for row in rows:
            yield _utc(row["first_seen"])
        if len(rows) < limit:
            break


def _crossings(
    first_user_times: Iterator[datetime], cutoffs: tuple[float, ...]
) -> list[tuple[float, datetime, int]]:
    found: list[tuple[float, datetime, int]] = []
    for users, first_seen in enumerate(first_user_times, start=1):
        if users >= cutoffs[len(found)]:
            found.append((cutoffs[len(found)], first_seen, users))
            if len(found) == len(cutoffs):
                break
    # Skip redundant weak evidence if the strong crossing is observable in the
    # same minute, but never hide earlier evidence using later events.
    if len(found) == 2 and found[0][1].replace(second=0, microsecond=0) == found[1][1].replace(
        second=0, microsecond=0
    ):
        return found[1:]
    return found
