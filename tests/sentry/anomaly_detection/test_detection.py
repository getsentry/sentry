from datetime import datetime, timedelta

import pytest

from sentry.anomaly_detection.contracts import (
    ChangeAction,
    ChangeEvent,
    ChangeType,
    Metric,
    SeriesKey,
    SeriesRow,
    Signal,
)
from sentry.anomaly_detection.evaluation.baseline import Baseline
from sentry.anomaly_detection.evaluation.organization import OrgEvaluator
from sentry.anomaly_detection.evaluation.rate_shifts import ChangePointConfig, RateShiftTracker
from sentry.anomaly_detection.evaluation.series import Series, build, samples_key
from sentry.anomaly_detection.evaluation.series_history import DetectConfig, SeriesHistory

START = datetime(2024, 1, 8, 12)
REQUESTS = SeriesKey(1, "prod", Signal.REQUESTS, Metric.COUNT)
ERRORS = SeriesKey(1, "prod", Signal.ERRORS, Metric.COUNT)
LATENCY = SeriesKey(1, "prod", Signal.OUTBOUND_DB, Metric.P95_DURATION, "catalog-db")
FAILURES = SeriesKey(1, "prod", Signal.ENDPOINTS, Metric.FAILURE_RATE, "/api/task")
ERROR_RATE = SeriesKey(1, "prod", Signal.ERROR_RATE, Metric.ERRORS_PER_REQUEST)


def minute(i: int) -> datetime:
    return START + timedelta(minutes=i)


def points(start: int, end: int, value: float | None) -> Series:
    return dict.fromkeys((minute(i) for i in range(start, end)), value)


class NoFootprints:
    def footprint(self, event: ChangeEvent, observation_end: datetime, /) -> None:
        return None


class MeasurementStream:
    def __init__(
        self, series: dict[SeriesKey, Series], baseline: Baseline, cfg: DetectConfig | None = None
    ) -> None:
        self.series = series
        prior = {
            key: retained
            for key, values in series.items()
            if (retained := {ts: value for ts, value in values.items() if ts < START})
        }
        self.evaluator = OrgEvaluator(NoFootprints(), projects=(1,))
        self.evaluator.series.update(prior)
        self.evaluator.series_history = SeriesHistory(self.evaluator.series, baseline, cfg)
        self.evaluator.rate_shifts = RateShiftTracker(self.evaluator.series, baseline)
        self.history = self.evaluator.series_history
        self.change_points = self.evaluator.rate_shifts

    def step(self, ts: datetime) -> list[ChangeAction]:
        rows = [
            SeriesRow(
                ts, key.signal, key.metric, key.project_id, key.env, key.dim_value, values[ts]
            )
            for key, values in self.series.items()
            if ts in values
        ]
        return self.evaluator._evaluate_project(1, ts, rows)


def step(det: MeasurementStream, start: int, end: int) -> list[ChangeAction]:
    return [action for i in range(start, end) for action in det.step(minute(i))]


@pytest.mark.parametrize(("value", "change"), [(100.0, ChangeType.DROP), (0.0, ChangeType.SILENCE)])
def test_request_drop_requires_eight_minutes(value: float, change: ChangeType) -> None:
    series = {
        REQUESTS: points(0, 60, 1000.0) | points(60, 75, value),
        samples_key(REQUESTS): points(0, 60, 100.0) | points(60, 75, value / 10),
    }
    det = MeasurementStream(series, Baseline({}))
    assert step(det, 0, 67) == []
    [(action, event)] = det.step(minute(67))
    assert (action, event.change_type) == ("open", change)
    assert (event.start, event.detected_at) == (minute(60), minute(67))


def test_missing_requests_do_not_open_a_silence() -> None:
    det = MeasurementStream({REQUESTS: points(0, 60, 1000.0)}, Baseline({}))
    assert step(det, 0, 120) == []


def test_errors_only_spike_uses_first_flagged_minute() -> None:
    # Seed the full baseline so warmup does not temporarily make this a sparse series.
    series = {ERRORS: points(-60, 64, 5.0) | {minute(i): 90.0 for i in (60, 61, 63)}}
    det = MeasurementStream(series, Baseline({}))
    [(action, event)] = step(det, 0, 64)
    assert (action, event.change_type) == ("open", ChangeType.SPIKE)
    assert (event.start, event.detected_at) == (minute(60), minute(63))
    assert event.expected == 5.0


