"""Discover new error issues by their distinct-user threshold crossings.

Users are observed by Snuba receive time, not client event time: a user counts
from the minute Sentry received their first event for the issue. A late or
buffered event is therefore observed by the run that covers its arrival rather
than backdated into an interval that was already published. As long as Snuba
holds every event received before a run's end (the scheduler waits out an
ingest delay before closing a minute), runs over adjacent intervals agree on
every past observation and report each crossing exactly once.
"""

from __future__ import annotations

import math
from collections import defaultdict
from collections.abc import Iterable, Iterator, Mapping, Sequence
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
from sentry.snuba.referrer import Referrer
from sentry.utils import metrics

if TYPE_CHECKING:
    from sentry.models.organization import Organization
    from sentry.models.project import Project

_REFERRER = Referrer.ANOMALY_DETECTION_ENRICH.value
_ISSUE_LIFETIME = timedelta(hours=1)
# A group starts a title's lifetime only if no group with that title was first
# seen in the lifetime before it. Lifetimes that can still cross start after
# (start - lifetime), so deciding them needs one more lifetime of history.
_GROUP_LOOKBACK = 2 * _ISSUE_LIFETIME
# Relay replaces event timestamps further than this ahead of receive time.
_MAX_FUTURE_SKEW = timedelta(minutes=1)
_MINUTE = timedelta(minutes=1)
_HOUR = timedelta(hours=1)
# The scheduler collects 16 days ending at the poll's latest closed hour. Leave
# enough history to use the same trailing window during warmup and issue replay.
_THRESHOLD_LOOKBACK = timedelta(days=15)
_MAX_NEW_GROUPS = 500  # Highest-volume candidate groups per project.
# Crossing query pages per run, spent on the titles with the most estimated
# users first. A title that does not fit is not evaluated for this interval,
# and a crossing it made in the interval is not reported: later runs only
# report crossings in their own interval.
_MAX_ISSUE_QUERIES = 50
_ISSUE_USER_PAGE_SIZE = 10_000  # SnQL limits each page to 10,000 rows.
_MIN_NEW_USERS = 10


def _hour_floor(timestamp: datetime) -> datetime:
    return timestamp.replace(minute=0, second=0, microsecond=0)


def _minute_floor(timestamp: datetime) -> datetime:
    return timestamp.replace(second=0, microsecond=0)


def _observed_at(timestamp: datetime) -> datetime:
    return _minute_floor(timestamp) + _MINUTE


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


class _TitleWindow(NamedTuple):
    """One lifetime of an issue title: its groups ordered by first seen."""

    title: str
    groups: tuple[Group, ...]

    @property
    def lead(self) -> Group:
        return self.groups[0]

    @property
    def onset(self) -> datetime:
        return _utc(self.lead.first_seen)


class _TitleCandidate(NamedTuple):
    scope: _FailureScope
    window: _TitleWindow
    members: tuple[Group, ...]  # Window groups with errors in the scope's environment.
    estimated_users: float
    event_count: float
    # Distinct users first received before the scope's start, from the member
    # with the most: a lower bound on the title's audience at that point.
    prior_users: float


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

    error_counts = _active_error_environments(current_rows, start, end)
    boundary_environments: dict[int, set[str]] = defaultdict(set)
    if isinstance(thresholds, NewFailureThresholds):
        for project_id, environment in thresholds.falling_scopes(start, end):
            boundary_environments[project_id].add(environment)
    candidates: list[_TitleCandidate] = []
    for project_id, project in projects_by_id.items():
        counts = error_counts.get(project_id, {})
        # Keep the busiest environments, so short-lived preview environments
        # cannot displace production.
        environments = set(sorted(counts, key=lambda env: (-counts[env], env))[:MAX_ENVIRONMENTS])
        # Scopes from the bounded hourly snapshot supplement current errors;
        # a quiet scope's threshold change cannot displace an active scope.
        environments.update(boundary_environments.get(project_id, ()))
        if not environments:
            continue
        windows = [
            window
            for window in _title_windows(_recent_error_groups(project, start, end))
            if window.onset + _ISSUE_LIFETIME > start
        ]
        if windows:
            candidates.extend(
                _title_candidates(
                    organization, project, sorted(environments), windows, thresholds, start, end
                )
            )

    candidates.sort(
        key=lambda candidate: (
            -candidate.estimated_users,
            candidate.scope.project.id,
            candidate.scope.environment,
            candidate.window.lead.id,
        )
    )
    changes: list[ChangeEvent] = []
    pages_left = _MAX_ISSUE_QUERIES
    unevaluated = 0
    for candidate in candidates:
        threshold_windows = _replay_windows(candidate)
        if threshold_windows is None:
            continue
        users_needed = math.ceil(max(window.threshold for window in threshold_windows))
        pages = math.ceil(users_needed / _ISSUE_USER_PAGE_SIZE)
        if pages > pages_left:
            unevaluated += 1
            continue
        pages_left -= pages
        changes.extend(
            _collect_title_crossings(organization, candidate, threshold_windows, users_needed)
        )
    if unevaluated:
        metrics.incr("anomaly_detection.new_failures.query_budget_exhausted", amount=unevaluated)
    return sorted(changes, key=lambda change: (change.detected_at or change.start, change.key))


