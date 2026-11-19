"""Causal, per-organization anomaly evaluation and public decision projection."""

from bisect import bisect_right
from collections import defaultdict
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass, replace
from datetime import datetime, timedelta
from math import isfinite
from typing import Literal, NotRequired, TypedDict

from sentry.anomaly_detection.contracts import (
    AnomalyGroupKey,
    ChangeAction,
    ChangeEvent,
    ChangeType,
    EpisodeKey,
    Metric,
    SeriesKey,
    SeriesRow,
    Service,
    Signal,
    Urgency,
)
from sentry.anomaly_detection.correlation import shared_dependencies
from sentry.anomaly_detection.correlation.correlator import (
    ERROR_SIGNALS,
    Correlator,
    FootprintSource,
    GroupAction,
    episode_key,
)
from sentry.anomaly_detection.correlation.footprint import service_of
from sentry.anomaly_detection.evaluation.baseline import Baseline
from sentry.anomaly_detection.evaluation.novelty import Novelty, size_of
from sentry.anomaly_detection.evaluation.rate_shifts import RateShiftTracker
from sentry.anomaly_detection.evaluation.series import Series, build
from sentry.anomaly_detection.evaluation.series_history import SeriesHistory

_MINUTE = timedelta(minutes=1)
_HARM_WINDOW = timedelta(minutes=10)
_VOUCH_WINDOW = timedelta(minutes=30)
_POINT_LIFETIME = timedelta(minutes=30)
_CONTEXT_HORIZON = timedelta(hours=6)
_HARM_PROMOTES = frozenset({Signal.OUTBOUND_DB, Signal.OUTBOUND_HTTP})
_VOUCH_SIGNALS = frozenset({Signal.ERROR_RATE, Signal.FAILED_RATE, Signal.ERRORS})

# The root's signal as published; signals without a public description are "other".
PublicSignal = Signal | Literal["other"]


class AnomalyEvidence(TypedDict):
    """Occurrence evidence. Only project-scoped facts about the root change, never
    dimensions, other services or free-form issue evidence."""

    signal: PublicSignal
    change_type: ChangeType
    started_at: str  # ISO 8601, naive UTC.
    actual: NotRequired[float]
    expected: NotRequired[float]
    confidence: NotRequired[float]


@dataclass(frozen=True)
class AnomalyDecision:
    group_key: AnomalyGroupKey
    project_id: int
    timestamp: datetime
    urgency: Urgency
    is_resolved: bool
    title: str
    evidence: AnomalyEvidence
    env: str  # Empty means no environment.


def evaluate_org(
    *,
    rows: Sequence[SeriesRow],
    hourly_rows: Sequence[SeriesRow],
    start: datetime,
    end: datetime,
    footprints: FootprintSource,
    projects: Iterable[int],
    new_issues: Sequence[ChangeEvent] = (),
) -> Sequence[AnomalyDecision]:
    """Evaluate [start, end), using earlier minute rows to warm the model (naive UTC)."""
    return OrgEvaluator(footprints, projects=projects).advance(
        rows=rows, hourly_rows=hourly_rows, start=start, end=end, new_issues=new_issues
    )