def test_slowdown_requires_sampled_spans_not_extrapolated_volume() -> None:
    extrapolated = SeriesKey(1, "prod", Signal.OUTBOUND_DB, Metric.COUNT, "catalog-db")
    series = {
        LATENCY: points(0, 60, 20.0) | points(60, 120, 300.0),
        samples_key(LATENCY): points(0, 120, 1.0),
        extrapolated: points(0, 120, 100_000.0),
    }
    assert step(MeasurementStream(series, Baseline({})), 0, 120) == []


def test_frozen_baseline_survives_missing_support_and_closes_on_recovery_only() -> None:
    series = {
        LATENCY: points(0, 60, 20.0) | points(60, 65, 100.0) | points(95, 125, 20.0),
        samples_key(LATENCY): points(0, 65, 100.0) | points(95, 115, 1.0) | points(115, 125, 100.0),
    }
    det = MeasurementStream(series, Baseline({}))
    [(action, event)] = step(det, 0, 63)
    assert (action, event.change_type) == ("open", ChangeType.SLOWDOWN)
    assert (event.start, event.detected_at) == (minute(60), minute(62))
    for ts in points(0, 60, 20.0):
        del det.history.series[LATENCY][ts]
    assert step(det, 63, 125) == []
    series[LATENCY].update(points(125, 127, 20.0))
    series[samples_key(LATENCY)].update(points(125, 127, 100.0))
    assert step(det, 125, 127) == [("close", event)]
    assert event.ended_at == minute(126)
    assert event.evidence == ["recovered"]


def test_excluded_latency_can_recover_but_cannot_reopen_between_quality_checks() -> None:
    detector = MeasurementStream(
        {
            LATENCY: points(0, 60, 30.0)
            | points(60, 111, 0.0)
            | points(117, 120, 300.0)
            | points(120, 130, 0.0)
            | points(130, 136, 300.0),
            samples_key(LATENCY): points(0, 136, 100.0),
        },
        Baseline({}),
    )
    [(action, event)] = step(detector, 0, 120)
    assert action == "open"
    assert event.start == minute(117)

    # The hourly quality check sees mostly zeros but keeps the active episode.
    assert step(detector, 120, 130) == [("close", event)]
    assert event.ended_at == minute(129)
    assert LATENCY in detector.history.exclude

    assert step(detector, 130, 136) == []


def test_bursts_pause_escalate_and_recover_as_one_episode() -> None:
    series = {
        LATENCY: points(0, 60, 20.0)
        | points(60, 65, 100.0)
        | points(65, 70, 20.0)
        | points(70, 75, 400.0)
        | points(75, 100, 20.0),
        samples_key(LATENCY): points(0, 100, 100.0),
    }
    det = MeasurementStream(series, Baseline({}))
    opened, escalated, closed = step(det, 0, 100)
    event = opened[1]
    assert (opened, escalated, closed) == (("open", event), ("escalate", event), ("close", event))
    assert event.start == minute(60)
    assert event.expected == 20.0
    assert event.actual == 400.0
    assert event.escalations[0][0] == minute(70)
    assert event.ended_at == minute(86)


def test_post_recovery_recurrence_still_uses_pre_episode_level() -> None:
    series = {
        LATENCY: points(0, 60, 20.0)
        | points(60, 120, 300.0)
        | points(120, 142, 20.0)
        | points(142, 155, 300.0),
        samples_key(LATENCY): points(0, 155, 100.0),
    }
    opened, closed, reopened = step(MeasurementStream(series, Baseline({})), 0, 155)
    assert (opened[0], closed[0], reopened[0]) == ("open", "close", "open")
    assert closed[1] is opened[1]
    assert reopened[1].start == minute(142)
    assert reopened[1].expected == 20.0


def test_chronic_rollover_is_not_recovery() -> None:
    series = {
        LATENCY: points(0, 60, 20.0) | points(60, 130, 300.0),
        samples_key(LATENCY): points(0, 130, 100.0),
    }
    det = MeasurementStream(series, Baseline({}), DetectConfig(chronic_hours=1))
    [(opened, event), (expired, rollover)] = step(det, 0, 130)
    assert (opened, expired) == ("open", "expire")
    assert rollover is event
    assert rollover.ended_at == minute(120)


def test_sparse_failures_accumulate_evidence_and_recover() -> None:
    series = {
        FAILURES: points(0, 150, 0.0) | points(150, 190, 1.0) | points(190, 340, 0.0),
        samples_key(FAILURES): points(0, 340, 1.0),
    }
    opened, closed = step(MeasurementStream(series, Baseline({})), 0, 340)
    assert (opened[0], closed[0]) == ("open", "close")
    event = opened[1]
    assert event is closed[1]
    assert event.start == minute(150)
    assert event.detected_at is not None and event.detected_at <= minute(170)
    assert event.evidence[0].startswith("1h of counts")
    assert event.ended_at is not None and event.ended_at >= minute(190)


