"""Causal, per-organization anomaly evaluation and public decision projection."""

from bisect import bisect_right
from collections import defaultdict
from collections.abc import Iterable, Sequence
from dataclasses import dataclass, field, replace
from datetime import datetime, timedelta
from math import isfinite
from typing import NotRequired, TypedDict

from sentry.anomaly_detection.contracts import (
    AnomalyGroupKey,
    ChangeAction,
    ChangeEvent,
    ChangeType,
    EpisodeKey,
    Metric,
    NoveltyEvidence,
    SeriesKey,
    SeriesRow,
    Service,
    Signal,
    Urgency,
)
from sentry.anomaly_detection.correlation import shared_dependencies
from sentry.anomaly_detection.correlation.correlator import (
    ERROR_SIGNALS,
    CorrelationState,
    Correlator,
    FootprintSource,
    GroupAction,
    episode_key,
)
from sentry.anomaly_detection.correlation.footprint import service_of
from sentry.anomaly_detection.correlation.shared_dependencies import SharedDeps
from sentry.anomaly_detection.evaluation.baseline import Baseline
from sentry.anomaly_detection.evaluation.novelty import Novelty, NoveltyState, size_of
from sentry.anomaly_detection.evaluation.rate_shifts import RateShiftState, RateShiftTracker
from sentry.anomaly_detection.evaluation.series import Series, build
from sentry.anomaly_detection.evaluation.series_history import SeriesHistory, SeriesHistoryState

_MINUTE = timedelta(minutes=1)
_HARM_WINDOW = timedelta(minutes=10)
_VOUCH_WINDOW = timedelta(minutes=30)
_POINT_LIFETIME = timedelta(minutes=30)
CONTEXT_HORIZON = timedelta(hours=6)
_HARM_PROMOTES = frozenset({Signal.OUTBOUND_DB, Signal.OUTBOUND_HTTP})
_VOUCH_SIGNALS = frozenset({Signal.ERROR_RATE, Signal.FAILED_RATE, Signal.ERRORS})


class AnomalyEvidence(TypedDict):
    """Occurrence evidence. Only project-scoped facts about the root change, never
    dimensions, other services or free-form issue evidence."""

    signal: str  # The root's Signal, or "other" for signals without a public description.
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


@dataclass(frozen=True)
class EvaluatorConfig:
    """Optional evaluation stages."""

    rate_shifts: bool = True
    novelty_admission: bool = True
    shared_dependencies: bool = True


@dataclass
class AdmissionState:
    # Routine episodes kept as latent support until they become unusual.
    absorbed: dict[EpisodeKey, ChangeEvent] = field(default_factory=dict)
    # Observed minutes after which an absorbed episode's duration is judged again.
    next_look: dict[EpisodeKey, float] = field(default_factory=dict)
    # Recent failures by service, which make routine dependency changes worth reporting.
    harm: dict[Service, list[ChangeEvent]] = field(default_factory=dict)


@dataclass
class EvaluatorState:
    """Everything an organization evaluator carries between runs, besides measurements."""

    next_minute: datetime | None = None
    series_history: SeriesHistoryState = field(default_factory=SeriesHistoryState)
    rate_shifts: dict[SeriesKey, RateShiftState] = field(default_factory=dict)
    novelty: NoveltyState = field(default_factory=NoveltyState)
    correlation: CorrelationState = field(default_factory=CorrelationState)
    admission: AdmissionState = field(default_factory=AdmissionState)
    # The last decision published for each group, i.e. what Workflow Engine was told.
    published: dict[AnomalyGroupKey, AnomalyDecision] = field(default_factory=dict)
    # New-issue milestones waiting until their evidence is available.
    pending_issues: list[ChangeEvent] = field(default_factory=list)
    known_issues: list[ChangeEvent] = field(default_factory=list)
    # When each standalone new-issue point observation closes.
    point_closes: list[tuple[datetime, ChangeEvent]] = field(default_factory=list)


@dataclass
class Checkpoint:
    """An evaluator's state with the measurements it needs to resume."""

    series: dict[SeriesKey, Series]
    hourly: dict[SeriesKey, Series]
    state: EvaluatorState


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


