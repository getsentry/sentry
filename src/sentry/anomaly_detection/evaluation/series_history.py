"""Minute-by-minute anomaly detection over aggregates, independent of collection."""

import math
from collections import deque
from collections.abc import Iterable
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from statistics import median
from typing import Literal, NamedTuple

from sentry.anomaly_detection.contracts import (
    ChangeAction,
    ChangeEvent,
    ChangeType,
    ExpectedValue,
    Metric,
    SeriesKey,
    Signal,
)
from sentry.anomaly_detection.evaluation import count_windows, quality
from sentry.anomaly_detection.evaluation.baseline import MINUTE, Baseline, weight_key, zscore
from sentry.anomaly_detection.evaluation.series import (
    Series,
    has_traffic,
    is_share,
    rate_parts,
    samples_key,
    uses_trials,
)


@dataclass(frozen=True)
class Rule:
    signal: Signal
    metric: Metric
    direction: Literal["up", "down"]
    change: ChangeType
    slices: bool = False
    only_without_traffic: bool = False
    persist: tuple[int, int] = (3, 5)


RULES = (
    Rule(Signal.ERROR_RATE, Metric.ERRORS_PER_REQUEST, "up", ChangeType.SPIKE),
    Rule(Signal.FAILED_RATE, Metric.FAILED_PER_REQUEST, "up", ChangeType.SPIKE),
    Rule(Signal.ERRORS, Metric.COUNT_UNIQUE_USER, "up", ChangeType.SPIKE),
    Rule(Signal.ERRORS, Metric.COUNT, "up", ChangeType.SPIKE, only_without_traffic=True),
    Rule(Signal.REQUESTS, Metric.COUNT, "down", ChangeType.DROP, persist=(8, 10)),
    Rule(Signal.ENDPOINTS, Metric.P95_DURATION, "up", ChangeType.SLOWDOWN, slices=True),
    Rule(Signal.OUTBOUND_DB, Metric.P95_DURATION, "up", ChangeType.SLOWDOWN, slices=True),
    Rule(Signal.OUTBOUND_HTTP, Metric.P95_DURATION, "up", ChangeType.SLOWDOWN, slices=True),
    Rule(Signal.ENDPOINTS, Metric.FAILURE_RATE, "up", ChangeType.SPIKE, slices=True),
    Rule(Signal.OUTBOUND_HTTP, Metric.FAILURE_RATE, "up", ChangeType.SPIKE, slices=True),
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


@dataclass
class SeriesHistoryState:
    """Watched series, their rolling evidence, and exclusions; everything a restart needs."""

    watched: dict[SeriesKey, Rule] = field(default_factory=dict)
    series_states: dict[SeriesKey, SeriesState] = field(default_factory=dict)
    exclude: dict[SeriesKey, str] = field(default_factory=dict)
    # Pseudo-event floors are computed on the first observation in an hour, not at the
    # hour boundary; recomputing a floor mid-hour after a restart would change sizing.
    pseudo: dict[tuple[SeriesKey, datetime], float] = field(default_factory=dict)


class SeriesHistory:
    """Shared measurement history and numerical helpers for excursion scoring."""

    def __init__(
        self,
        series: dict[SeriesKey, Series],
        baseline: Baseline,
        cfg: DetectConfig | None = None,
        state: SeriesHistoryState | None = None,
    ):
        self.series = series
        self.baseline = baseline
        self.cfg = cfg or DetectConfig()
        self.state = state or SeriesHistoryState()
        self.refresh()

    def refresh(self, *, project_id: int | None = None) -> int:
        """Start watching newly available series; preserve existing episode state."""
        added = 0
        state = self.state
        for key in sorted(self.series.keys() - state.watched.keys() - state.exclude.keys()):
            if project_id is not None and key.project_id != project_id:
                continue
            for rule in RULES:
                if (key.signal, key.metric, bool(key.dim_value)) != (
                    rule.signal,
                    rule.metric,
                    rule.slices,
                ):
                    continue
                if rule.only_without_traffic and has_traffic(self.series, key.project_id, key.env):
                    continue
                state.watched[key] = rule
                state.series_states[key] = SeriesState(recent=deque(maxlen=rule.persist[1]))
                added += 1
                break
        return added

    def prune_pseudo(self, hour: datetime, *, project_id: int) -> None:
        pseudo = self.state.pseudo
        for key in list(pseudo):
            if key[0].project_id == project_id and key[1] != hour:
                del pseudo[key]

    def check_quality(self, minute: datetime, *, project_id: int) -> None:
        """Exclude series whose last hour can't support detection; restore recovered ones.

        Uses only observed history and doesn't abandon recovery of an open excursion.
        """
        recent_minutes = [minute - offset * MINUTE for offset in range(60)]
        measurements = {
            key: {
                observed_minute: values[observed_minute]
                for observed_minute in recent_minutes
                if observed_minute in values
            }
            for key, values in self.series.items()
            if key.project_id == project_id
            and key.metric in (Metric.P95_DURATION, Metric.COUNT_SAMPLE)
        }
        state = self.state
        restored_series = False
        for key, invalid_reason in quality.check(measurements).items():
            if invalid_reason is not None:
                state.exclude[key] = invalid_reason
            elif state.exclude.pop(key, None) is not None:
                restored_series = True
        for key in state.exclude.keys() & state.watched.keys():
            if key.project_id == project_id and state.series_states[key].open is None:
                del state.watched[key]
                del state.series_states[key]
        if restored_series:
            self.refresh(project_id=project_id)

    def has_novelty_observation(self, key: SeriesKey, minute: datetime) -> bool:
        rule = self.state.watched.get(key)
        if rule is None or key in self.state.exclude or self._get(key, minute) is None:
            return False
        if rule.change == ChangeType.SLOWDOWN:
            samples = self._get(samples_key(key), minute)
            return samples is not None and samples >= self.cfg.min_samples
        return True

    def has_anomalous_observation(self, event: ChangeEvent, minute: datetime) -> bool:
        """Whether this tick's minute or window test flagged the active episode."""
        state = self.state.series_states.get(event.key)
        if (
            state is None
            or state.open is not event
            or event.key in self.state.exclude
            or not state.recent
        ):
            return False
        reading = state.recent[-1]
        return reading.minute == minute and reading.flagged

    def open_keys(self) -> set[SeriesKey]:
        return {key for key, state in self.state.series_states.items() if state.open}

    def expire(self, key: SeriesKey, at: datetime, reason: str) -> ChangeEvent | None:
        """End the series' open episode without observing recovery, and reset its evidence."""
        state = self.state.series_states.get(key)
        if state is None or state.open is None:
            return None
        event = state.open
        event.ended_at = at
        event.evidence.append(reason)
        self.state.series_states[key] = SeriesState(recent=deque(maxlen=state.recent.maxlen))
        return event

    def forget(self, keys: Iterable[SeriesKey]) -> None:
        state = self.state
        forgotten = set(keys)
        for key in forgotten:
            state.watched.pop(key, None)
            state.series_states.pop(key, None)
            state.exclude.pop(key, None)
        for pseudo_key in [pseudo_key for pseudo_key in state.pseudo if pseudo_key[0] in forgotten]:
            del state.pseudo[pseudo_key]

    def drop_projects(self, keep: set[int]) -> None:
        state = self.state
        keys = state.watched.keys() | state.series_states.keys() | state.exclude.keys()
        keys |= {key for key, _ in state.pseudo}
        self.forget(key for key in keys if key.project_id not in keep)

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
            return self.cfg.pseudo_events if key.metric.is_count else 1e-9
        cache_key = (key, t.replace(minute=0))
        pseudo = self.state.pseudo
        if cache_key not in pseudo:
            typical = self._window_median(volume_key, t)
            pseudo[cache_key] = min(1.0, self.cfg.pseudo_events / typical) if typical > 0 else 1.0
        return pseudo[cache_key]

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

    def step_series(self, key: SeriesKey, rule: Rule, minute: datetime) -> ChangeAction | None:
        cfg, state = self.cfg, self.state.series_states[key]
        # An excluded series can finish recovering, but cannot reopen before the
        # next quality check re-enables it.
        if state.open is None and (
            key in self.state.exclude
            or (rule.only_without_traffic and has_traffic(self.series, key.project_id, key.env))
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
            parts is not None
            or sampled_share
            or (key.signal, key.metric) == (Signal.ERRORS, Metric.COUNT)
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
                    key.signal == Signal.FAILED_RATE and rate_samples == rate_events == 0
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
        observation = count_windows.Reading(
            actual, samples, rate_events, rate_denominator, rate_samples
        )

        prior = self.pseudo(key, minute)
        ratio = (actual + prior) / (expectation.expected + prior)
        up = rule.direction == "up"
        passes_ratio = ratio >= cfg.min_ratio if up else ratio <= 1 / cfg.min_ratio
        z = zscore(expectation, actual) if passes_ratio else 0.0
        k = self.baseline.cfg.k
        beyond = z > k if up else z < -k
        if up:
            minute_valid, enough = self._up_evidence(key, rule, expectation.expected, observation)
        elif samples is None:
            minute_valid, enough = True, expectation.expected >= cfg.min_samples
        else:
            minute_valid = samples >= cfg.min_samples
            # A genuine drop reduces its own sample count. Judge it against its pre-drop volume,
            # and retain that evidence once the drop is open.
            enough = beyond and (
                state.open is not None or self._window_median(sample_key, minute) >= cfg.min_samples
            )
        flagged = beyond and enough
        recovery_valid = minute_valid
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
                observation,
                distinct_rate_samples=parts is not None and parts[1] != parts[2],
                cfg=cfg,
                shape=self.baseline.shape(key, minute),
                episode_open=state.open is not None,
                closed_at=state.closed_at,
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
                elif state.open is not None and (state.window or not minute_valid):
                    recovery_valid, held = count_windows.pooled_recovery(
                        state, expectation, cfg, self.baseline
                    )
                    beyond = beyond or held

        state.recent.append(RecentMinute(minute, flagged, actual))
        if state.open is None:
            if flagged and sum(reading.flagged for reading in state.recent) >= rule.persist[0]:
                return self._open_episode(rule, state, expectation, measurement, hit)
            return None
        return self._update_episode(
            state,
            rule,
            minute,
            measurement,
            beyond=beyond,
            flagged=flagged,
            recovery_valid=recovery_valid,
            # Pooled recovery can be measurable without making the raw minute
            # trustworthy. Only a strong window hit replaces its measurement.
            update_evidence=flagged or minute_valid,
        )

    @staticmethod
    def _unavailable(state: SeriesState, minute: datetime, is_latency: bool) -> None:
        state.recent.append(RecentMinute(minute, flagged=False, actual=None))
        state.worse_run.clear()
        if is_latency:
            state.recent_ratios.append(None)

    def _up_evidence(
        self, key: SeriesKey, rule: Rule, expected: float, observation: count_windows.Reading
    ) -> tuple[bool, bool]:
        """Return whether normal and anomalous readings are sufficiently supported, respectively."""
        cfg = self.cfg
        actual, samples, rate_events, rate_denominator, rate_samples = observation
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
    ) -> ChangeAction:
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
        if hit is not None and hit.level is not None:
            # Hold the episode to the level its counts opened against; a sparse median is zero.
            state.anchor_level = max(state.anchor_level, hit.level)
        state.anchor_sigma = anchor_expectation.sigma
        state.anchor_points = anchor_expectation.point_count
        state.excluded.update(reading.minute for reading in flagged_readings)
        if uses_trials(key):
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
        *,
        beyond: bool,
        flagged: bool,
        recovery_valid: bool,
        update_evidence: bool,
    ) -> ChangeAction | None:
        cfg = self.cfg
        event = state.open
        assert event is not None
        actual, expected, ratio, z = measurement
        if flagged:
            state.score = min(cfg.evidence_cap, state.score + 1)
        elif recovery_valid and not beyond:
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
        if update_evidence and (ratio - event.peak_ratio) * direction > 0:
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
    ) -> ChangeAction:
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