def test_minute_opened_failure_spike_can_recover_on_pooled_samples() -> None:
    detector = MeasurementStream(
        {
            FAILURES: points(0, 60, 0.0) | points(60, 63, 1.0) | points(63, 180, 0.0),
            samples_key(FAILURES): points(0, 63, 100.0) | points(63, 180, 1.0),
        },
        Baseline({}),
    )
    [(opened, event)] = step(detector, 0, 63)
    assert opened == "open"
    assert detector.history.state[FAILURES].window == 0
    assert step(detector, 63, 75) == []
    assert step(detector, 75, 180) == [("close", event)]


def test_pooled_recovery_does_not_replace_peak_with_unsupported_minute() -> None:
    detector = MeasurementStream(
        {
            FAILURES: points(0, 60, 0.0) | points(60, 63, 6 / 50) | points(63, 64, 1.0),
            samples_key(FAILURES): points(0, 63, 50.0) | points(63, 64, 1.0),
        },
        Baseline({}),
    )
    [(action, event)] = step(detector, 0, 63)
    assert action == "open"
    assert event.actual == 6 / 50
    peak = (event.actual, event.expected, event.peak_ratio, event.confidence)

    # The trailing window has enough volume to hold the spike, but this minute
    # has only one trial and is not eligible to replace the peak measurement.
    assert step(detector, 63, 64) == []
    assert detector.history.state[FAILURES].open is event
    assert (event.actual, event.expected, event.peak_ratio, event.confidence) == peak


def test_sparse_failure_spike_does_not_learn_degraded_rate_as_recovery() -> None:
    detector = MeasurementStream(
        {
            FAILURES: points(0, 150, 0.0) | {minute(i): float(i % 4 != 0) for i in range(150, 400)},
            samples_key(FAILURES): points(0, 400, 1.0),
        },
        Baseline({}),
    )
    actions = step(detector, 0, 400)
    assert actions[0][0] == "open"
    assert all(action != "close" for action, _ in actions)
    assert detector.history.state[FAILURES].open is actions[0][1]


def test_window_spike_reports_pooled_rate_on_a_healthy_minute() -> None:
    detector = MeasurementStream(
        {
            FAILURES: points(0, 240, 0.0) | points(152, 159, 1.0) | points(160, 161, 1.0),
            samples_key(FAILURES): points(0, 240, 1.0),
        },
        Baseline({}),
        DetectConfig(windows=(60,), window_p=0.02),
    )
    actions = step(detector, 0, 160)
    [(action, event)] = actions
    assert action == "open"
    assert event.detected_at == minute(159)
    assert event.actual == pytest.approx(7 / 60)
    assert 0 < event.expected < event.actual

    assert step(detector, 160, 161) == []
    assert event.actual == pytest.approx(8 / 60)


def test_occasional_sparse_failure_is_not_a_spike() -> None:
    series = {
        FAILURES: points(0, 340, 0.0) | {minute(152): 1.0, minute(190): 1.0},
        samples_key(FAILURES): points(0, 340, 1.0),
    }
    assert step(MeasurementStream(series, Baseline({})), 0, 340) == []


def test_routine_failure_bursts_are_not_spikes_but_a_sustained_increase_is() -> None:
    # Three minutes in ten fail at 10%: the median is zero, so the level is pooled at 3%.
    failures = {minute(i): 0.1 if i % 10 < 3 else 0.0 for i in range(240)}
    series = {
        FAILURES: failures | points(240, 250, 1.0),
        samples_key(FAILURES): points(0, 250, 100.0),
    }
    detector = MeasurementStream(series, Baseline({}))
    assert step(detector, 0, 240) == []
    [(action, event)] = step(detector, 240, 250)
    assert action == "open"
    assert event.start == minute(240)
    assert event.expected == pytest.approx(0.03, rel=0.1)


def test_sparse_error_count_window_opens_below_per_minute_excess() -> None:
    # Two errors per minute cannot pass the five-event gate; their sum can.
    series = {ERRORS: points(0, 300, 0.0) | points(300, 330, 2.0)}
    [(action, event)] = step(MeasurementStream(series, Baseline({})), 0, 330)
    assert (action, event.change_type) == ("open", ChangeType.SPIKE)
    assert event.start == minute(300)
    assert event.detected_at is not None and event.detected_at < minute(330)
    assert event.evidence[0].startswith("1h of counts")