class Admission:
    """Decide which opened episodes are unusual enough to report, and promote routine ones
    once they grow, last, cause harm, or are vouched for by a new issue."""

    def __init__(
        self,
        novelty: Novelty,
        series_history: SeriesHistory,
        state: AdmissionState,
        *,
        enabled: bool,
    ) -> None:
        self.novelty = novelty
        self.series_history = series_history
        self.state = state
        self.enabled = enabled

    def judge(self, minute: datetime, candidates: Sequence[ChangeAction]) -> list[ChangeAction]:
        """Judge sizes and retire episodes without recording this minute's opens."""
        if not self.enabled:
            return list(candidates)
        state = self.state
        actions: list[ChangeAction] = []
        for action_kind, event in candidates:
            episode = episode_key(event)
            if action_kind == "open":
                verdict = self.novelty.judge(event, size_of(event.open_ratio), minute)
                event.novelty = verdict.as_evidence()
                if not verdict.unusual:
                    service_harm = state.harm.get(service_of(event.key), ())
                    if _harm_for(event, minute, service_harm):
                        event.novelty["harm"] = True
                    else:
                        state.absorbed[episode] = event
                        action_kind = "latent"
            elif action_kind in ("close", "expire"):
                state.absorbed.pop(episode, None)
                state.next_look.pop(episode, None)
            elif episode in state.absorbed:
                if action_kind == "escalate":
                    escalated_at, escalated_ratio = event.escalations[-1]
                    verdict = self.novelty.judge(event, size_of(escalated_ratio), minute)
                    if verdict.unusual:
                        event.open_ratio = escalated_ratio
                        evidence = verdict.as_evidence()
                        evidence["opened_on_escalation"] = True
                        evidence["unusual_since"] = escalated_at
                        actions.append(self._promote(event, minute, evidence))
                continue
            actions.append((action_kind, event))
        return actions

    def note_harm(self, events: Iterable[ChangeEvent]) -> None:
        for event in events:
            if _is_harm(event):
                self.state.harm.setdefault(service_of(event.key), []).append(event)

    def promote(
        self,
        minute: datetime,
        new_changes: Sequence[ChangeEvent],
        new_failures: Sequence[ChangeEvent],
        known_issues: Sequence[ChangeEvent],
    ) -> list[ChangeAction]:
        if not self.state.absorbed:
            return []
        actions: list[ChangeAction] = []
        new_harm = [event for event in (*new_changes, *new_failures) if _is_harm(event)]
        vouches: dict[Service, list[ChangeEvent]] = defaultdict(list)
        for event in known_issues:
            vouches[service_of(event.key)].append(event)
        for event in list(self.state.absorbed.values()):
            if event.ended_at is not None:
                continue
            if _harm_for(event, minute, new_harm):
                actions.append(self._promote(event, minute, (event.novelty or {}) | {"harm": True}))
                continue
            duration_verdict = self._check_duration(event, minute)
            if duration_verdict is not None:
                actions.append(self._promote(event, minute, duration_verdict))
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
                    self._promote(event, minute, (event.novelty or {}) | {"vouched": True})
                )
        return actions

    def prune(self, context_start: datetime) -> None:
        harm = self.state.harm
        for service, events in list(harm.items()):
            recent = [
                event
                for event in events
                if event.ended_at is None or event.ended_at >= context_start
            ]
            if recent:
                harm[service] = recent
            else:
                del harm[service]

    def forget(self, episodes: Iterable[EpisodeKey]) -> None:
        for episode in episodes:
            self.state.absorbed.pop(episode, None)
            self.state.next_look.pop(episode, None)

    def drop_projects(self, keep: set[int]) -> None:
        state = self.state
        self.forget(
            [
                episode
                for episode in state.absorbed.keys() | state.next_look.keys()
                if episode.series_key.project_id not in keep
            ]
        )
        for service in [service for service in state.harm if service.project_id not in keep]:
            del state.harm[service]

    def _promote(
        self, event: ChangeEvent, minute: datetime, novelty: NoveltyEvidence
    ) -> ChangeAction:
        self.forget([episode_key(event)])
        event.novelty = novelty
        event.detected_at = minute
        return "open", event

    def _check_duration(self, event: ChangeEvent, minute: datetime) -> NoveltyEvidence | None:
        episode = episode_key(event)
        next_duration_check = self.state.next_look.get(episode, 60.0)
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
        self.state.next_look[episode] = 2 * observed_minutes
        verdict = self.novelty.judge_duration(event, observed_minutes, minute)
        if not verdict.unusual:
            return None
        evidence = verdict.as_evidence()
        evidence["opened_on_duration"] = True
        return evidence


