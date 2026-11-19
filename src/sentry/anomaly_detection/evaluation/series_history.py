"""Minute-by-minute anomaly detection over aggregates, independent of collection."""

import math
from collections import deque
from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from statistics import median
from typing import Literal, NamedTuple

from sentry.anomaly_detection.contracts import ChangeEvent, ChangeType, ExpectedValue, SeriesKey
from sentry.anomaly_detection.evaluation import count_windows
from sentry.anomaly_detection.evaluation.baseline import MINUTE, Baseline, weight_key, zscore
from sentry.anomaly_detection.evaluation.series import (
    Series,
    has_traffic,
    is_share,
    rate_parts,
    samples_key,
)


@dataclass(frozen=True)
class Rule:
    signal: str
    metric: str
    direction: Literal["up", "down"]
    change: ChangeType
    slices: bool = False
    only_without_traffic: bool = False
    persist: tuple[int, int] = (3, 5)


RULES = (
    Rule("error_rate", "errors/requests", "up", ChangeType.SPIKE),
    Rule("failed_rate", "failed_requests/requests", "up", ChangeType.SPIKE),
    Rule("errors", "count_unique(user)", "up", ChangeType.SPIKE),
    Rule("errors", "count()", "up", ChangeType.SPIKE, only_without_traffic=True),
    Rule("requests", "count()", "down", ChangeType.DROP, persist=(8, 10)),
    Rule("endpoints", "p95(span.duration)", "up", ChangeType.SLOWDOWN, slices=True),
    Rule("outbound_db", "p95(span.duration)", "up", ChangeType.SLOWDOWN, slices=True),
    Rule("outbound_http", "p95(span.duration)", "up", ChangeType.SLOWDOWN, slices=True),
    Rule("endpoints", "failure_rate()", "up", ChangeType.SPIKE, slices=True),
    Rule("outbound_http", "failure_rate()", "up", ChangeType.SPIKE, slices=True),
)


@dataclass
class DetectConfig:
    min_ratio: float = 1.5
    min_samples: float = 20.0
    min_abs_excess: float = 5.0
    min_latency_excess_ms: float = 20.0
    pseudo_events: float = 1.0
    windows: tuple[int, ...] = (5, 15, 60, 240)
    window_p: float = 3.2e-5
    hold_p: float = 0.01
    model_floor: float = 0.1
    latency_min_samples: float = 3.0  # For sustained severity, not to open or recover.
    escalate_factor: float = 3.0
    escalate_n: int = 3
    close_after: int = 10
    evidence_cap: float = 20.0
    chronic_hours: float = 24.0
    sustained: tuple[float, float] | None = (3.0, 30.0)


class RecentMinute(NamedTuple):
    """A minute's reading and whether it contributed anomaly evidence."""

    minute: datetime
    flagged: bool
    actual: float | None


@dataclass
class SeriesState:
    """Rolling evidence and a frozen baseline for one measured series."""

    recent: deque[RecentMinute] = field(default_factory=lambda: deque(maxlen=5))
    open: ChangeEvent | None = None
    anchor: datetime | None = None
    anchor_level: float | None = None
    anchor_sigma: float = 0.0
    anchor_points: int = 0
    excluded: set[datetime] = field(default_factory=set)
    score: float = 0.0
    level_ratio: float = 1.0
    worse_run: list[float] = field(default_factory=list)
    counts: deque[count_windows.CountTotals] | None = None
    window: int = 0
    failure_reference: tuple[float, float] | None = None
    closed_at: datetime | None = None
    recent_ratios: deque[float | None] = field(default_factory=lambda: deque(maxlen=30))