class OrgEvaluator:
    """Own the shared streaming state for one organization's ordered evaluation windows."""

    def __init__(self, footprints: FootprintSource, *, projects: Iterable[int]) -> None:
        # Project IDs with an enabled detector, in a stable scoring order.
        self.projects: tuple[int, ...] = tuple(sorted(set(projects)))
        self.series: dict[SeriesKey, Series] = {}
        self.hourly: dict[SeriesKey, Series] = {}
        self.baseline = Baseline(self.hourly)
        self.series_history = SeriesHistory(self.series, self.baseline)
        self.rate_shifts = RateShiftTracker(self.series, self.baseline)
        self.corr = Correlator(footprints, series=self.series)
        self.novelty = Novelty()
        self.qualified: dict[AnomalyGroupKey, AnomalyDecision] = {}
        self.next_minute: datetime | None = None
        self.absorbed: dict[EpisodeKey, ChangeEvent] = {}
        self.next_look: dict[EpisodeKey, float] = {}
        self.harm: dict[Service, list[ChangeEvent]] = {}
        self.pending_issues: list[ChangeEvent] = []
        self.known_issues: list[ChangeEvent] = []
        self.point_closes: list[tuple[datetime, ChangeEvent]] = []

    def advance(
        self,
        *,
        rows: Sequence[SeriesRow],
        hourly_rows: Sequence[SeriesRow],
        start: datetime,
        end: datetime,
        new_issues: Sequence[ChangeEvent] = (),
    ) -> Sequence[AnomalyDecision]:
        if start.tzinfo is not None or end.tzinfo is not None:
            raise ValueError("Evaluation bounds must be naive UTC datetimes")
        if start >= end:
            return []

        # Insert a whole minute at a time. This keeps detection, novelty exposure and
        # quality exclusions causal, regardless of where polling batches are split.
        rows_by_minute: dict[datetime, list[SeriesRow]] = defaultdict(list)
        for row in rows:
            if (
                row.project_id in self.projects
                and row.ts < end
                and (self.next_minute is None or row.ts >= self.next_minute)
            ):
                rows_by_minute[row.ts].append(row)
        self._load_hourly_baselines(hourly_rows, end)
        self._queue_issues([event for event in new_issues if event.key.project_id in self.projects])

        first_publish_minute = _minute_ceiling(start)
        cold_start = self.next_minute is None
        first_issue_minute = first_publish_minute
        if self.pending_issues:
            first_issue_minute = _minute_ceiling(_available_at(self.pending_issues[0]))
        minute = self.next_minute or min(
            first_publish_minute,
            min(rows_by_minute, default=first_publish_minute),
            first_issue_minute,
        )
        while minute < first_publish_minute and minute < end:
            self._step(minute, rows_by_minute.pop(minute, ()))
            minute += _MINUTE

        decisions: list[AnomalyDecision] = []
        if cold_start and minute < end:
            # Publish the active state after processing the boundary tick, not a warmup
            # incident that resolves on the boundary or an intermediate severity.
            self._step(minute, rows_by_minute.pop(minute, ()))
            decisions.extend(
                replace(decision, timestamp=minute)
                for decision in self.qualified.values()
                if not decision.is_resolved
            )
            minute += _MINUTE
        while minute < end:
            decisions.extend(self._step(minute, rows_by_minute.pop(minute, ())))
            minute += _MINUTE
        self.next_minute = minute
        return decisions

    def _load_hourly_baselines(self, hourly_rows: Sequence[SeriesRow], end: datetime) -> None:
        scoped_rows = (
            row for row in hourly_rows if row.project_id in self.projects and row.ts < end
        )
        for key, hourly_values in build(scoped_rows).items():
            self.hourly.setdefault(key, {}).update(hourly_values)

    def _queue_issues(self, events: Sequence[ChangeEvent]) -> None:
        if not events:
            return
        # A low-impact vouch and a later standalone crossing are different milestones
        # of the same episode; only repeated reports of the same milestone are duplicates.
        seen = {
            (episode_key(event), _is_standalone_issue(event))
            for event in (*self.known_issues, *self.pending_issues)
        }
        for event in events:
            key = (episode_key(event), _is_standalone_issue(event))
            if event.change_type != ChangeType.NEW_FAILURE_MODE or key in seen:
                continue
            if self.next_minute and _available_at(event) < self.next_minute - _CONTEXT_HORIZON:
                continue
            seen.add(key)
            self.pending_issues.append(
                replace(event, evidence=list(event.evidence), ended_at=None, escalations=[])
            )
        self.pending_issues.sort(key=lambda event: (_available_at(event), episode_key(event)))

    def _step(self, minute: datetime, rows: Sequence[SeriesRow]) -> list[AnomalyDecision]:
        if minute.minute == 0:
            self._prune_context(minute)
            if minute.hour == 0:
                self.corr.shared = shared_dependencies.learn(
                    self.novelty.history, minute, coverage=self.novelty.coverage
                )

        candidates = self._evaluate_project_measurements(minute, rows)
        opened_changes = [event for kind, event in candidates if kind == "open"]
        self._note_harm(opened_changes)
        actions = self._judge(minute, candidates)

        # Issues are known only once their evidence is available, never at first seen.
        available_issue_count = bisect_right(self.pending_issues, minute, key=_available_at)
        available_issues = self.pending_issues[:available_issue_count]
        del self.pending_issues[:available_issue_count]
        self.known_issues.extend(available_issues)
        # The producer also supplies vouch-only issues below the standalone impact threshold.
        standalone_failures = [event for event in available_issues if _is_standalone_issue(event)]
        self._note_harm(standalone_failures)
        actions.extend(("open", event) for event in standalone_failures)
        self.point_closes.extend((minute + _POINT_LIFETIME, event) for event in standalone_failures)
        actions.extend(self._promote(minute, opened_changes, standalone_failures))
        # Size and duration both use the same prior, even for peers whose opens
        # are backdated. Record only the original detector opens, not promotions.
        for event in opened_changes:
            self.novelty.record(event)

        # A new failure mode is a point observation. Other members, if any, still
        # hold its group open until they end.
        due_close_count = bisect_right(self.point_closes, minute, key=lambda item: item[0])
        for _, event in self.point_closes[:due_close_count]:
            event.ended_at = minute
            actions.append(("close", event))
        del self.point_closes[:due_close_count]

        return self._decisions(self.corr.step(minute, actions))

    def _evaluate_project_measurements(
        self, minute: datetime, rows: Sequence[SeriesRow]
    ) -> list[ChangeAction]:
        rows_by_project: dict[int, list[SeriesRow]] = defaultdict(list)
        for row in rows:
            rows_by_project[row.project_id].append(row)

        candidates: list[ChangeAction] = []
        for project_id in self.projects:
            candidates.extend(
                self._evaluate_project(project_id, minute, rows_by_project.get(project_id, ()))
            )
        if len(self.projects) > 1 and len(candidates) > 1:
            # Keep the original scoring order across projects: series changes first,
            # then change points. Correlation can use this order to break ties.
            series_order = {key: index for index, key in enumerate(self.series_history.watched)}
            change_point_order = {key: index for index, key in enumerate(self.rate_shifts.watched)}

            def scoring_order(action: ChangeAction) -> tuple[int, int]:
                _, event = action
                if event.change_type == ChangeType.CHANGE_POINT:
                    return 1, change_point_order[event.key]
                return 0, series_order[event.key]

            candidates.sort(key=scoring_order)
        return candidates

    def _evaluate_project(
        self, project_id: int, minute: datetime, rows: Sequence[SeriesRow]
    ) -> list[ChangeAction]:
        history, change_points = self.series_history, self.rate_shifts
        measurements = build(rows)
        discovered_series = bool(measurements.keys() - history.series.keys())
        for key, values in measurements.items():
            history.series.setdefault(key, {}).update(values)
        if discovered_series:
            history.refresh(project_id=project_id)
            change_points.refresh(project_id=project_id)

        if minute.minute == 0:
            history.check_quality(minute, project_id=project_id)
            history.prune_pseudo(minute, project_id=project_id)

        for key in measurements:
            if history.has_novelty_observation(key, minute):
                self.novelty.observe(key, minute)

        changes: list[ChangeAction] = []
        for key, rule in history.watched.items():
            if key.project_id == project_id and (action := history.step_series(key, rule, minute)):
                changes.append(action)
        for key in change_points.watched:
            if key.project_id == project_id and (state := history.state.get(key)) and state.open:
                change_points.note_spike(state.open, minute)
        changes.extend(change_points.step(minute, project_id=project_id))
        return changes

    def _prune_context(self, minute: datetime) -> None:
        context_start = minute - _CONTEXT_HORIZON
        self.known_issues[:] = [
            issue for issue in self.known_issues if _available_at(issue) >= context_start
        ]
        for service, events in list(self.harm.items()):
            recent = [
                event
                for event in events
                if event.ended_at is None or event.ended_at >= context_start
            ]
            if recent:
                self.harm[service] = recent
            else:
                del self.harm[service]
        self.novelty.prune(minute)
        self.corr.prune(minute)
        retained = self.corr.state.open_groups.keys() | self.corr.state.closed_groups.keys()
        for group_key in self.qualified.keys() - retained:
            del self.qualified[group_key]

    def _note_harm(self, events: Sequence[ChangeEvent]) -> None:
        for event in events:
            if _is_harm(event):
                self.harm.setdefault(service_of(event.key), []).append(event)

    def _harm_for(
        self, event: ChangeEvent, minute: datetime, candidates: Sequence[ChangeEvent]
    ) -> bool:
        # Routine dependencies can be causal; routine endpoints are symptoms. Errors
        # don't vouch for other recurring errors.
        if _is_harm(event) or event.key.signal not in _HARM_PROMOTES:
            return False
        earliest_harm = event.start - _HARM_WINDOW
        latest_harm = event.ended_at or minute
        return any(
            _is_harm(harm)
            and service_of(harm.key) == service_of(event.key)
            and earliest_harm <= harm.start <= latest_harm
            and (harm.ended_at is None or harm.ended_at >= earliest_harm)
            for harm in candidates
        )

    def _judge(self, minute: datetime, candidates: Sequence[ChangeAction]) -> list[ChangeAction]:
        """Judge sizes and retire episodes without recording this minute's opens."""
        actions: list[ChangeAction] = []
        for action_kind, event in candidates:
            episode = episode_key(event)
            if action_kind == "open":
                verdict = self.novelty.judge(event, size_of(event.open_ratio), minute)
                event.novelty = verdict.as_dict()
                if not verdict.unusual:
                    service_harm = self.harm.get(service_of(event.key), ())
                    if self._harm_for(event, minute, service_harm):
                        event.novelty["harm"] = True
                    else:
                        self.absorbed[episode] = event
                        action_kind = "latent"
            elif action_kind in ("close", "expire"):
                self.absorbed.pop(episode, None)
                self.next_look.pop(episode, None)
            elif episode in self.absorbed:
                if action_kind == "escalate":
                    escalated_at, escalated_ratio = event.escalations[-1]
                    verdict = self.novelty.judge(event, size_of(escalated_ratio), minute)
                    if verdict.unusual:
                        event.open_ratio = escalated_ratio
                        evidence = verdict.as_dict() | {
                            "opened_on_escalation": True,
                            "unusual_since": escalated_at,
                        }
                        actions.append(self._promote_event(event, minute, evidence))
                continue
            actions.append((action_kind, event))
        return actions

    def _promote_event(
        self, event: ChangeEvent, minute: datetime, novelty: Mapping[str, object]
    ) -> ChangeAction:
        episode = episode_key(event)
        self.absorbed.pop(episode, None)
        self.next_look.pop(episode, None)
        event.novelty = dict(novelty)
        event.detected_at = minute
        return "open", event

    def _promote(
        self,
        minute: datetime,
        new_changes: Sequence[ChangeEvent],
        new_failures: Sequence[ChangeEvent],
    ) -> list[ChangeAction]:
        if not self.absorbed:
            return []
        actions: list[ChangeAction] = []
        new_harm = [event for event in (*new_changes, *new_failures) if _is_harm(event)]
        vouches: dict[Service, list[ChangeEvent]] = defaultdict(list)
        for event in self.known_issues:
            vouches[service_of(event.key)].append(event)
        for event in list(self.absorbed.values()):
            if event.ended_at is not None:
                continue
            if self._harm_for(event, minute, new_harm):
                actions.append(
                    self._promote_event(event, minute, (event.novelty or {}) | {"harm": True})
                )
                continue
            duration_verdict = self._check_duration(event, minute)
            if duration_verdict is not None:
                actions.append(self._promote_event(event, minute, duration_verdict))
                continue
            if (
                event.key.signal in _VOUCH_SIGNALS
                and not event.key.dim_value
                and any(
                    abs(issue.start - event.start) <= _VOUCH_WINDOW
                    for issue in vouches.get(service_of(event.key), ())
                )
            ):
                actions.append(
                    self._promote_event(event, minute, (event.novelty or {}) | {"vouched": True})
                )
        return actions

    def _check_duration(self, event: ChangeEvent, minute: datetime) -> Mapping[str, object] | None:
        episode = episode_key(event)
        next_duration_check = self.next_look.get(episode, 60.0)
        if (
            event.change_type == ChangeType.CHANGE_POINT
            or minute - event.start < next_duration_check * _MINUTE
            or not self.series_history.has_anomalous_observation(event, minute)
        ):
            return None
        observed_minutes = self.novelty.observed_duration(event, minute)
        if observed_minutes < next_duration_check:
            return None
        # Rejudge after 60, 120, 240, ... observed minutes, not wall-clock gaps.
        self.next_look[episode] = 2 * observed_minutes
        verdict = self.novelty.judge_duration(event, observed_minutes, minute)
        return verdict.as_dict() | {"opened_on_duration": True} if verdict.unusual else None

    def _decisions(self, actions: Sequence[GroupAction]) -> list[AnomalyDecision]:
        # A step can both change urgency and merge the same group. Its final action
        # wins; a group merged before it ever qualified must not briefly open.
        final_action_by_group = {action.group.id: action for action in actions}
        decisions = []
        for group_key, action in final_action_by_group.items():
            previous = self.qualified.get(group_key)
            group = action.group
            if action.kind == "close":
                if previous is None or previous.is_resolved:
                    continue
                decision = replace(previous, timestamp=action.t, is_resolved=True)
            elif previous is None:
                if group.urgency == Urgency.LOW and action.independent_count < 2:
                    continue
                decision = _first_decision(action)
            elif previous.is_resolved or previous.urgency != group.urgency:
                decision = replace(
                    previous, timestamp=action.t, is_resolved=False, urgency=group.urgency
                )
            else:
                continue
            self.qualified[group_key] = decision
            decisions.append(decision)
        return decisions


