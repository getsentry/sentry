from datetime import datetime, timedelta
from fractions import Fraction

import pytest

from sentry.anomaly_detection.contracts import ChangeAction, Metric, SeriesKey, Signal
from sentry.anomaly_detection.evaluation.baseline import Baseline
from sentry.anomaly_detection.evaluation.count_windows import _betabinom_sf, _nb_sf
from sentry.anomaly_detection.evaluation.series_history import SeriesHistory

START = datetime(2024, 1, 8, 12)
ERRORS = SeriesKey(1, "prod", Signal.ERRORS, Metric.COUNT)


def minute(i: int) -> datetime:
    return START + timedelta(minutes=i)


def repeat(pattern: list[float], start: int, end: int) -> dict[int, float]:
    return {i: pattern[i % len(pattern)] for i in range(start, end)}


def run_errors(values: dict[int, float], end: int) -> tuple[SeriesHistory, list[ChangeAction]]:
    history = SeriesHistory({ERRORS: {minute(i): v for i, v in values.items()}}, Baseline({}))
    rule = history.watched[ERRORS]
    actions = [
        action for i in range(end) if (action := history.step_series(ERRORS, rule, minute(i)))
    ]
    return history, actions


# Three events every ten minutes: a steady 0.3 per minute whose per-minute median is zero.
SPARSE = [1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0]


def test_steady_sparse_errors_are_judged_against_their_mean_not_a_zero_median() -> None:
    _, actions = run_errors(repeat(SPARSE, -60, 1000), 1000)
    assert actions == []


def test_burst_over_steady_sparse_errors_opens_from_short_count_windows() -> None:
    # Three per minute never clears the five-event minute gate; only the counts can open it.
    # The mean volume, not the zero median, decides that a short window can judge it.
    values = repeat(SPARSE, -60, 1000) | repeat([3.0], 500, 560)
    _, actions = run_errors(values, 560)
    [(action, event)] = actions
    assert action == "open"
    assert event.evidence[0] == "15m of counts: too many to be chance at this volume"
    assert event.start == minute(500)
    assert event.detected_at is not None and event.detected_at < minute(520)


def test_sparse_burst_recovers_against_the_level_that_opened_it() -> None:
    values = repeat(SPARSE, -60, 1000) | repeat([3.0], 500, 530)
    _, actions = run_errors(values, 1000)
    [(opened, event), (closed, closed_event)] = actions
    assert (opened, closed) == ("open", "close")
    assert closed_event is event
    assert event.evidence[-1] == "recovered"
    assert event.ended_at is not None and event.ended_at < minute(600)


def test_open_count_episode_is_held_without_dispersion_from_its_own_excess() -> None:
    # One per minute, then a noisy four per minute whose minutes never clear the minute gate
    # and sometimes look normal on their own, so only the pooled window can hold the episode.
    noisy_four = [5.0, 5.0, 1.0, 5.0, 5.0, 1.0, 5.0, 5.0, 5.0, 3.0]
    values = repeat([1.0], -60, 60) | repeat(noisy_four, 60, 400)
    history, actions = run_errors(values, 400)
    [(action, event)] = actions
    assert action == "open"
    assert event.start <= minute(70)
    assert history.state[ERRORS].window > 0
    assert history.state[ERRORS].open is event


def _nb_sf_exact(k: int, mean: Fraction, size: int) -> float:
    q = mean / (size + mean)
    term, cdf = (1 - q) ** size, Fraction(0)
    for x in range(k):
        cdf += term
        term = term * (x + size) / (x + 1) * q
    return float(1 - cdf)


def _betabinom_sf_exact(k: int, n: int, a: Fraction, b: Fraction) -> float:
    term, cdf = Fraction(1), Fraction(0)
    for i in range(n):
        term = term * (b + i) / (a + b + i)
    for x in range(k):
        cdf += term
        term = term * Fraction(n - x, x + 1) * (x + a) / (n - x - 1 + b)
    return float(1 - cdf)


def test_negative_binomial_tail_is_exact_and_monotone_past_400() -> None:
    mean = Fraction(101, 2)
    tails = [_nb_sf(k, float(mean), 2) for k in range(399, 403)]
    assert tails == sorted(tails, reverse=True)
    for k, tail in zip(range(399, 403), tails):
        assert tail == pytest.approx(_nb_sf_exact(k, mean, 2), rel=1e-9)


@pytest.mark.parametrize(
    ("k", "mean", "size"),
    [(5, Fraction(1), 2), (420, Fraction(361, 2), 40), (3, Fraction(10), 1), (40, Fraction(10), 1)],
)
def test_negative_binomial_tail_matches_exact_sum(k: int, mean: Fraction, size: int) -> None:
    assert _nb_sf(k, float(mean), size) == pytest.approx(_nb_sf_exact(k, mean, size), rel=1e-9)


def test_beta_binomial_tail_is_exact_and_continuous_past_3000_trials() -> None:
    a, b = Fraction(7, 2), Fraction(1995, 2)
    tails = [_betabinom_sf(40, n, float(a), float(b)) for n in (3000, 3001)]
    for n, tail in zip((3000, 3001), tails):
        assert tail == pytest.approx(_betabinom_sf_exact(40, n, a, b), rel=1e-9)
    assert tails[1] == pytest.approx(tails[0], rel=0.01)


@pytest.mark.parametrize(
    ("k", "n", "a", "b"),
    [
        (5, 100, Fraction(5, 2), Fraction(81, 2)),
        (1, 300, Fraction(1, 2), Fraction(1, 2)),
        (250, 300, Fraction(1, 2), Fraction(1, 2)),
        (10, 10, Fraction(1, 2), Fraction(1, 2)),
    ],
)
def test_beta_binomial_tail_matches_exact_sum(k: int, n: int, a: Fraction, b: Fraction) -> None:
    assert _betabinom_sf(k, n, float(a), float(b)) == pytest.approx(
        _betabinom_sf_exact(k, n, a, b), rel=1e-9
    )
