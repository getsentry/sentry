"""Causal, per-organization anomaly evaluation and public decision projection."""

from bisect import bisect_right
from collections import defaultdict
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, replace
from datetime import datetime, timedelta
from math import isfinite

from sentry.anomaly_detection import shared
from sentry.anomaly_detection.baseline import Baseline
from sentry.anomaly_detection.changepoint import ChangePointDetector
from sentry.anomaly_detection.contracts import ChangeEvent, ChangeType, SeriesKey, Urgency
from sentry.anomaly_detection.correlate import (
    ERROR_SIGNALS,
    Correlator,
    FootprintSource,
    GroupAction,
)
from sentry.anomaly_detection.detect import SeriesHistory
from sentry.anomaly_detection.grouptype import AnomalyDetectionDetectorHandler, MinuteMeasurements
from sentry.anomaly_detection.novelty import Novelty, size_of
from sentry.anomaly_detection.series import Series, SeriesRow
from sentry.workflow_engine.models import DataPacket

_MINUTE = timedelta(minutes=1)
_HARM_WINDOW = timedelta(minutes=10)
_VOUCH_WINDOW = timedelta(minutes=30)
_POINT_LIFETIME = timedelta(minutes=30)
_CONTEXT_HORIZON = timedelta(hours=6)
_HARM_PROMOTES = ("outbound_db", "outbound_http")
_VOUCH_SIGNALS = ("error_rate", "failed_rate", "errors")

EpisodeKey = tuple[SeriesKey, ChangeType, datetime]
Service = tuple[str, str]
ChangeAction = tuple[str, ChangeEvent]


@dataclass(frozen=True)
class AnomalyDecision:
    group_key: str
    project_id: int
    timestamp: datetime
    urgency: Urgency
    is_resolved: bool
    title: str
    evidence: Mapping[str, object]
    env: str


def evaluate_org(
    *,
    rows: Sequence[SeriesRow],
    hourly_rows: Sequence[SeriesRow],
    start: datetime,
    end: datetime,
    footprints: FootprintSource,
    handlers: Mapping[str, AnomalyDetectionDetectorHandler],
    new_issues: Sequence[ChangeEvent] = (),
) -> Sequence[AnomalyDecision]:
    """Evaluate [start, end), using earlier minute rows to warm the model (naive UTC)."""
    return OrgEvaluator(footprints, handlers=handlers).advance(
        rows=rows, hourly_rows=hourly_rows, start=start, end=end, new_issues=new_issues
    )


