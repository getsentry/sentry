"""Rolling count evidence and predictive tests for sparse series."""

from __future__ import annotations

import math
from collections import deque
from collections.abc import Callable
from datetime import datetime
from typing import TYPE_CHECKING, NamedTuple

from sentry.anomaly_detection.contracts import ExpectedValue, SeriesKey, Signal
from sentry.anomaly_detection.evaluation.baseline import MINUTE, Baseline, weight_key
from sentry.anomaly_detection.evaluation.series import is_share

if TYPE_CHECKING:
    from sentry.anomaly_detection.evaluation.series_history import DetectConfig, SeriesState

DISPERSION_MIN = 60


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


def record(
    counts: deque[CountTotals],
    minute: datetime,
    expectation: ExpectedValue,
    actual: float,
    samples: float | None,
    rate_events: float | None,
    rate_denominator: float | None,
    rate_samples: float | None,
    *,
    distinct_rate_samples: bool,
    cfg: DetectConfig,
    shape: float,
) -> None:
    if rate_events is not None:
        assert rate_denominator and rate_samples
        observed_events, denominator = rate_events, rate_denominator
        extra_noise = rate_samples if distinct_rate_samples else 0.0
        volume = rate_samples / cfg.min_samples
    elif is_share(expectation.key):
        assert samples
        observed_events = float(round(actual * samples))
        denominator, extra_noise = samples, 0.0
        volume = samples / cfg.min_samples
    else:
        observed_events, denominator, extra_noise = actual, 1.0, 0.0
        volume = expectation.expected / cfg.min_abs_excess
    push(
        counts,
        minute,
        observed_events,
        expectation.expected * denominator,
        extra_noise,
        volume,
        denominator * shape,
        expectation.expected / shape,
    )


def _can_measure_window(
    counts: deque[CountTotals], closed_at: datetime | None, window_minutes: int
) -> bool:
    if len(counts) <= window_minutes:
        return False
    before_window = counts[-1 - window_minutes]
    if closed_at is not None and (before_window.ts is None or before_window.ts < closed_at):
        return False
    return counts[-1].missing == before_window.missing


def pooled_recovery(
    state: SeriesState, expectation: ExpectedValue, cfg: DetectConfig, baseline: Baseline
) -> tuple[bool, bool]:
    """Return whether a window is measurable and whether it still shows an excess."""
    counts = state.counts
    key = expectation.key
    if (key.signal == Signal.FAILED_RATE or is_share(key)) and state.failure_reference is None:
        return False, False
    assert counts is not None
    for window_minutes in (state.window,) if state.window else cfg.windows:
        if not _can_measure_window(counts, state.closed_at, window_minutes):
            continue
        if weight_key(key) and counts[-1].volume - counts[-1 - window_minutes].volume < 1:
            continue
        hit = window_test(
            state, expectation, cfg, baseline, cfg.hold_p, only_minutes=window_minutes
        )
        return True, hit is not None
    return False, False


def window_test(
    state: SeriesState,
    expectation: ExpectedValue,
    cfg: DetectConfig,
    baseline: Baseline,
    p_max: float,
    *,
    only_minutes: int = 0,
) -> WindowHit | None:
    """Return the shortest window with enough evidence to reject its baseline."""
    counts = state.counts
    assert counts is not None
    uses_trials = expectation.key.signal == Signal.FAILED_RATE or is_share(expectation.key)
    min_excess = cfg.min_abs_excess if p_max <= cfg.window_p else 1.0
    candidate_windows = (only_minutes,) if only_minutes else _windows_for(cfg, counts)
    for window_minutes in candidate_windows:
        if not _can_measure_window(counts, state.closed_at, window_minutes):
            continue
        if uses_trials:
            hit = _share_test(cfg, state, window_minutes, min_excess, p_max)
        else:
            hit = _count_test(cfg, baseline, state, expectation, window_minutes, min_excess, p_max)
        if hit is not None:
            return hit
    return None


def _count_test(
    cfg: DetectConfig,
    baseline: Baseline,
    state: SeriesState,
    expectation: ExpectedValue,
    window_minutes: int,
    min_excess: float,
    p_max: float,
) -> WindowHit | None:
    """Compare counts against a frozen baseline using a negative binomial tail."""
    counts = state.counts
    assert counts is not None
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
    tail_probability = _nb_sf(observed_events, prior_adjusted_expectation, 1 / relative_variance)
    if tail_probability < p_max:
        denominator: float = window_minutes
        if weight_key(expectation.key):
            denominator = sum(
                (counts[i].shaped_denominator - counts[i - 1].shaped_denominator)
                / baseline.shape(expectation.key, counts[i].ts or expectation.ts)
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


def _windows_for(cfg: DetectConfig, counts: deque[CountTotals]) -> tuple[int, ...]:
    """Try windows only when a minute lacks the volume to judge on its own."""
    horizon = min(60, len(counts) - 1)
    if horizon < 10:
        return ()
    volume_per_minute = (counts[-1].volume - counts[-1 - horizon].volume) / horizon
    if volume_per_minute >= 1:
        return ()
    windows = cfg.windows
    first = next(
        (i for i, minutes in enumerate(windows) if minutes * volume_per_minute >= 1),
        len(windows) - 1,
    )
    return windows[first : first + 2]


def failure_reference(
    get: Callable[[SeriesKey, datetime], float | None],
    key: SeriesKey,
    excluded: set[datetime],
    end_minute: datetime,
) -> tuple[float, float] | None:
    trial_key = weight_key(key)
    assert trial_key is not None
    events = trials = 0.0
    for age in range(1, DISPERSION_MIN + 1):
        minute = end_minute - age * MINUTE
        if minute in excluded:
            continue
        rate, volume = get(key, minute), get(trial_key, minute)
        if rate is not None and volume:
            events += round(rate * volume)
            trials += volume
    return (events, trials) if trials else None


def _failure_history(
    cfg: DetectConfig, counts: deque[CountTotals], end_index: int
) -> tuple[float, float] | None:
    start_index = max(0, end_index - DISPERSION_MIN)
    before_history, history_end = counts[start_index], counts[end_index]
    if end_index - start_index - (history_end.missing - before_history.missing) < 10:
        return None
    trials = (history_end.volume - before_history.volume) * cfg.min_samples
    return (history_end.events - before_history.events, trials) if trials >= 1 else None


def _share_test(
    cfg: DetectConfig, state: SeriesState, window_minutes: int, min_excess: float, p_max: float
) -> WindowHit | None:
    """Compare sampled failures over sampled trials using a beta-binomial predictive tail."""
    counts = state.counts
    assert counts is not None
    before_window_index = len(counts) - 1 - window_minutes
    reference = (
        state.failure_reference
        if state.open is not None
        else _failure_history(cfg, counts, before_window_index)
    )
    if reference is None:
        return None
    reference_events, reference_trials = reference
    before_window, window_end = counts[before_window_index], counts[-1]
    observed_events = window_end.events - before_window.events
    trials = (window_end.volume - before_window.volume) * cfg.min_samples
    if trials < 1:
        return None
    expected_events = trials * (reference_events + 0.5) / (reference_trials + 1)
    ratio = (observed_events + 1) / (expected_events + 1)
    if observed_events - expected_events < min_excess or ratio < cfg.min_ratio:
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


def push(
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


def excess_start(counts: deque[CountTotals], window_minutes: int, min_ratio: float) -> datetime:
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
