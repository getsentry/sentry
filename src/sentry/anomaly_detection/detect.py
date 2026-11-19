"""Minute-by-minute anomaly detection over aggregates, independent of collection."""

import math
from collections import deque
from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from statistics import median
from typing import Literal, NamedTuple

from sentry.anomaly_detection.baseline import MINUTE, Baseline, weight_key, zscore
from sentry.anomaly_detection.contracts import ChangeEvent, ChangeType, ExpectedValue, SeriesKey
from sentry.anomaly_detection.series import Series, has_traffic, is_share, rate_parts, samples_key

DISPERSION_MIN = 60


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


class CountTotals(NamedTuple):
    """Rolling sums through ts, except level (the baseline fitted at ts)."""

    ts: datetime | None
    events: float
    expected: float
    samples: float
    missing: int
    volume: float
    shaped_denominator: float
    level: float | None


class Measurement(NamedTuple):
    actual: float
    expected: float
    ratio: float
    z: float


class WindowHit(NamedTuple):
    minutes: int
    measurement: Measurement
    failure_reference: tuple[float, float] | None = None


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
    counts: deque[CountTotals] | None = None
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
                [CountTotals(None, 0, 0, 0, 0, 0, 0, None)],
                maxlen=max(cfg.windows) + DISPERSION_MIN + 1,
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
                _push(state.counts, minute, missing=not zero_trials)
            self._unavailable(state, minute, is_latency)
            return None
        expectation = self._expected(key, state, minute)
        if expectation is None:
            if counted:
                assert state.counts is not None
                _push(state.counts, minute, missing=True)
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

        measurement = Measurement(actual, expectation.expected, ratio, z)
        hit = None
        if counted:
            assert state.counts is not None
            if parts:
                assert rate_events is not None and rate_denominator and rate_samples
                observed_events, denominator = rate_events, rate_denominator
                extra_noise = rate_samples if parts[1] != parts[2] else 0.0
                volume = rate_samples / cfg.min_samples
            elif sampled_share:
                assert samples
                observed_events = float(round(actual * samples))
                denominator, extra_noise = samples, 0.0
                volume = samples / cfg.min_samples
            else:
                observed_events, denominator, extra_noise = actual, 1.0, 0.0
                volume = expectation.expected / cfg.min_abs_excess
            shape = self.baseline.shape(key, minute)
            _push(
                state.counts,
                minute,
                observed_events,
                expectation.expected * denominator,
                extra_noise,
                volume,
                denominator * shape,
                expectation.expected / shape,
            )
            if not flagged:
                if state.open is None or state.window:
                    hit = self._window_test(
                        state, expectation, cfg.window_p, only_minutes=state.window
                    )
                if hit is not None:
                    measurement = hit.measurement
                    flagged = beyond = True
                elif state.open is not None and (state.window or not valid):
                    valid, held = self._pooled_recovery(state, expectation)
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
        measurement: Measurement,
        hit: WindowHit | None,
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
            start = min(start, _excess_start(state.counts, window_minutes, self.cfg.min_ratio))
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
                hit.failure_reference if hit else self._failure_reference(key, state, anchor)
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
        measurement: Measurement,
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

    @staticmethod
    def _can_measure_window(state: SeriesState, window_minutes: int) -> bool:
        counts = state.counts
        assert counts is not None
        if len(counts) <= window_minutes:
            return False
        before_window = counts[-1 - window_minutes]
        if state.closed_at is not None and (
            before_window.ts is None or before_window.ts < state.closed_at
        ):
            return False
        return counts[-1].missing == before_window.missing

    def _pooled_recovery(self, state: SeriesState, expectation: ExpectedValue) -> tuple[bool, bool]:
        """Return whether a window is measurable and whether it still shows an excess."""
        counts = state.counts
        key = expectation.key
        if (key.signal == "failed_rate" or is_share(key)) and state.failure_reference is None:
            return False, False
        assert counts is not None
        for window_minutes in (state.window,) if state.window else self.cfg.windows:
            if not self._can_measure_window(state, window_minutes):
                continue
            if weight_key(key) and counts[-1].volume - counts[-1 - window_minutes].volume < 1:
                continue
            hit = self._window_test(
                state, expectation, self.cfg.hold_p, only_minutes=window_minutes
            )
            return True, hit is not None
        return False, False

    def _window_test(
        self, state: SeriesState, expectation: ExpectedValue, p_max: float, *, only_minutes: int = 0
    ) -> WindowHit | None:
        """Return the shortest window with enough evidence to reject its baseline."""
        counts = state.counts
        assert counts is not None
        uses_trials = expectation.key.signal == "failed_rate" or is_share(expectation.key)
        min_excess = self.cfg.min_abs_excess if p_max <= self.cfg.window_p else 1.0
        candidate_windows = (only_minutes,) if only_minutes else self._windows_for(counts)
        for window_minutes in candidate_windows:
            if not self._can_measure_window(state, window_minutes):
                continue
            if uses_trials:
                hit = self._share_test(state, window_minutes, min_excess, p_max)
            else:
                hit = self._count_test(state, expectation, window_minutes, min_excess, p_max)
            if hit is not None:
                return hit
        return None

    def _count_test(
        self,
        state: SeriesState,
        expectation: ExpectedValue,
        window_minutes: int,
        min_excess: float,
        p_max: float,
    ) -> WindowHit | None:
        """Compare counts against a frozen baseline using a negative binomial tail."""
        counts = state.counts
        assert counts is not None
        cfg = self.cfg
        before_window, window_end = counts[-1 - window_minutes], counts[-1]
        observed_events = window_end.events - before_window.events
        # Freeze the level at the start of the window; minute fits inside a sparse change
        # could absorb failures before enough evidence accumulates to open the episode.
        level = state.anchor_level if state.open is not None else before_window.level
        if level is None:
            level = counts[-window_minutes].level
        if level is None:
            return None
        expected_events = level * (window_end.shaped_denominator - before_window.shaped_denominator)
        if (
            observed_events - expected_events < min_excess
            or (observed_events + 1) / (expected_events + 1) < cfg.min_ratio
        ):
            return None

        baseline_points = expectation.point_count
        prior_adjusted_expectation = expected_events + 0.5 * window_minutes / baseline_points
        expected_per_minute = prior_adjusted_expectation / window_minutes
        sigma = expectation.sigma if expected_per_minute >= 5 else cfg.model_floor
        model_variance = max(cfg.model_floor**2, sigma**2 - 1 / max(expected_per_minute, 1.0))
        samples = window_end.samples - before_window.samples
        # Combine estimation uncertainty, model noise, event clumping, and sampling noise.
        relative_variance = (
            1 / (expected_per_minute * baseline_points)
            + model_variance
            + (_dispersion(counts, window_minutes) - 1) / prior_adjusted_expectation
        )
        if samples > 0:
            relative_variance += 1 / samples
        tail_probability = _nb_sf(
            observed_events, prior_adjusted_expectation, 1 / relative_variance
        )
        if tail_probability < p_max:
            denominator: float = window_minutes
            if weight_key(expectation.key):
                denominator = sum(
                    (counts[i].shaped_denominator - counts[i - 1].shaped_denominator)
                    / self.baseline.shape(expectation.key, counts[i].ts or expectation.ts)
                    for i in range(-window_minutes, 0)
                )
            if denominator:
                return WindowHit(
                    window_minutes,
                    Measurement(
                        observed_events / denominator,
                        expected_events / denominator,
                        (observed_events + 1) / (prior_adjusted_expectation + 1),
                        _score(tail_probability),
                    ),
                )
        return None

    def _windows_for(self, counts: deque[CountTotals]) -> tuple[int, ...]:
        """Try windows only when a minute lacks the volume to judge on its own."""
        horizon = min(60, len(counts) - 1)
        if horizon < 10:
            return ()
        volume_per_minute = (counts[-1].volume - counts[-1 - horizon].volume) / horizon
        if volume_per_minute >= 1:
            return ()
        windows = self.cfg.windows
        first = next(
            (i for i, minutes in enumerate(windows) if minutes * volume_per_minute >= 1),
            len(windows) - 1,
        )
        return windows[first : first + 2]

    def _failure_reference(
        self, key: SeriesKey, state: SeriesState, end_minute: datetime
    ) -> tuple[float, float] | None:
        trial_key = weight_key(key)
        assert trial_key is not None
        events = trials = 0.0
        for age in range(1, DISPERSION_MIN + 1):
            minute = end_minute - age * MINUTE
            if minute in state.excluded:
                continue
            rate, volume = self._get(key, minute), self._get(trial_key, minute)
            if rate is not None and volume:
                events += round(rate * volume)
                trials += volume
        return (events, trials) if trials else None

    def _failure_history(
        self, counts: deque[CountTotals], end_index: int
    ) -> tuple[float, float] | None:
        start_index = max(0, end_index - DISPERSION_MIN)
        before_history, history_end = counts[start_index], counts[end_index]
        if end_index - start_index - (history_end.missing - before_history.missing) < 10:
            return None
        trials = (history_end.volume - before_history.volume) * self.cfg.min_samples
        return (history_end.events - before_history.events, trials) if trials >= 1 else None

    def _share_test(
        self, state: SeriesState, window_minutes: int, min_excess: float, p_max: float
    ) -> WindowHit | None:
        """Compare sampled failures over sampled trials using a beta-binomial predictive tail."""
        counts = state.counts
        assert counts is not None
        before_window_index = len(counts) - 1 - window_minutes
        reference = (
            state.failure_reference
            if state.open is not None
            else self._failure_history(counts, before_window_index)
        )
        if reference is None:
            return None
        reference_events, reference_trials = reference
        before_window, window_end = counts[before_window_index], counts[-1]
        observed_events = window_end.events - before_window.events
        trials = (window_end.volume - before_window.volume) * self.cfg.min_samples
        if trials < 1:
            return None
        expected_events = trials * (reference_events + 0.5) / (reference_trials + 1)
        ratio = (observed_events + 1) / (expected_events + 1)
        if observed_events - expected_events < min_excess or ratio < self.cfg.min_ratio:
            return None
        # Do not estimate dispersion from potentially anomalous traffic inside an open episode.
        dispersion = 1.0 if state.open is not None else _dispersion(counts, window_minutes)
        tail_probability = _betabinom_sf(
            observed_events / dispersion,
            trials / dispersion,
            reference_events / dispersion + 0.5,
            max(0.0, reference_trials - reference_events) / dispersion + 0.5,
        )
        if tail_probability < p_max:
            return WindowHit(
                window_minutes,
                Measurement(
                    observed_events / trials,
                    expected_events / trials,
                    ratio,
                    _score(tail_probability),
                ),
                reference,
            )
        return None


