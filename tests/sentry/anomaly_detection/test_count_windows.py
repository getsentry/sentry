from datetime import UTC, datetime, timedelta

from sentry.anomaly_detection.contracts import ChangeAction, Metric, SeriesKey, SeriesRow, Signal
from sentry.anomaly_detection.evaluation.baseline import Baseline
from sentry.anomaly_detection.evaluation.series import build
from sentry.anomaly_detection.evaluation.series_history import SeriesHistory

START = datetime(2024, 1, 8, 12, tzinfo=UTC)
ERRORS = SeriesKey(1, "prod", Signal.ERRORS, Metric.COUNT)
FAILED_RATE = SeriesKey(1, "prod", Signal.FAILED_RATE, Metric.FAILED_PER_REQUEST)
# 10 of every 10,000 requests are sampled, so each sampled failure extrapolates to 1,000. Too
# few samples to judge a minute alone, so the failure rate is judged by count windows.
REQUESTS_PER_MINUTE, SAMPLED_PER_MINUTE = 10_000.0, 10.0


def minute(i: int) -> datetime:
    return START + timedelta(minutes=i)


def repeat(pattern: list[float], start: int, end: int) -> dict[int, float]:
    return {i: pattern[i % len(pattern)] for i in range(start, end)}


def run_errors(values: dict[int, float], end: int) -> tuple[SeriesHistory, list[ChangeAction]]:
    history = SeriesHistory({ERRORS: {minute(i): v for i, v in values.items()}}, Baseline({}))
    rule = history.state.watched[ERRORS]
    actions = [
        action for i in range(end) if (action := history.step_series(ERRORS, rule, minute(i)))
    ]
    return history, actions


def run_failed_rate(
    sampled_failures: dict[int, float], end: int
) -> tuple[SeriesHistory, list[ChangeAction]]:
    rows = [
        row
        for i, failures in sampled_failures.items()
        for row in (
            SeriesRow(minute(i), 1, "prod", Signal.REQUESTS, Metric.COUNT, "", REQUESTS_PER_MINUTE),
            SeriesRow(
                minute(i), 1, "prod", Signal.REQUESTS, Metric.COUNT_SAMPLE, "", SAMPLED_PER_MINUTE
            ),
            SeriesRow(
                minute(i),
                1,
                "prod",
                Signal.FAILED_REQUESTS,
                Metric.COUNT,
                "",
                failures * REQUESTS_PER_MINUTE / SAMPLED_PER_MINUTE,
            ),
        )
    ]
    history = SeriesHistory(build(rows), Baseline({}))
    rule = history.state.watched[FAILED_RATE]
    actions = [
        action for i in range(end) if (action := history.step_series(FAILED_RATE, rule, minute(i)))
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
    history, actions = run_errors(values, 560)
    [(action, event)] = actions
    assert action == "open"
    assert history.state.series_states[ERRORS].window == 15
    assert event.start == minute(500)
    assert event.detected_at is not None and event.detected_at < minute(520)


def test_sparse_burst_recovers_against_the_level_that_opened_it() -> None:
    values = repeat(SPARSE, -60, 1000) | repeat([3.0], 500, 530)
    _, actions = run_errors(values, 1000)
    [(opened, event), (closed, closed_event)] = actions
    assert (opened, closed) == ("open", "close")
    assert closed_event is event
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
    assert history.state.series_states[ERRORS].window > 0
    assert history.state.series_states[ERRORS].open is event


def test_failed_rate_is_judged_on_sampled_trials_not_extrapolated_failures() -> None:
    # A steady 1% of sampled requests fail. Extrapolated, a minute with two sampled failures
    # reads as 500 failures, which outnumber the 40 sampled trials behind them.
    noisy = [0.0, 1.0, 0.0, 0.0, 2.0, 0.0, 0.0, 1.0, 0.0, 0.0]
    _, actions = run_failed_rate(repeat(noisy, -60, 600), 600)
    assert actions == []


def test_failed_rate_opens_when_sampled_failures_rise() -> None:
    values = repeat([0.0, 1.0, 0.0, 0.0, 0.0], -60, 600) | repeat([4.0], 300, 600)
    _, actions = run_failed_rate(values, 600)
    [(action, event)] = actions
    assert action == "open"
    assert event.start >= minute(300)
