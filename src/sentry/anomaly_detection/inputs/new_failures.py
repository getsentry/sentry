"""Discover new error issue families and their distinct-user crossings."""

from __future__ import annotations

import math
from collections import defaultdict
from collections.abc import Iterator, Mapping, Sequence
from datetime import UTC, datetime, timedelta
from statistics import median
from typing import TYPE_CHECKING

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

_REFERRER = "anomaly-detection.enrich"
_ISSUE_LIFETIME = timedelta(hours=1)
_MAX_NEW_GROUPS = 100  # candidate groups per project
_MAX_NEW_ISSUE_TITLES = 25  # Queried titles per project and environment.
_ISSUE_USER_PAGE_SIZE = 10_000  # SnQL limits each page to 10,000 rows.
_MIN_NEW_USERS = 10


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
    changes: list[ChangeEvent] = []
    if start >= end:
        return changes
    current_environments: dict[str, set[str]] = defaultdict(set)
    for minute, signal, metric, project_id, env, dimension, value in current_rows:
        if (
            start <= _utc(minute) < end
            and signal == "errors"
            and metric == "count()"
            and not dimension
            and value is not None
            and value > 0
        ):
            current_environments[project_id].add(env)
    for project_id, project in projects_by_id.items():
        environments = sorted(current_environments.get(project_id, ()))[:MAX_ENVIRONMENTS]
        if not environments:
            continue
        oldest = start - _ISSUE_LIFETIME
        groups = list(
            Group.objects.filter(
                project_id=project.id,
                type=ErrorGroupType.type_id,
                first_seen__gte=oldest.replace(tzinfo=UTC),
                first_seen__lt=end.replace(tzinfo=UTC),
            ).order_by("-first_seen", "id")[:_MAX_NEW_GROUPS]
        )
        if not groups:
            continue
        groups_by_id = {group.id: group for group in groups}
        group_id = Column("group_id")
        for env in environments:
            threshold = thresholds.get((project_id, env), float(_MIN_NEW_USERS))
            if not math.isfinite(threshold) or threshold <= 0:
                threshold = float(_MIN_NEW_USERS)
            conditions = [Condition(_error_env(), Op.EQ, env)]
            candidates = _run_errors(
                organization,
                Query(
                    match=Entity("events"),
                    select=[Function("uniq", [Column(ERROR_USER)], "users"), Function("count", [])],
                    groupby=[group_id],
                    where=[
                        *_error_where(project, oldest, end),
                        *conditions,
                        Condition(group_id, Op.IN, list(groups_by_id)),
                    ],
                    limit=Limit(_MAX_NEW_GROUPS + 1),
                ),
                _REFERRER,
            )
            issue_groups_by_title: dict[str, list[tuple[Group, float, float]]] = defaultdict(list)
            for row in candidates:
                group = groups_by_id.get(row["group_id"])
                estimate = _number(row.get("users"))
                count = _number(row.get("count()"))
                if group is None or estimate is None or count is None:
                    continue
                # Keep same-title fragments together, but compute their actual
                # joint audience from the events (never sum users to trigger).
                title = (
                    group.title
                    if group.data and ("title" in group.data or "metadata" in group.data)
                    else group.message
                )
                issue_groups_by_title[title].append((group, estimate, count))
            titles_by_impact = sorted(
                issue_groups_by_title.items(),
                key=lambda entry: (-sum(users for _, users, _ in entry[1]), entry[0]),
            )
            for title, members in titles_by_impact[:_MAX_NEW_ISSUE_TITLES]:
                if sum(count for _, _, count in members) < min(threshold, _MIN_NEW_USERS):
                    continue
                members.sort(key=lambda member: (member[0].first_seen, member[0].id))
                first_group = members[0][0]
                first_seen = _utc(first_group.first_seen)
                window_end = min(first_seen + _ISSUE_LIFETIME, end)
                if window_end <= start:
                    continue
                ids = tuple(group.id for group, _, _ in members)
                cutoffs = (
                    (float(_MIN_NEW_USERS), threshold)
                    if threshold > _MIN_NEW_USERS
                    else (threshold,)
                )
                first_user_times = _first_user_times(
                    organization,
                    [
                        *_error_where(
                            project, first_seen.replace(second=0, microsecond=0), window_end
                        ),
                        *conditions,
                        Condition(group_id, Op.IN, list(ids)),
                    ],
                    math.ceil(cutoffs[-1]),
                )
                for cutoff, crossed_at, users in _crossings(first_user_times, cutoffs):
                    if not start <= crossed_at < window_end:
                        continue
                    confirmed = cutoff == threshold
                    changes.append(
                        ChangeEvent(
                            key=SeriesKey(
                                project_id,
                                env,
                                "new_issue",
                                "count_unique(user)",
                                str(first_group.id),
                            ),
                            change_type=ChangeType.NEW_FAILURE_MODE,
                            start=first_seen.replace(second=0, microsecond=0),
                            actual=users,
                            expected=threshold,
                            confidence=0.9 if confirmed else 0.5,
                            detected_at=crossed_at.replace(second=0, microsecond=0)
                            + timedelta(minutes=1),
                            peak_ratio=users / threshold,
                            evidence=[title[:200]],
                            issue_ids=ids,
                        )
                    )
    return sorted(changes, key=lambda change: (change.detected_at or change.start, change.key))


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