def _push(
    counts: deque[CountTotals],
    minute: datetime,
    events: float = 0.0,
    expected: float = 0.0,
    samples: float = 0.0,
    volume: float = 0.0,
    shaped_denominator: float = 0.0,
    level: float | None = None,
    *,
    missing: bool = False,
) -> None:
    prev = counts[-1]
    counts.append(
        CountTotals(
            minute,
            prev.events + events,
            prev.expected + expected,
            prev.samples + samples,
            prev.missing + missing,
            prev.volume + volume,
            prev.shaped_denominator + shaped_denominator,
            level,
        )
    )


def _excess_start(counts: deque[CountTotals], window_minutes: int, min_ratio: float) -> datetime:
    """Find the suffix of the window with the most excess events."""
    start = counts[-1].ts
    best = excess = 0.0
    for i in range(-1, -1 - window_minutes, -1):
        after, before = counts[i], counts[i - 1]
        excess += after.events - before.events - min_ratio * (after.expected - before.expected)
        if excess > best:
            best, start = excess, after.ts
    assert start is not None
    return start


def _dispersion(counts: deque[CountTotals], window_minutes: int) -> float:
    """Pearson dispersion in the minutes before the candidate window, floored at Poisson."""
    history_end = len(counts) - 1 - window_minutes
    history_start = max(0, history_end - DISPERSION_MIN)
    if history_end - history_start < 10:
        return 1.0
    squared_residuals = total_expected_events = 0.0
    for i in range(history_start + 1, history_end + 1):
        current, previous = counts[i], counts[i - 1]
        if current.missing != previous.missing:
            continue
        observed_events = current.events - previous.events
        expected_events = current.expected - previous.expected
        squared_residuals += (observed_events - expected_events) ** 2
        total_expected_events += expected_events
    return max(1.0, squared_residuals / total_expected_events) if total_expected_events > 0 else 1.0


