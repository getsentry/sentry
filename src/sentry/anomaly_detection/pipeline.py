"""Causal, per-organization anomaly evaluation and public decision projection."""

from bisect import bisect_right
from collections import defaultdict
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, replace
from datetime import datetime, timedelta
from math import isfinite

from sentry.anomaly_detection import quality, shared
from sentry.anomaly_detection.baseline import Baseline
from sentry.anomaly_detection.changepoint import ChangePointDetector
from sentry.anomaly_detection.contracts import ChangeEvent, ChangeType, SeriesKey, Urgency
from sentry.anomaly_detection.correlate import (
    ERROR_SIGNALS,
    Correlator,
    FootprintSource,
    GroupAction,
)
from sentry.anomaly_detection.detect import Detector
from sentry.anomaly_detection.novelty import Novelty, size_of
from sentry.anomaly_detection.series import Series, SeriesRow, build

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
    new_issues: Sequence[ChangeEvent] = (),
) -> Sequence[AnomalyDecision]:
    """Evaluate [start, end), using earlier minute rows to warm the model (naive UTC)."""
    return OrgEvaluator(footprints).advance(
        rows=rows, hourly_rows=hourly_rows, start=start, end=end, new_issues=new_issues
    )


class OrgEvaluator:
    """Own the shared streaming state for one organization's ordered evaluation windows."""

    def __init__(self, footprints: FootprintSource) -> None:
        self.series: dict[SeriesKey, Series] = {}
        self.hourly: dict[SeriesKey, Series] = {}
        self.baseline = Baseline(self.hourly)
        self.det = Detector(self.series, self.baseline)
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
            if row[0] < end and (self.next_minute is None or row[0] >= self.next_minute):
                minutes[row[0]].append(row)
        for key, values in build(row for row in hourly_rows if row[0] < end).items():
            self.hourly.setdefault(key, {}).update(values)
        self._queue_issues(new_issues)

        first = _minute_ceiling(start)
        cold = self.next_minute is None
        t = self.next_minute or min(
            first,
            min(minutes, default=first),
            _minute_ceiling(_available_at(self.pending_issues[0]))
            if self.pending_issues
            else first,
        )
        decisions: list[AnomalyDecision] = []
        while t < first and t < end:
            self._step(t, minutes.pop(t, ()))
            t += _MINUTE
        if cold:
            # An outage can already be active when runtime first comes online. Publish
            # its current state, not the historical transitions used to learn it.
            decisions.extend(
                replace(decision, timestamp=start)
                for decision in self.qualified.values()
                if not decision.is_resolved
            )
        while t < end:
            decisions.extend(self._step(t, minutes.pop(t, ())))
            t += _MINUTE
        self.next_minute = t
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

    def _step(self, t: datetime, rows: Sequence[SeriesRow]) -> list[AnomalyDecision]:
        if rows:
            new_series = False
            for key, values in build(rows).items():
                new_series |= key not in self.series
                self.series.setdefault(key, {}).update(values)
                if key in self.det.watched and values[t] is not None:
                    if key not in self.novelty.first_seen:
                        self.novelty.observe(key, t)
            if new_series:
                self.det.refresh()
                self.cp.refresh()
                for key in self.det.watched:
                    if key not in self.novelty.first_seen and self.series[key].get(t) is not None:
                        self.novelty.observe(key, t)

        if t.minute == 0:
            self._prune_context(t)
            self._check_quality(t)
        if t.hour == 0 and t.minute == 0:
            self.corr.shared = shared.learn(self.novelty.history, t)

        candidates = self.det.step(t)
        for key in self.cp.watched:
            state = self.det.state.get(key)
            if state is not None and state.open is not None:
                self.cp.note_spike(state.open, t)
        candidates.extend(self.cp.step(t))
        opens = [event for kind, event in candidates if kind == "open"]
        self._note_harm(opens)
        actions = self._judge(t, candidates)

        # Issues are known only once their evidence is available, never at first seen.
        ready = bisect_right(self.pending_issues, t, key=_available_at)
        issues = self.pending_issues[:ready]
        del self.pending_issues[:ready]
        self.known_issues.extend(issues)
        # The producer also supplies vouch-only issues below the standalone impact threshold.
        strong = [event for event in issues if _is_standalone_issue(event)]
        self._note_harm(strong)
        actions.extend(("open", event) for event in strong)
        self.point_closes.extend((t + _POINT_LIFETIME, event) for event in strong)
        actions.extend(self._promote(t, opens, strong))

        # A new failure mode is a point observation. Other members, if any, still
        # hold its group open until they end.
        ready = bisect_right(self.point_closes, t, key=lambda item: item[0])
        for _, event in self.point_closes[:ready]:
            event.ended_at = t
            actions.append(("close", event))
        del self.point_closes[:ready]

        return self._decisions(self.corr.step(t, actions))

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

    def _check_quality(self, t: datetime) -> None:
        # Use only observed history; a future change in instrumentation must not
        # retroactively exclude a series. Don't abandon the recovery of an open change.
        recent = {
            key: {ts: values[ts] for i in range(60) if (ts := t - i * _MINUTE) in values}
            for key, values in self.series.items()
            if key.metric.startswith("p95") or key.metric == "count_sample()"
        }
        if issues := quality.check(recent):
            self.det.exclude = {**self.det.exclude, **issues}
        for key in self.det.exclude.keys() & self.det.watched.keys():
            if self.det.state[key].open is None:
                del self.det.watched[key]
                del self.det.state[key]

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
        for kind, event in candidates:
            key = _episode(event)
            if kind == "open":
                verdict = self.novelty.judge(event, size_of(event.open_ratio), t)
                self.novelty.record(event)
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
        self, t: datetime, candidates: Sequence[ChangeEvent], strong: Sequence[ChangeEvent]
    ) -> list[ChangeAction]:
        if not self.absorbed:
            return []
        out = []
        new_harm = [event for event in (*candidates, *strong) if _is_harm(event)]
        vouches: dict[Service, list[ChangeEvent]] = defaultdict(list)
        for event in self.known_issues:
            vouches[_service(event)].append(event)
        for event in list(self.absorbed.values()):
            if event.ended_at is not None:
                continue
            if self._harm_for(event, t, new_harm):
                out.append(self._promote_event(event, t, (event.novelty or {}) | {"harm": True}))
                continue
            slot = _episode(event)
            minutes = (t - event.start) / _MINUTE
            if (
                event.change_type != ChangeType.CHANGE_POINT
                and minutes >= self.next_look.get(slot, 60.0)
                and self.series[event.key].get(t) is not None
            ):
                # Absorbed episodes get another look at 60, 120, 240, ... minutes.
                self.next_look[slot] = 2 * minutes
                verdict = self.novelty.judge_duration(event, minutes, t)
                if verdict.unusual:
                    out.append(
                        self._promote_event(
                            event, t, verdict.as_dict() | {"opened_on_duration": True}
                        )
                    )
                    continue
            if (
                event.key.signal in _VOUCH_SIGNALS
                and not event.key.dim_value
                and any(
                    abs(issue.start - event.start) <= _VOUCH_WINDOW
                    for issue in vouches.get(_service(event), ())
                )
            ):
                out.append(self._promote_event(event, t, (event.novelty or {}) | {"vouched": True}))
        return out

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