class DecisionLog:
    """Project correlated group actions onto the decisions published per group."""

    def __init__(self, published: dict[AnomalyGroupKey, AnomalyDecision]) -> None:
        self.published = published

    def record(self, actions: Sequence[GroupAction]) -> list[AnomalyDecision]:
        # A step can both change urgency and merge the same group. Its final action
        # wins; a group merged before it ever qualified must not briefly open.
        final_action_by_group = {action.group.id: action for action in actions}
        decisions = []
        for group_key, action in final_action_by_group.items():
            previous = self.published.get(group_key)
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
            self.published[group_key] = decision
            decisions.append(decision)
        return decisions

    def active(self, minute: datetime) -> list[AnomalyDecision]:
        """Currently open groups, restated at `minute`."""
        return [
            replace(decision, timestamp=minute)
            for decision in self.published.values()
            if not decision.is_resolved
        ]

    def retain(self, group_keys: Iterable[AnomalyGroupKey]) -> None:
        retained = set(group_keys)
        for group_key in self.published.keys() - retained:
            del self.published[group_key]

    def drop_projects(
        self, keep: set[int], retired_open: set[AnomalyGroupKey], boundary: datetime
    ) -> list[AnomalyDecision]:
        """Close retired open groups at the scope boundary and forget out-of-scope ones.

        The current root may differ from the published owner. Close the original
        lifecycle at the boundary, never migrate it.
        """
        closes = []
        for group_key, decision in list(self.published.items()):
            owner_enabled = decision.project_id in keep
            if group_key in retired_open and owner_enabled and not decision.is_resolved:
                closes.append(replace(decision, timestamp=boundary, is_resolved=True))
            if group_key in retired_open or not owner_enabled:
                del self.published[group_key]
        return closes