def _nb_sf(n: float, mean: float, size: float) -> float:
    """P(X >= n) for a negative binomial with the given mean and shape."""
    k = math.ceil(n - 1e-9)
    if k <= 0:
        return 1.0
    if mean <= 0:
        return 0.0
    size = min(size, 1e9)
    if k > 400:
        z = math.log(n / mean) / math.sqrt(1 / mean + 1 / size)
        return 0.5 * math.erfc(z / math.sqrt(2))
    q = mean / (size + mean)
    cdf, term = 0.0, math.exp(size * math.log1p(-q))
    for i in range(k):
        cdf += term
        term *= (i + size) / (i + 1) * q
    return max(0.0, 1.0 - cdf)


def _betabinom_sf(successes: float, trials: float, a: float, b: float) -> float:
    """P(X >= successes) for trials with an uncertain success rate Beta(a, b)."""
    k, n = math.ceil(successes - 1e-9), round(trials)
    if k <= 0:
        return 1.0
    if k > n:
        return 0.0
    if n > 3000:
        p = a / (a + b)
        var = n * p * (1 - p) * (a + b + n) / (a + b + 1)
        return 0.5 * math.erfc((k - 0.5 - n * p) / math.sqrt(2 * max(var, 1e-12)))
    lg = math.lgamma
    logp = (
        lg(n + 1)
        - lg(k + 1)
        - lg(n - k + 1)
        + lg(k + a)
        + lg(n - k + b)
        - lg(n + a + b)
        - (lg(a) + lg(b) - lg(a + b))
    )
    term, total = math.exp(logp), 0.0
    for x in range(k, n + 1):
        total += term
        if x < n:
            term *= (n - x) / (x + 1) * (x + a) / (n - x - 1 + b)
    return min(1.0, total)


def _score(p: float) -> float:
    return math.sqrt(max(0.0, -2 * math.log(max(p, 1e-300))))


def _confidence(z: float, k: float) -> float:
    return round(min(0.99, 0.5 + 0.1 * (abs(z) - k)), 2)