def _first_decision(action: GroupAction) -> AnomalyDecision:
    root = action.root
    assert root is not None  # Correlator.step attaches the final root to every action.
    # Correlation includes trace edges, dimensions, other services and free-form issue
    # evidence. None of those is safe to persist on a project-scoped occurrence.
    signal: PublicSignal = root.key.signal if root.key.signal in _PUBLIC_TITLES else "other"
    title = _PUBLIC_TITLES.get(root.key.signal, "Unexpected change detected")
    if root.key.metric == Metric.FAILURE_RATE:
        title = "More requests failed"
    evidence = AnomalyEvidence(
        signal=signal, change_type=root.change_type, started_at=root.start.isoformat()
    )
    if isfinite(root.actual):
        evidence["actual"] = root.actual
    if isfinite(root.expected):
        evidence["expected"] = root.expected
    if isfinite(root.confidence):
        evidence["confidence"] = root.confidence
    return AnomalyDecision(
        group_key=action.group.id,
        project_id=root.key.project_id,
        timestamp=action.t,
        urgency=action.group.urgency,
        is_resolved=False,
        title=title,
        evidence=evidence,
        env=root.key.env,
    )


_PUBLIC_TITLES = {
    Signal.ERROR_RATE: "Error rate increased",
    Signal.FAILED_RATE: "More requests failed",
    Signal.ERRORS: "Errors increased",
    Signal.REQUESTS: "Request volume dropped",
    Signal.ENDPOINTS: "Endpoint latency increased",
    Signal.OUTBOUND_DB: "Database latency increased",
    Signal.OUTBOUND_HTTP: "Outbound request latency increased",
    Signal.NEW_ISSUE: "New failure detected",
}


def _minute_ceiling(t: datetime) -> datetime:
    minute = t.replace(second=0, microsecond=0)
    return minute if minute == t else minute + _MINUTE


def _available_at(event: ChangeEvent) -> datetime:
    return max(event.start, event.detected_at or event.start)


def _is_standalone_issue(event: ChangeEvent) -> bool:
    return event.actual >= event.expected


def _is_harm(event: ChangeEvent) -> bool:
    return event.key.signal in ERROR_SIGNALS or event.key.metric == Metric.FAILURE_RATE