class OrgEvaluator:
    """Own the shared streaming state for one organization's ordered evaluation windows."""

    def __init__(
        self,
        footprints: FootprintSource,
        *,
        handlers: Mapping[str, AnomalyDetectionDetectorHandler],
    ) -> None:
        self.handlers = dict(sorted(handlers.items()))
        if any(
            project != str(handler.detector.project_id) for project, handler in handlers.items()
        ):
            raise ValueError("Anomaly handler map keys must match their detector project IDs")
        self.series: dict[SeriesKey, Series] = {}
        self.hourly: dict[SeriesKey, Series] = {}
        self.baseline = Baseline(self.hourly)
        self.det = SeriesHistory(self.series, self.baseline)
        self.cp = ChangePointDetector(self.series, self.baseline)
        self.corr = Correlator(footprints, series=self.series)
        self.novelty = Novelty()
        self.qualified: dict[str, AnomalyDecision] = {}
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
        minutes: dict[datetime, list[SeriesRow]] = defaultdict(list)
        for row in rows:
            if (
                row[3] in self.handlers
                and row[0] < end
                and (self.next_minute is None or row[0] >= self.next_minute)
            ):
                minutes[row[0]].append(row)
        hourly_by_project: dict[str, list[SeriesRow]] = defaultdict(list)
        for row in hourly_rows:
            if row[3] in self.handlers and row[0] < end:
                hourly_by_project[row[3]].append(row)
        for project, project_rows in hourly_by_project.items():
            for key, values in self.handlers[project].load_baseline(project_rows).items():
                self.hourly.setdefault(key, {}).update(values)
        self._queue_issues([event for event in new_issues if event.key.project in self.handlers])

        first_publish_minute = _minute_ceiling(start)
        cold_start = self.next_minute is None
        first_issue_minute = first_publish_minute
        if self.pending_issues:
            first_issue_minute = _minute_ceiling(_available_at(self.pending_issues[0]))
        minute = self.next_minute or min(
            first_publish_minute,
            min(minutes, default=first_publish_minute),
            first_issue_minute,
        )
        while minute < first_publish_minute and minute < end:
            self._step(minute, minutes.pop(minute, ()))
            minute += _MINUTE

        decisions: list[AnomalyDecision] = []
        if cold_start and minute < end:
            # Publish the active state after processing the boundary tick, not a warmup
            # incident that resolves on the boundary or an intermediate severity.
            self._step(minute, minutes.pop(minute, ()))
            decisions.extend(
                replace(decision, timestamp=minute)
                for decision in self.qualified.values()
                if not decision.is_resolved
            )
            minute += _MINUTE
        while minute < end:
            decisions.extend(self._step(minute, minutes.pop(minute, ())))
            minute += _MINUTE
        self.next_minute = minute
        return decisions

    def _queue_issues(self, events: Sequence[ChangeEvent]) -> None:
        if not events:
            return
        # A low-impact vouch and a later standalone crossing are different milestones
        # of the same episode; only repeated reports of the same milestone are duplicates.
        seen = {
            (_episode(event), _is_standalone_issue(event))
            for event in (*self.known_issues, *self.pending_issues)
        }
        for event in events:
            key = (_episode(event), _is_standalone_issue(event))
            if event.change_type != ChangeType.NEW_FAILURE_MODE or key in seen:
                continue
            if self.next_minute and _available_at(event) < self.next_minute - _CONTEXT_HORIZON:
                continue
            seen.add(key)
            self.pending_issues.append(
                replace(event, evidence=list(event.evidence), ended_at=None, escalations=[])
            )
        self.pending_issues.sort(key=lambda event: (_available_at(event), _episode(event)))

    def _step(self, minute: datetime, rows: Sequence[SeriesRow]) -> list[AnomalyDecision]:
        by_project: dict[str, list[SeriesRow]] = defaultdict(list)
        for row in rows:
            by_project[row[3]].append(row)

        if minute.minute == 0:
            self._prune_context(minute)
            if minute.hour == 0:
                self.corr.shared = shared.learn(
                    self.novelty.history, minute, coverage=self.novelty.coverage
                )
        candidates: list[ChangeAction] = []
        for project, handler in self.handlers.items():
            result = handler.evaluate_measurements(
                DataPacket(
                    source_id=str(handler.detector.id),
                    packet=MinuteMeasurements(minute=minute, rows=by_project.get(project, ())),
                ),
                self.det,
                self.cp,
            )
            candidates.extend(result.changes)
            for key in result.observed:
                self.novelty.observe(key, minute)
        if len(self.handlers) > 1 and len(candidates) > 1:
            # Keep the original scoring order across projects: excursions first,
            # then change points. Correlation can use this order to break ties.
            order = {key: index for index, key in enumerate(self.det.watched)}
            point_order = {key: index for index, key in enumerate(self.cp.watched)}
            candidates.sort(
                key=lambda action: (
                    (1, point_order[action[1].key])
                    if action[1].change_type == ChangeType.CHANGE_POINT
                    else (0, order[action[1].key])
                )
            )
        opens = [event for kind, event in candidates if kind == "open"]
        self._note_harm(opens)
        actions = self._judge(minute, candidates)

        # Issues are known only once their evidence is available, never at first seen.
        ready = bisect_right(self.pending_issues, minute, key=_available_at)
        issues = self.pending_issues[:ready]
        del self.pending_issues[:ready]
        self.known_issues.extend(issues)
        # The producer also supplies vouch-only issues below the standalone impact threshold.
        strong = [event for event in issues if _is_standalone_issue(event)]
        self._note_harm(strong)
        actions.extend(("open", event) for event in strong)
        self.point_closes.extend((minute + _POINT_LIFETIME, event) for event in strong)
        actions.extend(self._promote(minute, opens, strong))

        # A new failure mode is a point observation. Other members, if any, still
        # hold its group open until they end.
        ready = bisect_right(self.point_closes, minute, key=lambda item: item[0])
        for _, event in self.point_closes[:ready]:
            event.ended_at = minute
            actions.append(("close", event))
        del self.point_closes[:ready]

        return self._decisions(self.corr.step(minute, actions))

    def _prune_context(self, t: datetime) -> None:
        floor = t - _CONTEXT_HORIZON
        self.known_issues[:] = [
            issue for issue in self.known_issues if _available_at(issue) >= floor
        ]
        for service, events in list(self.harm.items()):
            recent = [
                event for event in events if event.ended_at is None or event.ended_at >= floor
            ]
            if recent:
                self.harm[service] = recent
            else:
                del self.harm[service]
        self.novelty.prune(t)
        self.corr.prune(t)
        retained = self.corr.state.open_groups.keys() | self.corr.state.closed_groups.keys()
        for group_key in self.qualified.keys() - retained:
            del self.qualified[group_key]

    def _note_harm(self, events: Sequence[ChangeEvent]) -> None:
        for event in events:
            if _is_harm(event):
                self.harm.setdefault(_service(event), []).append(event)

    def _harm_for(self, event: ChangeEvent, t: datetime, candidates: Sequence[ChangeEvent]) -> bool:
        # Routine dependencies can be causal; routine endpoints are symptoms. Errors
        # don't vouch for other recurring errors.
        if _is_harm(event) or event.key.signal not in _HARM_PROMOTES:
            return False
        lo = event.start - _HARM_WINDOW
        hi = event.ended_at or t
        return any(
            _is_harm(harm)
            and _service(harm) == _service(event)
            and lo <= harm.start <= hi
            and (harm.ended_at is None or harm.ended_at >= lo)
            for harm in candidates
        )

    def _judge(self, t: datetime, candidates: Sequence[ChangeAction]) -> list[ChangeAction]:
        actions = []
        new_excursions = []
        for kind, event in candidates:
            key = _episode(event)
            if kind == "open":
                verdict = self.novelty.judge(event, size_of(event.open_ratio), t)
                new_excursions.append(event)
                event.novelty = verdict.as_dict()
                if not verdict.unusual:
                    if self._harm_for(event, t, self.harm.get(_service(event), ())):
                        event.novelty["harm"] = True
                    else:
                        self.absorbed[key] = event
                        kind = "latent"
            elif kind in ("close", "expire"):
                self.absorbed.pop(key, None)
                self.next_look.pop(key, None)
            elif key in self.absorbed:
                if kind == "escalate":
                    when, ratio = event.escalations[-1]
                    verdict = self.novelty.judge(event, size_of(ratio), t)
                    if verdict.unusual:
                        event.open_ratio = ratio
                        actions.append(
                            self._promote_event(
                                event,
                                t,
                                verdict.as_dict()
                                | {
                                    "opened_on_escalation": True,
                                    "unusual_since": when,
                                },
                            )
                        )
                continue
            actions.append((kind, event))
        for event in new_excursions:
            self.novelty.record(event)
        return actions

    def _promote_event(
        self, event: ChangeEvent, t: datetime, novelty: Mapping[str, object]
    ) -> ChangeAction:
        key = _episode(event)
        self.absorbed.pop(key, None)
        self.next_look.pop(key, None)
        event.novelty = dict(novelty)
        event.detected_at = t
        return "open", event

    def _promote(
        self,
        minute: datetime,
        new_changes: Sequence[ChangeEvent],
        new_failures: Sequence[ChangeEvent],
    ) -> list[ChangeAction]:
        if not self.absorbed:
            return []
        actions = []
        new_harm = [event for event in (*new_changes, *new_failures) if _is_harm(event)]
        vouches: dict[Service, list[ChangeEvent]] = defaultdict(list)
        for event in self.known_issues:
            vouches[_service(event)].append(event)
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
                    for issue in vouches.get(_service(event), ())
                )
            ):
                actions.append(
                    self._promote_event(event, minute, (event.novelty or {}) | {"vouched": True})
                )
        return actions

    def _check_duration(self, event: ChangeEvent, minute: datetime) -> Mapping[str, object] | None:
        episode = _episode(event)
        next_duration_check = self.next_look.get(episode, 60.0)
        if (
            event.change_type == ChangeType.CHANGE_POINT
            or minute - event.start < next_duration_check * _MINUTE
            or not self.det.has_novelty_observation(event.key, minute)
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
        touched = {action.group.id: action for action in actions}
        out = []
        for group_key, action in touched.items():
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
            out.append(decision)
        return out


def _first_decision(action: GroupAction) -> AnomalyDecision:
    root = action.root
    assert root is not None  # Correlator.step attaches the final root to every action.
    # Correlation includes trace edges, dimensions, other services and free-form issue
    # evidence. None of those is safe to persist on a project-scoped occurrence.
    title, signal = _PUBLIC_SIGNALS.get(root.key.signal, ("Unexpected change detected", "other"))
    if root.key.metric == "failure_rate()":
        title = "More requests failed"
    evidence: dict[str, object] = {
        "signal": signal,
        "change_type": root.change_type.value,
        "started_at": root.start.isoformat(),
    }
    for name, value in (
        ("actual", root.actual),
        ("expected", root.expected),
        ("confidence", root.confidence),
    ):
        if isfinite(value):
            evidence[name] = value
    return AnomalyDecision(
        group_key=action.group.id,
        project_id=int(root.key.project),
        timestamp=action.t,
        urgency=action.group.urgency,
        is_resolved=False,
        title=title,
        evidence=evidence,
        env=root.key.env,
    )


_PUBLIC_SIGNALS = {
    "error_rate": ("Error rate increased", "error_rate"),
    "failed_rate": ("More requests failed", "failed_rate"),
    "errors": ("Errors increased", "errors"),
    "requests": ("Request volume dropped", "requests"),
    "endpoints": ("Endpoint latency increased", "endpoints"),
    "outbound_db": ("Database latency increased", "outbound_db"),
    "outbound_http": ("Outbound request latency increased", "outbound_http"),
    "new_issue": ("New failure detected", "new_issue"),
}


def _minute_ceiling(t: datetime) -> datetime:
    minute = t.replace(second=0, microsecond=0)
    return minute if minute == t else minute + _MINUTE


def _available_at(event: ChangeEvent) -> datetime:
    return max(event.start, event.detected_at or event.start)


def _is_standalone_issue(event: ChangeEvent) -> bool:
    return event.actual >= event.expected


def _episode(event: ChangeEvent) -> EpisodeKey:
    return event.key, event.change_type, event.start


def _service(event: ChangeEvent) -> Service:
    return event.key.project, event.key.env


def _is_harm(event: ChangeEvent) -> bool:
    return event.key.signal in ERROR_SIGNALS or event.key.metric == "failure_rate()"