class SeriesHistory:
    """Shared measurement history and numerical helpers for excursion scoring."""

    def __init__(
        self,
        series: dict[SeriesKey, Series],
        baseline: Baseline,
        cfg: DetectConfig | None = None,
        exclude: Mapping[SeriesKey, str] | None = None,
    ):
        self.series = series
        self.baseline = baseline
        self.cfg = cfg or DetectConfig()
        self.exclude = dict(exclude) if exclude is not None else {}
        self.watched: dict[SeriesKey, Rule] = {}
        self.state: dict[SeriesKey, SeriesState] = {}
        self._pseudo: dict[tuple[SeriesKey, datetime], float] = {}
        self.refresh()

    def refresh(self, *, project: str | None = None) -> int:
        """Start watching newly available series; preserve existing episode state."""
        added = 0
        for key in sorted(self.series.keys() - self.watched.keys() - self.exclude.keys()):
            if project is not None and key.project != project:
                continue
            for rule in RULES:
                if (key.signal, key.metric, bool(key.dim_value)) != (
                    rule.signal,
                    rule.metric,
                    rule.slices,
                ):
                    continue
                if rule.only_without_traffic and has_traffic(self.series, key.project, key.env):
                    continue
                self.watched[key] = rule
                self.state[key] = SeriesState(recent=deque(maxlen=rule.persist[1]))
                added += 1
                break
        return added

    def prune_pseudo(self, hour: datetime, *, project: str) -> None:
        for key in list(self._pseudo):
            if key[0].project == project and key[1] != hour:
                del self._pseudo[key]

    def has_novelty_observation(self, key: SeriesKey, minute: datetime) -> bool:
        rule = self.watched.get(key)
        if rule is None or key in self.exclude or self._get(key, minute) is None:
            return False
        if rule.change == ChangeType.SLOWDOWN:
            samples = self._get(samples_key(key), minute)
            return samples is not None and samples >= self.cfg.min_samples
        return True

    def _get(self, key: SeriesKey, t: datetime) -> float | None:
        return self.series.get(key, {}).get(t)

    def _window_median(self, key: SeriesKey, t: datetime) -> float:
        series = self.series.get(key, {})
        values = sorted(
            value for i in range(1, 61) if (value := series.get(t - i * MINUTE)) is not None
        )
        return values[len(values) // 2] if values else 0.0

    def pseudo(self, key: SeriesKey, t: datetime) -> float:
        """Size changes against a one-event prior at the usual volume, not an exact zero."""
        volume_key = weight_key(key)
        if volume_key is None:
            return self.cfg.pseudo_events if key.metric.startswith("count") else 1e-9
        cache_key = (key, t.replace(minute=0))
        if cache_key not in self._pseudo:
            typical = self._window_median(volume_key, t)
            self._pseudo[cache_key] = (
                min(1.0, self.cfg.pseudo_events / typical) if typical > 0 else 1.0
            )
        return self._pseudo[cache_key]

    def _expected(
        self, key: SeriesKey, state: SeriesState, minute: datetime
    ) -> ExpectedValue | None:
        if state.anchor_level is not None:
            return self.baseline.anchored(
                key, minute, state.anchor_level, state.anchor_sigma, state.anchor_points
            )
        weights = weight_key(key)
        return self.baseline.expected(
            key,
            self.series.get(key, {}),
            minute,
            state.excluded,
            weights=self.series.get(weights) if weights else None,
            pending={reading.minute for reading in state.recent if reading.flagged}
            if weights
            else None,
        )

    def _step_series(
        self, key: SeriesKey, rule: Rule, minute: datetime
    ) -> tuple[str, ChangeEvent] | None:
        cfg, state = self.cfg, self.state[key]
        if (
            state.open is None
            and rule.only_without_traffic
            and has_traffic(self.series, key.project, key.env)
        ):
            state.recent.clear()
            state.counts = None
            return None
        actual = self._get(key, minute)
        parts = rate_parts(key)
        is_latency = rule.change == ChangeType.SLOWDOWN
        sampled_share = is_share(key)
        sample_key = samples_key(key)
        samples = self._get(sample_key, minute)
        counted = bool(cfg.windows) and (
            parts is not None or sampled_share or (key.signal, key.metric) == ("errors", "count()")
        )
        if counted and state.counts is None:
            state.counts = deque(
                [count_windows.CountTotals(None, 0, 0, 0, 0, 0, 0, None)],
                maxlen=max(cfg.windows) + count_windows.DISPERSION_MIN + 1,
            )
        # Exclusions only affect recent baseline windows; the open episode's reference is frozen.
        horizon = self.baseline.cfg.window_min + self.baseline.cfg.reach_back_min
        state.excluded.discard(minute - (horizon + 1) * MINUTE)

        rate_events, rate_denominator, rate_samples = (
            (self._get(k, minute) for k in parts) if parts else (None, None, None)
        )
        rate_missing = parts is not None and (
            rate_events is None or not rate_denominator or not rate_samples
        )
        share_missing = sampled_share and not samples
        drop_missing = rule.direction == "down" and sample_key in self.series and samples is None
        if actual is None or rate_missing or share_missing or drop_missing:
            if counted:
                assert state.counts is not None
                # Explicit zero sample trials contribute nothing; unknown coverage invalidates the window.
                zero_trials = (sampled_share and samples == 0) or (
                    key.signal == "failed_rate" and rate_samples == rate_events == 0
                )
                count_windows.push(state.counts, minute, missing=not zero_trials)
            self._unavailable(state, minute, is_latency)
            return None
        expectation = self._expected(key, state, minute)
        if expectation is None:
            if counted:
                assert state.counts is not None
                count_windows.push(state.counts, minute, missing=True)
            self._unavailable(state, minute, is_latency)
            return None

        prior = self.pseudo(key, minute)
        ratio = (actual + prior) / (expectation.expected + prior)
        up = rule.direction == "up"
        passes_ratio = ratio >= cfg.min_ratio if up else ratio <= 1 / cfg.min_ratio
        z = zscore(expectation, actual) if passes_ratio else 0.0
        k = self.baseline.cfg.k
        beyond = z > k if up else z < -k
        if up:
            valid, enough = self._up_evidence(
                key,
                rule,
                actual,
                expectation.expected,
                samples,
                rate_events,
                rate_denominator,
                rate_samples,
            )
        elif samples is None:
            valid, enough = True, expectation.expected >= cfg.min_samples
        else:
            valid = samples >= cfg.min_samples
            # A genuine drop reduces its own sample count. Judge it against its pre-drop volume,
            # and retain that evidence once the drop is open.
            enough = beyond and (
                state.open is not None or self._window_median(sample_key, minute) >= cfg.min_samples
            )
        flagged = beyond and enough
        if is_latency:
            state.recent_ratios.append(ratio if (samples or 0) >= cfg.latency_min_samples else None)

        measurement = count_windows.Measurement(actual, expectation.expected, ratio, z)
        hit = None
        if counted:
            assert state.counts is not None
            count_windows.record(
                state.counts,
                minute,
                expectation,
                actual,
                samples,
                rate_events,
                rate_denominator,
                rate_samples,
                distinct_rate_samples=parts is not None and parts[1] != parts[2],
                cfg=cfg,
                shape=self.baseline.shape(key, minute),
            )
            if not flagged:
                if state.open is None or state.window:
                    hit = count_windows.window_test(
                        state,
                        expectation,
                        cfg,
                        self.baseline,
                        cfg.window_p,
                        only_minutes=state.window,
                    )
                if hit is not None:
                    measurement = hit.measurement
                    flagged = beyond = True
                elif state.open is not None and (state.window or not valid):
                    valid, held = count_windows.pooled_recovery(
                        state, expectation, cfg, self.baseline
                    )
                    beyond = beyond or held

        state.recent.append(RecentMinute(minute, flagged, actual))
        if state.open is None:
            if flagged and sum(reading.flagged for reading in state.recent) >= rule.persist[0]:
                return self._open_episode(rule, state, expectation, measurement, hit)
            return None
        return self._update_episode(state, rule, minute, measurement, beyond, flagged, valid)

    @staticmethod
    def _unavailable(state: SeriesState, minute: datetime, is_latency: bool) -> None:
        state.recent.append(RecentMinute(minute, flagged=False, actual=None))
        state.worse_run.clear()
        if is_latency:
            state.recent_ratios.append(None)

    def _up_evidence(
        self,
        key: SeriesKey,
        rule: Rule,
        actual: float,
        expected: float,
        samples: float | None,
        rate_events: float | None,
        rate_denominator: float | None,
        rate_samples: float | None,
    ) -> tuple[bool, bool]:
        """Return whether normal and anomalous readings are sufficiently supported, respectively."""
        cfg = self.cfg
        if rate_events is not None and rate_denominator and rate_samples:
            valid = rate_samples >= cfg.min_samples
            return valid, valid and rate_events - expected * rate_denominator >= cfg.min_abs_excess
        if is_share(key):
            share_samples = samples or 0.0
            valid = share_samples >= cfg.min_samples
            return valid, valid and (actual - expected) * share_samples >= cfg.min_abs_excess
        if rule.change == ChangeType.SLOWDOWN:
            valid = (samples or 0.0) >= cfg.min_samples
            return valid, valid and actual - expected >= cfg.min_latency_excess_ms
        return True, actual - expected >= cfg.min_abs_excess

    def _open_episode(
        self,
        rule: Rule,
        state: SeriesState,
        expectation: ExpectedValue,
        measurement: count_windows.Measurement,
        hit: count_windows.WindowHit | None,
    ) -> tuple[str, ChangeEvent]:
        key, minute = expectation.key, expectation.ts
        actual, expected, ratio, z = measurement
        flagged_readings = [reading for reading in state.recent if reading.flagged]
        anchor = start = flagged_readings[0].minute
        change = rule.change
        if change == ChangeType.DROP and all(reading.actual == 0 for reading in flagged_readings):
            change = ChangeType.SILENCE
        window_minutes = hit.minutes if hit else 0
        if window_minutes:
            assert state.counts is not None
            start = min(
                start, count_windows.excess_start(state.counts, window_minutes, self.cfg.min_ratio)
            )
        event = ChangeEvent(
            key,
            change,
            start,
            actual,
            expected,
            _confidence(z, self.baseline.cfg.k),
            detected_at=minute,
            peak_ratio=ratio,
            open_ratio=ratio,
        )
        if window_minutes:
            if window_minutes >= 60 and window_minutes % 60 == 0:
                label = f"{window_minutes // 60}h"
            else:
                label = f"{window_minutes}m"
            event.evidence.append(f"{label} of counts: too many to be chance at this volume")
        anchor_expectation = self.baseline.expected(
            key,
            self.series[key],
            anchor,
            state.excluded,
            weights=self.series.get(weights) if (weights := weight_key(key)) else None,
        )
        if anchor_expectation is None:
            anchor, anchor_expectation = minute, expectation
        state.anchor = anchor
        state.anchor_level = anchor_expectation.expected / self.baseline.shape(key, anchor)
        state.anchor_sigma = anchor_expectation.sigma
        state.anchor_points = anchor_expectation.point_count
        state.excluded.update(reading.minute for reading in flagged_readings)
        if key.signal == "failed_rate" or is_share(key):
            state.failure_reference = (
                hit.failure_reference
                if hit
                else count_windows.failure_reference(self._get, key, state.excluded, anchor)
            )
        state.open = event
        state.window = window_minutes
        state.score = float(self.cfg.close_after)
        state.level_ratio = ratio
        state.worse_run.clear()
        return "open", event

    def _update_episode(
        self,
        state: SeriesState,
        rule: Rule,
        minute: datetime,
        measurement: count_windows.Measurement,
        beyond: bool,
        flagged: bool,
        valid: bool,
    ) -> tuple[str, ChangeEvent] | None:
        cfg = self.cfg
        event = state.open
        assert event is not None
        actual, expected, ratio, z = measurement
        if flagged:
            state.score = min(cfg.evidence_cap, state.score + 1)
        elif valid and not beyond:
            state.score = max(0.0, state.score - 1)
        if rule.change == ChangeType.SLOWDOWN:
            duration = (minute - event.start) // MINUTE
            recent = [r for r in list(state.recent_ratios)[-duration - 1 :] if r is not None]
            event.recent_ratio = median(recent) if len(recent) >= 15 else None
            if cfg.sustained and event.sustained_at is None and event.recent_ratio is not None:
                min_ratio, minutes = cfg.sustained
                if event.recent_ratio >= min_ratio and duration >= minutes:
                    event.sustained_at = minute
        state.excluded.add(minute)
        direction = 1 if rule.direction == "up" else -1
        if flagged or valid:
            if (ratio - event.peak_ratio) * direction > 0:
                event.peak_ratio, event.actual, event.expected = ratio, actual, expected
                if z:
                    event.confidence = max(event.confidence, _confidence(z, self.baseline.cfg.k))
        if flagged and direction * math.log(ratio / state.level_ratio) >= math.log(
            cfg.escalate_factor
        ):
            state.worse_run.append(ratio)
        else:
            state.worse_run.clear()
        if len(state.worse_run) >= cfg.escalate_n:
            state.level_ratio = median(state.worse_run)
            event.escalations.append((minute - (cfg.escalate_n - 1) * MINUTE, state.level_ratio))
            state.worse_run.clear()
            return "escalate", event
        if state.score == 0:
            return self._close_episode(state, event, minute, chronic=False)
        if flagged and minute - event.start >= timedelta(hours=cfg.chronic_hours):
            return self._close_episode(state, event, minute, chronic=True)
        return None

    def _close_episode(
        self, st: SeriesState, event: ChangeEvent, t: datetime, chronic: bool
    ) -> tuple[str, ChangeEvent]:
        event.ended_at = t
        if chronic:
            event.evidence.append(
                f"chronic: not recovered after {self.cfg.chronic_hours:g}h, taken as the new level"
            )
            st.excluded = {minute for minute in st.excluded if minute < event.start}
        else:
            event.evidence.append("recovered")
        st.open = st.anchor = st.anchor_level = None
        st.anchor_sigma = 0.0
        st.anchor_points = 0
        st.score = 0.0
        st.window = 0
        st.failure_reference = None
        st.closed_at = t
        st.recent.clear()
        st.recent_ratios.clear()
        return ("expire" if chronic else "close"), event


def _confidence(z: float, k: float) -> float:
    return round(min(0.99, 0.5 + 0.1 * (abs(z) - k)), 2)