def _active_error_environments(
    rows: Sequence[SeriesRow], start: datetime, end: datetime
) -> dict[int, dict[str, float]]:
    counts_by_project: dict[int, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    for row in rows:
        if (
            start <= _utc(row.ts) < end
            and row.signal == Signal.ERRORS
            and row.metric == Metric.COUNT
            and not row.dim_value
            and row.value is not None
            and row.value > 0
        ):
            counts_by_project[row.project_id][row.env] += row.value
    return counts_by_project


def _recent_error_groups(project: Project, start: datetime, end: datetime) -> list[Group]:
    groups = list(
        Group.objects.filter(
            project_id=project.id,
            type=ErrorGroupType.type_id,
            first_seen__gte=(start - _GROUP_LOOKBACK).replace(tzinfo=UTC),
            first_seen__lt=end.replace(tzinfo=UTC),
        ).order_by("-times_seen", "id")[: _MAX_NEW_GROUPS + 1]
    )
    if len(groups) > _MAX_NEW_GROUPS:
        # Prefer volume, so a burst of one-event groups cannot crowd out an incident.
        metrics.incr("anomaly_detection.new_failures.group_limit")
        del groups[_MAX_NEW_GROUPS:]
    return groups


def _issue_title(group: Group) -> str:
    has_structured_title = group.data and ("title" in group.data or "metadata" in group.data)
    return group.title if has_structured_title else group.message


def _title_windows(groups: Iterable[Group]) -> list[_TitleWindow]:
    """Partition groups into title lifetimes that every overlapping run agrees on.

    A group starts a lifetime unless its title had a group first seen within a
    lifetime before it, and groups first seen during a lifetime join it. Both
    rules look back at most one lifetime, so the onset and members of a lifetime
    that can still cross never depend on which older groups a run can see.
    """
    groups_by_title: dict[str, list[Group]] = defaultdict(list)
    for group in groups:
        groups_by_title[_issue_title(group)].append(group)

    windows: list[_TitleWindow] = []
    for title, title_groups in groups_by_title.items():
        title_groups.sort(key=lambda group: (group.first_seen, group.id))
        current: list[Group] = []
        previous: Group | None = None
        for group in title_groups:
            if current and group.first_seen < current[0].first_seen + _ISSUE_LIFETIME:
                current.append(group)
            else:
                if current:
                    windows.append(_TitleWindow(title, tuple(current)))
                # A title that kept recurring is not a new failure.
                recurring = (
                    previous is not None
                    and group.first_seen < previous.first_seen + _ISSUE_LIFETIME
                )
                current = [] if recurring else [group]
            previous = group
        if current:
            windows.append(_TitleWindow(title, tuple(current)))
    return windows


def _title_candidates(
    organization: Organization,
    project: Project,
    environments: list[str],
    windows: Sequence[_TitleWindow],
    thresholds: NewFailureThresholds | Mapping[Service, float],
    start: datetime,
    end: datetime,
) -> Iterator[_TitleCandidate]:
    windows_by_group = {group.id: window for window in windows for group in window.groups}
    user = Column(ERROR_USER)
    prior_user = Function(
        "and",
        [
            Function("less", [Column("received"), start.replace(tzinfo=UTC)]),
            Function("notEquals", [user, ""]),
        ],
    )
    rows = _run_errors(
        organization,
        Query(
            match=Entity("events"),
            select=[
                Function("uniq", [user], "users"),
                Function("count", []),
                Function("uniqExactIf", [user, prior_user], "prior_users"),
            ],
            groupby=[_error_env("env"), Column("group_id")],
            where=[
                # Every member event follows its group's first seen, and Relay
                # bounds how far an event's timestamp can lead its receipt.
                *_error_where(
                    project,
                    _minute_floor(min(window.onset for window in windows)),
                    end + _MAX_FUTURE_SKEW,
                ),
                Condition(Column("received"), Op.LT, end.replace(tzinfo=UTC)),
                Condition(_error_env(), Op.IN, environments),
                Condition(Column("group_id"), Op.IN, list(windows_by_group)),
            ],
            limit=Limit(len(environments) * len(windows_by_group)),
        ),
        _REFERRER,
    )
    stats: dict[tuple[str, int], tuple[float, float, float]] = {}
    for row in rows:
        environment = row.get("env")
        users = _number(row.get("users"))
        event_count = _number(row.get("count()"))
        prior_users = _number(row.get("prior_users"))
        if (
            environment not in environments
            or row.get("group_id") not in windows_by_group
            or users is None
            or event_count is None
            or prior_users is None
        ):
            continue
        stats[environment, row["group_id"]] = users, event_count, prior_users

    for environment in environments:
        scope = _FailureScope(project, environment, start, end, thresholds)
        for window in windows:
            members = [group for group in window.groups if (environment, group.id) in stats]
            if not members:
                continue
            member_stats = [stats[environment, group.id] for group in members]
            yield _TitleCandidate(
                scope,
                window,
                tuple(members),
                estimated_users=sum(users for users, _, _ in member_stats),
                event_count=sum(event_count for _, event_count, _ in member_stats),
                prior_users=max(prior for _, _, prior in member_stats),
            )


def _window_end(candidate: _TitleCandidate) -> datetime:
    return min(candidate.window.onset + _ISSUE_LIFETIME, candidate.scope.end)


def _replay_windows(candidate: _TitleCandidate) -> tuple[_ThresholdWindow, ...] | None:
    """Return the title's threshold windows, or None if it cannot cross in this run."""
    scope = candidate.scope
    first_minute = _minute_floor(candidate.window.onset)
    last_observation = _observed_at(_window_end(candidate) - datetime.resolution)
    # Replay from issue onset, not the current poll's start. A prior crossing
    # must not become a new crossing just because the threshold changed.
    windows = tuple(scope.threshold_windows(first_minute + _MINUTE, last_observation + _MINUTE))
    max_threshold = max(window.threshold for window in windows)
    if candidate.event_count < min(max_threshold, _MIN_NEW_USERS):
        return None
    # Users first received before start were observed by start. If they already
    # meet the threshold in force at start, an earlier run reported the crossing.
    if any(
        window.start <= scope.start < window.end and candidate.prior_users >= window.threshold
        for window in windows
    ):
        return None
    return windows


def _collect_title_crossings(
    organization: Organization,
    candidate: _TitleCandidate,
    windows: Sequence[_ThresholdWindow],
    users_needed: int,
) -> Iterator[ChangeEvent]:
    scope, window = candidate.scope, candidate.window
    first_minute = _minute_floor(window.onset)
    window_end = _window_end(candidate)
    issue_ids = tuple(group.id for group in candidate.members)
    first_user_times = _first_user_times(
        organization,
        [
            *_error_where(scope.project, first_minute, window_end + _MAX_FUTURE_SKEW),
            Condition(Column("received"), Op.LT, window_end.replace(tzinfo=UTC)),
            Condition(_error_env(), Op.EQ, scope.environment),
            Condition(Column("group_id"), Op.IN, list(issue_ids)),
        ],
        users_needed,
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
                str(window.lead.id),
            ),
            change_type=ChangeType.NEW_FAILURE_MODE,
            start=first_minute,
            actual=users,
            expected=threshold,
            confidence=0.9 if users >= threshold else 0.5,
            detected_at=detected_at,
            peak_ratio=users / threshold,
            evidence=[window.title[:200]],
            issue_ids=issue_ids,
        )


def _first_user_times(
    organization: Organization, conditions: list[Condition], users_needed: int
) -> Iterator[datetime]:
    # Deduplicate across all issues with this title before applying the limit: a flood
    # from one user must not hide later first occurrences from other users.
    user = Column(ERROR_USER)
    first_seen = Function("min", [Column("received")], "first_seen")
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
