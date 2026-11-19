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

from sentry.anomaly_detection.contracts import (
    ChangeEvent,
    ChangeType,
    Metric,
    SeriesKey,
    SeriesRow,
    Service,
    Signal,
)
from sentry.anomaly_detection.inputs.measurements import (
    ERROR_USER,
    MAX_ENVIRONMENTS,
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
_MINUTE = timedelta(minutes=1)
_HOUR = timedelta(hours=1)
# The scheduler collects 16 days ending at the poll's latest closed hour. Leave
# enough history to use the same trailing window during warmup and issue replay.
_THRESHOLD_LOOKBACK = timedelta(days=15)
_MAX_NEW_GROUPS = 100  # candidate groups per project
_MAX_NEW_ISSUE_TITLES = 25  # Queried titles per project and environment.
_ISSUE_USER_PAGE_SIZE = 10_000  # SnQL limits each page to 10,000 rows.
_MIN_NEW_USERS = 10


def _hour_floor(timestamp: datetime) -> datetime:
    return timestamp.replace(minute=0, second=0, microsecond=0)


def _observed_at(timestamp: datetime) -> datetime:
    return timestamp.replace(second=0, microsecond=0) + _MINUTE


class NewFailureThresholds:
    def __init__(self, samples: Mapping[Service, Sequence[tuple[datetime, float]]]) -> None:
        self._samples = samples
        self._thresholds: dict[tuple[Service, datetime], float] = {}

    def at(self, scope: Service, observation_end: datetime) -> float:
        """Scale the threshold using only buckets closed at observation_end."""
        end = _hour_floor(_utc(observation_end))
        key = scope, end
        if key not in self._thresholds:
            start = end - _THRESHOLD_LOOKBACK
            values = [value for hour, value in self._samples.get(scope, ()) if start <= hour < end]
            self._thresholds[key] = (
                max(float(_MIN_NEW_USERS), 0.05 * median(values))
                if values
                else float(_MIN_NEW_USERS)
            )
        return self._thresholds[key]

    def falling_scopes(self, start: datetime, end: datetime) -> Iterator[Service]:
        """Find environments where existing users can cross without a new error."""
        boundary = _hour_floor(start) + _HOUR
        while boundary <= end:
            for scope in self._samples:
                if math.ceil(self.at(scope, boundary)) < math.ceil(
                    self.at(scope, boundary - _HOUR)
                ):
                    yield scope
            boundary += _HOUR


class _ThresholdWindow(NamedTuple):
    start: datetime
    end: datetime
    threshold: float


@dataclass(frozen=True)
class _FailureScope:
    project: Project
    environment: str
    start: datetime
    end: datetime
    thresholds: NewFailureThresholds | Mapping[Service, float]

    def threshold_windows(self, start: datetime, end: datetime) -> Iterator[_ThresholdWindow]:
        key = Service(self.project.id, self.environment)
        if not isinstance(self.thresholds, NewFailureThresholds):
            threshold = self.thresholds.get(key, float(_MIN_NEW_USERS))
            if not math.isfinite(threshold) or threshold <= 0:
                threshold = float(_MIN_NEW_USERS)
            yield _ThresholdWindow(start, end, threshold)
            return

        while start < end:
            stop = min(_hour_floor(start) + _HOUR, end)
            yield _ThresholdWindow(start, stop, self.thresholds.at(key, start))
            start = stop


class _IssueCandidate(NamedTuple):
    group: Group
    estimated_users: float
    event_count: float


class _IssueCrossing(NamedTuple):
    detected_at: datetime
    threshold: float
    users: int


def new_failure_thresholds(hourly_rows: Sequence[SeriesRow]) -> NewFailureThresholds:
    samples: dict[Service, list[tuple[datetime, float]]] = defaultdict(list)
    for row in hourly_rows:
        if (
            row.signal == Signal.ERRORS
            and row.metric == Metric.COUNT_UNIQUE_USER
            and not row.dim_value
            and (sample := _number(row.value)) is not None
        ):
            samples[Service(row.project_id, row.env)].append((_utc(row.ts), sample))
    return NewFailureThresholds(samples)


def collect_new_failure_modes(
    organization: Organization,
    projects: Sequence[Project],
    thresholds: NewFailureThresholds | Mapping[Service, float],
    start: datetime,
    end: datetime,
    *,
    current_rows: Sequence[SeriesRow],
) -> list[ChangeEvent]:
    """Find issue milestones observable at minute closes in (start, end]."""
    projects_by_id = _project_map(organization, projects)
    start, end = _utc(start), _utc(end)
    if start >= end:
        return []

    active_environments = _active_error_environments(current_rows, start, end)
    boundary_environments: dict[int, set[str]] = defaultdict(set)
    if isinstance(thresholds, NewFailureThresholds):
        for project_id, environment in thresholds.falling_scopes(start, end):
            boundary_environments[project_id].add(environment)
    changes: list[ChangeEvent] = []
    for project_id, project in projects_by_id.items():
        environments = set(sorted(active_environments.get(project_id, ()))[:MAX_ENVIRONMENTS])
        # Scopes from the bounded hourly snapshot supplement current errors;
        # a quiet scope's threshold change cannot displace an active scope.
        environments.update(boundary_environments.get(project_id, ()))
        if not environments:
            continue
        groups_by_id = _recent_error_groups(project, start, end)
        if not groups_by_id:
            continue
        for environment in sorted(environments):
            scope = _FailureScope(project, environment, start, end, thresholds)
            changes.extend(_collect_environment_failures(organization, scope, groups_by_id))
    return sorted(changes, key=lambda change: (change.detected_at or change.start, change.key))


def _active_error_environments(
    rows: Sequence[SeriesRow], start: datetime, end: datetime
) -> dict[int, set[str]]:
    environments_by_project: dict[int, set[str]] = defaultdict(set)
    for row in rows:
        if (
            start <= _utc(row.ts) < end
            and row.signal == Signal.ERRORS
            and row.metric == Metric.COUNT
            and not row.dim_value
            and row.value is not None
            and row.value > 0
        ):
            environments_by_project[row.project_id].add(row.env)
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
    ordered_members = sorted(members, key=lambda member: (member.group.first_seen, member.group.id))
    first_group = ordered_members[0].group
    first_seen = _utc(first_group.first_seen)
    window_end = min(first_seen + _ISSUE_LIFETIME, scope.end)
    if window_end <= scope.start:
        return

    first_minute = first_seen.replace(second=0, microsecond=0)
    issue_ids = tuple(member.group.id for member in ordered_members)
    # Replay from issue onset, not the current poll's start. A prior crossing
    # must not become a new crossing just because the threshold changed.
    last_observation = _observed_at(window_end - datetime.resolution)
    windows = tuple(scope.threshold_windows(first_minute + _MINUTE, last_observation + _MINUTE))
    max_threshold = max(window.threshold for window in windows)
    if sum(member.event_count for member in members) < min(max_threshold, _MIN_NEW_USERS):
        return
    first_user_times = _first_user_times(
        organization,
        [
            *_error_where(scope.project, first_minute, window_end),
            Condition(_error_env(), Op.EQ, scope.environment),
            Condition(Column("group_id"), Op.IN, list(issue_ids)),
        ],
        math.ceil(max_threshold),
    )
    for detected_at, threshold, users in _crossings(first_user_times, windows):
        if not scope.start < detected_at <= scope.end:
            continue
        yield ChangeEvent(
            key=SeriesKey(
                scope.project.id,
                scope.environment,
                Signal.NEW_ISSUE,
                Metric.COUNT_UNIQUE_USER,
                str(first_group.id),
            ),
            change_type=ChangeType.NEW_FAILURE_MODE,
            start=first_minute,
            actual=users,
            expected=threshold,
            confidence=0.9 if users >= threshold else 0.5,
            detected_at=detected_at,
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
    first_user_times: Iterator[datetime], windows: Sequence[_ThresholdWindow]
) -> Iterator[_IssueCrossing]:
    users = 0
    weak = strong = None
    observations = map(_observed_at, first_user_times)
    observed_at = next(observations, None)
    for start, end, threshold in windows:
        # The audience only grows, but a new hour can lower the threshold. It
        # can qualify the existing audience without any newly observed user.
        if users >= threshold:
            strong = _IssueCrossing(start, threshold, users)
            break
        while observed_at is not None and observed_at < end:
            users += 1
            if users >= threshold:
                strong = _IssueCrossing(observed_at, threshold, users)
                break
            if users == _MIN_NEW_USERS:
                weak = _IssueCrossing(observed_at, threshold, users)
            observed_at = next(observations, None)
        if strong is not None:
            break

    # Keep earlier weak evidence, but do not emit two milestones at the same tick.
    if weak is not None and (strong is None or weak.detected_at < strong.detected_at):
        yield weak
    if strong is not None:
        yield strong
