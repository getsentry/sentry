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


@dataclass
class DetectorState:
    recent: deque[tuple[datetime, bool, float | None]] = field(
        default_factory=lambda: deque(maxlen=5)
    )
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
    closed_at: datetime | None = None
    recent_ratios: deque[float | None] = field(default_factory=lambda: deque(maxlen=30))


class Detector:
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
        self.exclude = exclude if exclude is not None else {}
        self.watched: dict[SeriesKey, Rule] = {}
        self.state: dict[SeriesKey, DetectorState] = {}
        self._pseudo: dict[tuple[SeriesKey, datetime], float] = {}
        self.sustained_now: list[ChangeEvent] = []
        self.refresh()

    def refresh(self) -> int:
        """Start watching newly available series; preserve existing episode state."""
        added = 0
        for key in sorted(self.series.keys() - self.watched.keys() - self.exclude.keys()):
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
                self.state[key] = DetectorState(recent=deque(maxlen=rule.persist[1]))
                added += 1
                break
        return added

    def step(self, t: datetime) -> list[tuple[str, ChangeEvent]]:
        """Evaluate the next minute. Actions are open, escalate, close, and expire.

        Close means observed recovery; expire means chronic rollover to a new baseline.
        Events are updated in place and shared with downstream grouping.
        """
        self.sustained_now = []
        hour = t.replace(minute=0)
        if not t.minute:
            self._pseudo = {key: value for key, value in self._pseudo.items() if key[1] == hour}
        actions = []
        for key, rule in self.watched.items():
            if action := self._step_series(key, rule, t):
                actions.append(action)
        return actions

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

    def _expected(self, key: SeriesKey, st: DetectorState, t: datetime) -> ExpectedValue | None:
        if st.anchor_level is not None:
            return self.baseline.anchored(
                key, t, st.anchor_level, st.anchor_sigma, st.anchor_points
            )
        weights = weight_key(key)
        return self.baseline.expected(
            key,
            self.series.get(key, {}),
            t,
            st.excluded,
            weights=self.series.get(weights) if weights else None,
            pending={ts for ts, flagged, _ in st.recent if flagged} if weights else None,
        )

    def _step_series(
        self, key: SeriesKey, rule: Rule, t: datetime
    ) -> tuple[str, ChangeEvent] | None:
        cfg, st = self.cfg, self.state[key]
        actual = self._get(key, t)
        parts = rate_parts(key)
        is_latency = rule.change == ChangeType.SLOWDOWN
        sampled_share = is_share(key)
        sample_key = samples_key(key)
        samples = self._get(sample_key, t)
        counted = bool(cfg.windows) and (
            parts is not None or sampled_share or (key.signal, key.metric) == ("errors", "count()")
        )
        if counted and st.counts is None:
            st.counts = deque(
                [CountTotals(None, 0, 0, 0, 0, 0, 0, None)],
                maxlen=max(cfg.windows) + DISPERSION_MIN + 1,
            )
        # Exclusions only affect recent baseline windows; the open episode's reference is frozen.
        horizon = self.baseline.cfg.window_min + self.baseline.cfg.reach_back_min
        st.excluded.discard(t - (horizon + 1) * MINUTE)

        num, den, sampled_den = (self._get(k, t) for k in parts) if parts else (None, None, None)
        rate_missing = parts is not None and (num is None or not den or not sampled_den)
        share_missing = sampled_share and not samples
        drop_missing = rule.direction == "down" and sample_key in self.series and samples is None
        if actual is None or rate_missing or share_missing or drop_missing:
            if counted:
                assert st.counts is not None
                # Explicit zero sample trials contribute nothing; unknown coverage invalidates the window.
                zero_trials = (sampled_share and samples == 0) or (
                    key.signal == "failed_rate" and sampled_den == num == 0
                )
                _push(st.counts, t, missing=not zero_trials)
            self._unavailable(st, t, is_latency)
            return None
        ev = self._expected(key, st, t)
        if ev is None:
            if counted:
                assert st.counts is not None
                _push(st.counts, t, missing=True)
            self._unavailable(st, t, is_latency)
            return None

        prior = self.pseudo(key, t)
        ratio = (actual + prior) / (ev.expected + prior)
        up = rule.direction == "up"
        passes_ratio = ratio >= cfg.min_ratio if up else ratio <= 1 / cfg.min_ratio
        z = zscore(ev, actual) if passes_ratio else 0.0
        k = self.baseline.cfg.k
        beyond = z > k if up else z < -k
        if up:
            valid, enough = self._up_evidence(
                key, rule, actual, ev.expected, samples, num, den, sampled_den
            )
        elif samples is None:
            valid, enough = True, ev.expected >= cfg.min_samples
        else:
            valid = samples >= cfg.min_samples
            # A genuine drop reduces its own sample count. Judge it against its pre-drop volume,
            # and retain that evidence once the drop is open.
            enough = beyond and (
                st.open is not None or self._window_median(sample_key, t) >= cfg.min_samples
            )
        flagged = beyond and enough
        if is_latency:
            st.recent_ratios.append(ratio if (samples or 0) >= cfg.latency_min_samples else None)

        window = 0
        if counted:
            assert st.counts is not None
            if parts:
                assert num is not None and den and sampled_den
                observed, denominator = num, den
                extra_noise = sampled_den if parts[1] != parts[2] else 0.0
                volume = sampled_den / cfg.min_samples
            elif sampled_share:
                assert samples
                observed, denominator, extra_noise = float(round(actual * samples)), samples, 0.0
                volume = samples / cfg.min_samples
            else:
                observed, denominator, extra_noise = actual, 1.0, 0.0
                volume = ev.expected / cfg.min_abs_excess
            shape = self.baseline.shape(key, t)
            _push(
                st.counts,
                t,
                observed,
                ev.expected * denominator,
                extra_noise,
                volume,
                denominator * shape,
                ev.expected / shape,
            )
            if not flagged and (st.open is None or st.window):
                bounded = key.signal == "failed_rate" or sampled_share
                hit = self._window_test(st, st.counts, ev, cfg.window_p, bounded)
                if hit:
                    window, ratio, z = hit
                    flagged = beyond = True
                elif st.window and self._window_test(
                    st, st.counts, ev, cfg.hold_p, bounded, only=st.window
                ):
                    beyond = True
                if st.window and not flagged:
                    valid = self._can_measure_window(st, st.counts, st.window) and (
                        (not bounded and parts is None)
                        or st.counts[-1].volume - st.counts[-1 - st.window].volume >= 1
                    )

        st.recent.append((t, flagged, actual))
        if st.open is None:
            if flagged and sum(flag for _, flag, _ in st.recent) >= rule.persist[0]:
                return self._open_episode(key, rule, st, t, actual, ev, ratio, z, window)
            return None
        return self._update_episode(st, rule, t, actual, ev, ratio, z, beyond, flagged, valid)

    @staticmethod
    def _unavailable(st: DetectorState, t: datetime, is_latency: bool) -> None:
        st.recent.append((t, False, None))
        st.worse_run.clear()
        if is_latency:
            st.recent_ratios.append(None)

    def _up_evidence(
        self,
        key: SeriesKey,
        rule: Rule,
        actual: float,
        expected: float,
        samples: float | None,
        num: float | None,
        den: float | None,
        sampled_den: float | None,
    ) -> tuple[bool, bool]:
        """Return whether normal and anomalous readings are sufficiently supported, respectively."""
        cfg = self.cfg
        if num is not None and den and sampled_den:
            valid = sampled_den >= cfg.min_samples
            return valid, valid and num - expected * den >= cfg.min_abs_excess
        if is_share(key):
            n = samples or 0.0
            valid = n >= cfg.min_samples
            return valid, valid and (actual - expected) * n >= cfg.min_abs_excess
        if rule.change == ChangeType.SLOWDOWN:
            valid = (samples or 0.0) >= cfg.min_samples
            return valid, valid and actual - expected >= cfg.min_latency_excess_ms
        return True, actual - expected >= cfg.min_abs_excess

    def _open_episode(
        self,
        key: SeriesKey,
        rule: Rule,
        st: DetectorState,
        t: datetime,
        actual: float,
        ev: ExpectedValue,
        ratio: float,
        z: float,
        window: int,
    ) -> tuple[str, ChangeEvent]:
        flagged = [(ts, value) for ts, flag, value in st.recent if flag]
        anchor = start = flagged[0][0]
        change = rule.change
        if change == ChangeType.DROP and all(value == 0 for _, value in flagged):
            change = ChangeType.SILENCE
        if window:
            assert st.counts is not None
            start = min(start, _excess_start(st.counts, window, self.cfg.min_ratio))
        event = ChangeEvent(
            key,
            change,
            start,
            actual,
            ev.expected,
            _confidence(z, self.baseline.cfg.k),
            detected_at=t,
            peak_ratio=ratio,
            open_ratio=ratio,
        )
        if window:
            label = f"{window // 60}h" if window >= 60 and window % 60 == 0 else f"{window}m"
            event.evidence.append(f"{label} of counts: too many to be chance at this volume")
        anchor_ev = self.baseline.expected(
            key,
            self.series[key],
            anchor,
            st.excluded,
            weights=self.series.get(weights) if (weights := weight_key(key)) else None,
        )
        if anchor_ev is None:
            anchor, anchor_ev = t, ev
        st.anchor = anchor
        st.anchor_level = anchor_ev.expected / self.baseline.shape(key, anchor)
        st.anchor_sigma = anchor_ev.sigma
        st.anchor_points = anchor_ev.point_count
        st.excluded.update(ts for ts, _ in flagged)
        st.open = event
        st.window = window
        st.score = float(self.cfg.close_after)
        st.level_ratio = ratio
        st.worse_run.clear()
        return "open", event

    def _update_episode(
        self,
        st: DetectorState,
        rule: Rule,
        t: datetime,
        actual: float,
        ev: ExpectedValue,
        ratio: float,
        z: float,
        beyond: bool,
        flagged: bool,
        valid: bool,
    ) -> tuple[str, ChangeEvent] | None:
        cfg = self.cfg
        event = st.open
        assert event is not None
        if flagged:
            st.score = min(cfg.evidence_cap, st.score + 1)
        elif valid and not beyond:
            st.score = max(0.0, st.score - 1)
        if rule.change == ChangeType.SLOWDOWN:
            duration = (t - event.start) // MINUTE
            recent = [r for r in list(st.recent_ratios)[-duration - 1 :] if r is not None]
            event.recent_ratio = median(recent) if len(recent) >= 15 else None
            if cfg.sustained and event.sustained_at is None and event.recent_ratio is not None:
                min_ratio, minutes = cfg.sustained
                if event.recent_ratio >= min_ratio and duration >= minutes:
                    event.sustained_at = t
                    self.sustained_now.append(event)
        st.excluded.add(t)
        direction = 1 if rule.direction == "up" else -1
        if flagged or valid:
            if (ratio - event.peak_ratio) * direction > 0:
                event.peak_ratio, event.actual, event.expected = ratio, actual, ev.expected
                if z:
                    event.confidence = max(event.confidence, _confidence(z, self.baseline.cfg.k))
        if flagged and direction * math.log(ratio / st.level_ratio) >= math.log(
            cfg.escalate_factor
        ):
            st.worse_run.append(ratio)
        else:
            st.worse_run.clear()
        if len(st.worse_run) >= cfg.escalate_n:
            st.level_ratio = median(st.worse_run)
            event.escalations.append((t - (cfg.escalate_n - 1) * MINUTE, st.level_ratio))
            st.worse_run.clear()
            return "escalate", event
        if st.score == 0:
            return self._close_episode(st, event, t, chronic=False)
        if flagged and t - event.start >= timedelta(hours=cfg.chronic_hours):
            return self._close_episode(st, event, t, chronic=True)
        return None

    def _close_episode(
        self, st: DetectorState, event: ChangeEvent, t: datetime, chronic: bool
    ) -> tuple[str, ChangeEvent]:
        event.ended_at = t
        if chronic:
            event.evidence.append(
                f"chronic: not recovered after {self.cfg.chronic_hours:g}h, taken as the new level"
            )
            st.excluded = {ts for ts in st.excluded if ts < event.start}
        else:
            event.evidence.append("recovered")
        st.open = st.anchor = st.anchor_level = None
        st.anchor_sigma = 0.0
        st.anchor_points = 0
        st.score = 0.0
        st.window = 0
        st.closed_at = t
        st.recent.clear()
        st.recent_ratios.clear()
        return ("expire" if chronic else "close"), event

    @staticmethod
    def _can_measure_window(st: DetectorState, counts: deque[CountTotals], window: int) -> bool:
        if len(counts) <= window:
            return False
        first = counts[-1 - window]
        if st.closed_at is not None and (first.ts is None or first.ts < st.closed_at):
            return False
        return counts[-1].missing == first.missing

    def _window_test(
        self,
        st: DetectorState,
        counts: deque[CountTotals],
        ev: ExpectedValue,
        p_max: float,
        bounded: bool,
        only: int = 0,
    ) -> tuple[int, float, float] | None:
        """Return the shortest window with enough evidence to reject its baseline."""
        cfg = self.cfg
        last = counts[-1]
        need = cfg.min_abs_excess if p_max <= cfg.window_p else 1.0
        for w in (only,) if only else self._windows_for(counts):
            if not self._can_measure_window(st, counts, w):
                continue
            first = counts[-1 - w]
            n = last.events - first.events
            if bounded:
                hit = self._share_test(counts, w, n, need, p_max)
                if hit:
                    return w, *hit
                continue
            # Freeze the level at the start of the window; minute fits inside a sparse change
            # could absorb failures before enough evidence accumulates to open the episode.
            level = first.level if first.level is not None else counts[-w].level
            if level is None:
                continue
            e = level * (last.shaped_denominator - first.shaped_denominator)
            if n - e < need or (n + 1) / (e + 1) < cfg.min_ratio:
                continue
            seen = ev.point_count
            e += 0.5 * w / seen
            per_min = e / w
            sigma = ev.sigma if per_min >= 5 else cfg.model_floor
            model = max(cfg.model_floor**2, sigma**2 - 1 / max(per_min, 1.0))
            samples = last.samples - first.samples
            # Combine estimation uncertainty, model noise, event clumping, and sampling noise.
            relative_variance = 1 / (per_min * seen) + model + (_dispersion(counts, w) - 1) / e
            if samples > 0:
                relative_variance += 1 / samples
            p = _nb_sf(n, e, 1 / relative_variance)
            if p < p_max:
                return w, (n + 1) / (e + 1), _score(p)
        return None

    def _windows_for(self, counts: deque[CountTotals]) -> tuple[int, ...]:
        """Try windows only when a minute lacks the volume to judge on its own."""
        horizon = min(60, len(counts) - 1)
        if horizon < 10:
            return ()
        per_min = (counts[-1].volume - counts[-1 - horizon].volume) / horizon
        if per_min >= 1:
            return ()
        windows = self.cfg.windows
        first = next((i for i, w in enumerate(windows) if w * per_min >= 1), len(windows) - 1)
        return windows[first : first + 2]

    def _share_test(
        self, counts: deque[CountTotals], w: int, n: float, need: float, p_max: float
    ) -> tuple[float, float] | None:
        """Compare sampled failures over sampled trials using a beta-binomial predictive tail."""
        cfg = self.cfg
        end = len(counts) - 1 - w
        start = max(0, end - DISPERSION_MIN)
        before, first, last = counts[start], counts[end], counts[-1]
        if end - start - (first.missing - before.missing) < 10:
            return None
        hist_events = first.events - before.events
        hist_trials = (first.volume - before.volume) * cfg.min_samples
        trials = (last.volume - first.volume) * cfg.min_samples
        if trials < 1 or hist_trials < 1:
            return None
        expected = trials * (hist_events + 0.5) / (hist_trials + 1)
        ratio = (n + 1) / (expected + 1)
        if n - expected < need or ratio < cfg.min_ratio:
            return None
        phi = _dispersion(counts, w)
        p = _betabinom_sf(
            n / phi,
            trials / phi,
            hist_events / phi + 0.5,
            max(0.0, hist_trials - hist_events) / phi + 0.5,
        )
        if p < p_max:
            return ratio, _score(p)
        return None