class OrgEvaluator:
    """Own the shared streaming state for one organization's ordered evaluation windows."""

    def __init__(
        self,
        footprints: FootprintSource,
        *,
        projects: Iterable[int],
        config: EvaluatorConfig | None = None,
        checkpoint: Checkpoint | None = None,
    ) -> None:
        # Project IDs with an enabled detector, in a stable scoring order.
        self.projects: tuple[int, ...] = tuple(sorted(set(projects)))
        self.config = config or EvaluatorConfig()
        checkpoint = checkpoint or Checkpoint({}, {}, EvaluatorState())
        # Every component reads these same measurement mappings.
        self.series = checkpoint.series
        self.hourly = checkpoint.hourly
        self.state = state = checkpoint.state
        self.baseline = Baseline(self.hourly)
        self.series_history = SeriesHistory(self.series, self.baseline, state=state.series_history)
        self.rate_shifts = RateShiftTracker(self.series, self.baseline, state=state.rate_shifts)
        self.corr = Correlator(footprints, series=self.series, state=state.correlation)
        self.novelty = Novelty(state=state.novelty)
        self.admission = Admission(
            self.novelty,
            self.series_history,
            state.admission,
            enabled=self.config.novelty_admission,
        )
        self.decision_log = DecisionLog(state.published)

    @property
    def next_minute(self) -> datetime | None:
        return self.state.next_minute

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
        next_minute = self.state.next_minute
        rows_by_minute: dict[datetime, list[SeriesRow]] = defaultdict(list)
        for row in rows:
            if (
                row.project_id in self.projects
                and row.ts < end
                and (next_minute is None or row.ts >= next_minute)
            ):
                rows_by_minute[row.ts].append(row)
        self._load_hourly_baselines(hourly_rows, end)
        self._queue_issues([event for event in new_issues if event.key.project_id in self.projects])

        first_publish_minute = _minute_ceiling(start)
        cold_start = next_minute is None
        first_issue_minute = first_publish_minute
        if self.state.pending_issues:
            first_issue_minute = _minute_ceiling(_available_at(self.state.pending_issues[0]))
        minute = next_minute or min(
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
            decisions.extend(self.decision_log.active(minute))
            minute += _MINUTE
        while minute < end:
            decisions.extend(self._step(minute, rows_by_minute.pop(minute, ())))
            minute += _MINUTE
        self.state.next_minute = minute
        return decisions

    def expire(self, at: datetime, events: Sequence[ChangeEvent]) -> list[AnomalyDecision]:
        """Publish the effect of episodes that ended without observing recovery."""
        expirations: list[ChangeAction] = [("expire", event) for event in events]
        return self.decision_log.record(self.corr.step(at, self.admission.judge(at, expirations)))

    def forget_series(self, keys: Iterable[SeriesKey]) -> None:
        """Forget measurements and detector state of series, keeping novelty and correlation
        context on their own horizons."""
        forgotten = set(keys)
        for key in forgotten:
            self.series.pop(key, None)
        self.series_history.forget(forgotten)
        self.rate_shifts.forget(forgotten)

    def drop_projects(self, keep: set[int], boundary: datetime) -> list[AnomalyDecision]:
        """Forget projects whose detectors were disabled; close their published groups."""
        for measurements in (self.series, self.hourly):
            for key in [key for key in measurements if key.project_id not in keep]:
                del measurements[key]
        self.series_history.drop_projects(keep)
        self.rate_shifts.drop_projects(keep)
        self.novelty.forget([key for key in self.novelty.keys() if key.project_id not in keep])
        self.admission.drop_projects(keep)
        state = self.state
        for queue in (state.pending_issues, state.known_issues):
            queue[:] = [event for event in queue if event.key.project_id in keep]
        state.point_closes[:] = [
            (ts, event) for ts, event in state.point_closes if event.key.project_id in keep
        ]
        owners = {key: decision.project_id for key, decision in state.published.items()}
        retired, demoted = self.corr.drop_projects(keep, owners)
        self.admission.forget(demoted)
        retired_open = {key for key, group in retired.items() if group.closed_at is None}
        closes = self.decision_log.drop_projects(keep, retired_open, boundary)
        self.decision_log.retain(state.published.keys() - retired.keys())
        return closes

    def hourly_support(self, since: datetime, until: datetime) -> dict[SeriesKey, Series]:
        """Closed hourly values that live slice anchors need from before the cursor.

        The next collection overlays these by key and hour, including explicit missing
        values, so omitted top slices keep their seasonal reference.
        """
        support = {}
        for key, state in self.series_history.state.series_states.items():
            if not (key.dim_value and state.open and state.anchor_level is not None):
                continue
            points: Series = {
                hour: value
                for hour, value in sorted(self.hourly.get(key, {}).items())
                if since <= hour < until
                and hour == hour.replace(minute=0, second=0, microsecond=0)
                and value is not None
            }
            if points:
                support[key] = points
        return support

    def _load_hourly_baselines(self, hourly_rows: Sequence[SeriesRow], end: datetime) -> None:
        scoped_rows = (
            row for row in hourly_rows if row.project_id in self.projects and row.ts < end
        )
        for key, hourly_values in build(scoped_rows).items():
            self.hourly.setdefault(key, {}).update(hourly_values)

    def _queue_issues(self, events: Sequence[ChangeEvent]) -> None:
        if not events:
            return
        state = self.state
        # A low-impact vouch and a later standalone crossing are different milestones
        # of the same episode; only repeated reports of the same milestone are duplicates.
        seen = {
            (episode_key(event), _is_standalone_issue(event))
            for event in (*state.known_issues, *state.pending_issues)
        }
        for event in events:
            key = (episode_key(event), _is_standalone_issue(event))
            if event.change_type != ChangeType.NEW_FAILURE_MODE or key in seen:
                continue
            if state.next_minute and _available_at(event) < state.next_minute - CONTEXT_HORIZON:
                continue
            seen.add(key)
            state.pending_issues.append(
                event.replace(evidence=list(event.evidence), ended_at=None, escalations=[])
            )
        state.pending_issues.sort(key=lambda event: (_available_at(event), episode_key(event)))

    def _step(self, minute: datetime, rows: Sequence[SeriesRow]) -> list[AnomalyDecision]:
        state = self.state
        if minute.minute == 0:
            self._prune_context(minute)
            if minute.hour == 0:
                self.corr.shared = (
                    shared_dependencies.learn(
                        state.novelty.history,
                        minute,
                        coverage=state.novelty.coverage,
                        complete_since=state.novelty.complete_since,
                    )
                    if self.config.shared_dependencies
                    else SharedDeps()
                )

        candidates = self._evaluate_measurements(minute, rows)
        opened_changes = [event for kind, event in candidates if kind == "open"]
        self.admission.note_harm(opened_changes)
        actions = self.admission.judge(minute, candidates)

        # Issues are known only once their evidence is available, never at first seen.
        available_issue_count = bisect_right(state.pending_issues, minute, key=_available_at)
        available_issues = state.pending_issues[:available_issue_count]
        del state.pending_issues[:available_issue_count]
        state.known_issues.extend(available_issues)
        # The producer also supplies vouch-only issues below the standalone impact threshold.
        standalone_failures = [event for event in available_issues if _is_standalone_issue(event)]
        self.admission.note_harm(standalone_failures)
        actions.extend(("open", event) for event in standalone_failures)
        state.point_closes.extend(
            (minute + _POINT_LIFETIME, event) for event in standalone_failures
        )
        actions.extend(
            self.admission.promote(minute, opened_changes, standalone_failures, state.known_issues)
        )
        # Size and duration both use the same prior, even for peers whose opens
        # are backdated. Record only the original detector opens, not promotions.
        for event in opened_changes:
            self.novelty.record(event)

        # A new failure mode is a point observation. Other members, if any, still
        # hold its group open until they end.
        due_close_count = bisect_right(state.point_closes, minute, key=lambda item: item[0])
        for _, event in state.point_closes[:due_close_count]:
            event.ended_at = minute
            actions.append(("close", event))
        del state.point_closes[:due_close_count]

        return self.decision_log.record(self.corr.step(minute, actions))

    def _evaluate_measurements(
        self, minute: datetime, rows: Sequence[SeriesRow]
    ) -> list[ChangeAction]:
        """Advance every detector by one minute: series changes first, then rate shifts,
        each in its watch order. Correlation can use this order to break ties."""
        history, rate_shifts = self.series_history, self.rate_shifts
        measurements = build(rows)
        discovered = {key.project_id for key in measurements.keys() - self.series.keys()}
        for key, values in measurements.items():
            self.series.setdefault(key, {}).update(values)
        for project_id in self.projects:
            if project_id in discovered:
                history.refresh(project_id=project_id)
                if self.config.rate_shifts:
                    rate_shifts.refresh(project_id=project_id)
            if minute.minute == 0:
                history.check_quality(minute, project_id=project_id)
                history.prune_pseudo(minute, project_id=project_id)

        for key in measurements:
            if history.has_novelty_observation(key, minute):
                self.novelty.observe(key, minute)

        changes: list[ChangeAction] = [
            action
            for key, rule in history.state.watched.items()
            if (action := history.step_series(key, rule, minute))
        ]
        if not self.config.rate_shifts:
            return changes + self._disable_rate_shifts(minute)
        for key in rate_shifts.state:
            if (series_state := history.state.series_states.get(key)) and series_state.open:
                rate_shifts.note_spike(series_state.open, minute)
        changes.extend(rate_shifts.step(minute))
        return changes

    def _disable_rate_shifts(self, minute: datetime) -> list[ChangeAction]:
        reason = "expired: rate shift detection disabled"
        expired: list[ChangeAction] = [
            ("expire", event)
            for key in sorted(self.rate_shifts.open_keys())
            if (event := self.rate_shifts.expire(key, minute, reason)) is not None
        ]
        self.rate_shifts.forget(list(self.rate_shifts.state))
        return expired

    def _prune_context(self, minute: datetime) -> None:
        context_start = minute - CONTEXT_HORIZON
        self.state.known_issues[:] = [
            issue for issue in self.state.known_issues if _available_at(issue) >= context_start
        ]
        self.admission.prune(context_start)
        self.novelty.prune(minute)
        self.corr.prune(minute)
        self.decision_log.retain(group.id for group in self.corr.groups)


def _harm_for(event: ChangeEvent, minute: datetime, candidates: Sequence[ChangeEvent]) -> bool:
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


def _first_decision(action: GroupAction) -> AnomalyDecision:
    root = action.root
    assert root is not None  # Correlator.step attaches the final root to every action.
    # Correlation includes trace edges, dimensions, other services and free-form issue
    # evidence. None of those is safe to persist on a project-scoped occurrence.
    signal = str(root.key.signal) if root.key.signal in _PUBLIC_TITLES else "other"
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