def test_history_scales_level_by_hour_and_prefers_same_day_type() -> None:
    hourly: Series = {}
    # Three weekdays and four weekend days, so ignoring day type would pick the weekend value.
    for i in range(1, 15):
        day = START - timedelta(days=i)
        hourly[day - timedelta(hours=1)] = 100.0
        if day.weekday() >= 5:
            hourly[day] = 20_000.0
        elif i <= 5:
            hourly[day] = 200.0
    baseline = Baseline({REQUESTS: hourly})
    ev = baseline.expected(REQUESTS, points(-60, 0, 10.0), START, set())
    assert ev is not None
    assert ev.expected == 20.0
    assert ev.sigma == pytest.approx(0.1)
    assert ev.lower < ev.expected < ev.upper


def test_missing_history_for_target_hour_uses_recent_signal_units() -> None:
    hourly: Series = {START - timedelta(days=i, hours=1): 200.0 for i in range(1, 15)}
    ev = Baseline({REQUESTS: hourly}).expected(REQUESTS, points(-60, 0, 10.0), START, set())
    assert ev is not None
    assert ev.expected == 10.0


def test_weekend_shape_uses_two_weekends_when_available() -> None:
    saturday = START + timedelta(days=5)
    hourly: Series = {}
    for i in range(1, 15):
        day = saturday - timedelta(days=i)
        hourly[day] = 20.0 if day.weekday() >= 5 else 100.0
    assert Baseline({REQUESTS: hourly}).raw_shape(REQUESTS, saturday) == 20.0


def test_warmup_requires_observations_and_widens_band() -> None:
    baseline = Baseline({})
    assert baseline.expected(LATENCY, points(-9, 0, 20.0), START, set()) is None
    few = baseline.expected(LATENCY, points(-10, 0, 20.0), START, set())
    full = baseline.expected(LATENCY, points(-60, 0, 20.0) | {minute(-5): 1000.0}, START, set())
    assert few is not None and full is not None
    assert few.expected == full.expected == 20.0
    assert few.upper > full.upper
    assert full.sigma == pytest.approx(0.1)


def test_mostly_zero_share_uses_sample_weighted_level() -> None:
    values = points(-10, 0, 0.0) | {minute(-1): 0.5, minute(-2): 1.0}
    samples = points(-10, 0, 10.0) | {minute(-1): 20.0, minute(-2): 40.0}
    ev = Baseline({}).expected(
        FAILURES, values, START, set(), weights=samples, pending={minute(-2)}
    )
    assert ev is not None
    assert ev.expected == pytest.approx(0.1)  # 10 failures in 100 spans; pending minute omitted.


def test_build_masks_empty_latency_and_distinguishes_zero_from_missing_rate_inputs() -> None:
    rows: list[SeriesRow] = [
        SeriesRow(minute(0), Signal.REQUESTS, Metric.COUNT, 1, "prod", "", 2000),
        SeriesRow(minute(1), Signal.REQUESTS, Metric.COUNT, 1, "prod", "", 2000),
        SeriesRow(minute(0), Signal.REQUESTS, Metric.COUNT_SAMPLE, 1, "prod", "", 20),
        SeriesRow(minute(1), Signal.REQUESTS, Metric.COUNT_SAMPLE, 1, "prod", "", 20),
        SeriesRow(minute(0), Signal.FAILED_REQUESTS, Metric.COUNT_SAMPLE, 1, "prod", "", 5),
        SeriesRow(minute(0), Signal.ERRORS, Metric.COUNT, 1, "prod", "", 0),
        SeriesRow(minute(0), Signal.OUTBOUND_DB, Metric.P95_DURATION, 1, "prod", "catalog-db", 0),
        SeriesRow(minute(0), Signal.OUTBOUND_DB, Metric.COUNT_SAMPLE, 1, "prod", "catalog-db", 0),
    ]
    series = build(rows)
    assert series[LATENCY] == {minute(0): None}
    assert series[SeriesKey(1, "prod", Signal.FAILED_RATE, Metric.FAILED_PER_REQUEST)] == {
        minute(0): 0.25,
        minute(1): None,
    }
    assert series[SeriesKey(1, "prod", Signal.ERROR_RATE, Metric.ERRORS_PER_REQUEST)] == {
        minute(0): 0.0,
        minute(1): None,
    }