def _push(
    counts: deque[CountTotals],
    t: datetime,
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
            t,
            prev.events + events,
            prev.expected + expected,
            prev.samples + samples,
            prev.missing + missing,
            prev.volume + volume,
            prev.shaped_denominator + shaped_denominator,
            level,
        )
    )


def _excess_start(counts: deque[CountTotals], window: int, min_ratio: float) -> datetime:
    """Find the suffix of the window with the most excess events."""
    start = counts[-1].ts
    best = excess = 0.0
    for i in range(-1, -1 - window, -1):
        after, before = counts[i], counts[i - 1]
        excess += after.events - before.events - min_ratio * (after.expected - before.expected)
        if excess > best:
            best, start = excess, after.ts
    assert start is not None
    return start


def _dispersion(counts: deque[CountTotals], w: int) -> float:
    """Pearson dispersion in the minutes before the candidate window, floored at Poisson."""
    end = len(counts) - 1 - w
    start = max(0, end - DISPERSION_MIN)
    if end - start < 10:
        return 1.0
    num = den = 0.0
    for i in range(start + 1, end + 1):
        point, prev = counts[i], counts[i - 1]
        if point.missing != prev.missing:
            continue
        n, e = point.events - prev.events, point.expected - prev.expected
        num += (n - e) ** 2
        den += e
    return max(1.0, num / den) if den > 0 else 1.0


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