def test_refresh_adds_new_series_without_resetting_existing_state() -> None:
    series = {ERRORS: points(0, 60, 5.0)}
    det = SeriesHistory(series, Baseline({}), exclude={LATENCY: "unsupported"})
    error_state = det.state[ERRORS]
    series[LATENCY] = points(0, 60, 20.0)
    series[REQUESTS] = points(0, 60, 1000.0)
    assert det.refresh() == 1
    assert det.state[ERRORS] is error_state
    assert set(det.watched) == {ERRORS, REQUESTS}
    assert det.refresh() == 0

    # A raw-errors series watched before traffic arrives must not open once requests exist.
    series = {ERRORS: points(-60, 70, 5.0) | points(65, 70, 100.0)}
    stream = MeasurementStream(series, Baseline({}))
    assert step(stream, 0, 60) == []
    series[REQUESTS] = points(60, 70, 1000.0)
    assert step(stream, 60, 70) == []
    assert ERRORS in stream.history.watched
    assert stream.history.state[ERRORS].open is None


def test_raw_error_episode_can_close_after_requests_arrive() -> None:
    series = {ERRORS: points(-60, 60, 5.0) | points(60, 63, 100.0) | points(63, 100, 5.0)}
    detector = MeasurementStream(series, Baseline({}))
    [(opened, event)] = step(detector, 0, 63)
    assert opened == "open"
    series[REQUESTS] = points(63, 100, 1000.0)
    assert step(detector, 63, 100) == [("close", event)]


def test_change_point_ignores_known_spikes_in_the_pooled_gate() -> None:
    series = {
        REQUESTS: points(0, 230, 10_000.0),
        ERRORS: points(0, 170, 20.0) | points(130, 135, 1000.0) | points(170, 230, 30.0),
        ERROR_RATE: points(0, 230, None),
    }
    detector = RateShiftTracker(series, Baseline({}))
    spike = ChangeEvent(ERROR_RATE, ChangeType.SPIKE, minute(130), 0.1, 0.002, 0.9)
    detector.note_spike(spike, minute(134))
    [(action, event)] = [action for i in range(230) for action in detector.step(minute(i))]
    assert action == "open"
    assert event.expected == pytest.approx(0.002, rel=0.01)
    assert event.actual == 0.003


def test_uncovered_change_point_tick_resets_persistence() -> None:
    series = {
        REQUESTS: points(0, 220, 1000.0),
        ERRORS: points(0, 170, 20.0) | points(170, 220, 40.0),
        ERROR_RATE: points(0, 220, None),
    }
    detector = RateShiftTracker(series, Baseline({}), ChangePointConfig(persist=2))
    assert detector.step(minute(185)) == []
    assert detector.state[ERROR_RATE].hits == 1
    counts = series[ERRORS]
    series[ERRORS] = points(0, 220, None)
    assert detector.step(minute(190)) == []
    series[ERRORS] = counts
    assert detector.step(minute(195)) == []
    assert detector.state[ERROR_RATE].hits == 1


def test_change_point_hold_closes_while_traffic_is_too_low_to_measure() -> None:
    series = {
        REQUESTS: points(0, 200, 1000.0) | points(200, 400, 100.0),
        ERRORS: points(0, 170, 20.0) | points(170, 200, 40.0) | points(200, 400, 4.0),
        ERROR_RATE: points(0, 400, None),
    }
    detector = RateShiftTracker(series, Baseline({}))
    [(opened, event)] = [action for i in range(200) for action in detector.step(minute(i))]
    assert opened == "open"
    hold_until = detector.state[ERROR_RATE].hold_until
    assert hold_until is not None
    # The whole window at hold expiry is below min_requests, so recovery cannot be measured.
    assert [action for i in range(200, 400) for action in detector.step(minute(i))] == [
        ("close", event)
    ]
    assert event.ended_at == hold_until
    assert event.evidence[-1] == "held: new level"


def test_change_point_recovery_uses_the_same_seasonal_scale_as_open() -> None:
    # A high-rate hour falls out of the window while the 50% regression is still present.
    hourly: Series = {
        START + timedelta(hours=hour, days=-day): 0.008 if hour == 0 else 0.002
        for day in range(1, 15)
        for hour in range(-3, 6)
    }
    errors = (
        points(-180, 0, 20.0)
        | points(0, 60, 80.0)
        | points(60, 65, 20.0)
        | points(65, 200, 30.0)
        | points(200, 240, 20.0)
    )
    detector = RateShiftTracker(
        {REQUESTS: points(-180, 240, 10_000.0), ERRORS: errors, ERROR_RATE: dict.fromkeys(errors)},
        Baseline({ERROR_RATE: hourly}),
    )
    [(opened, event)] = [action for i in range(-180, 200) for action in detector.step(minute(i))]
    assert opened == "open"
    assert [action for i in range(200, 240) for action in detector.step(minute(i))] == [
        ("close", event)
    ]
    assert event.evidence[-1] == "recovered"
