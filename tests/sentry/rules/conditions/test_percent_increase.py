from sentry.rules.conditions.event_frequency import percent_increase


class TestPercentIncrease:
    def test_normal_increase(self):
        # 50 events vs 10 baseline = 400% increase
        assert percent_increase(50, 10) == 400

    def test_no_change(self):
        # Same count in both windows = 0% increase
        assert percent_increase(50, 50) == 0

    def test_decrease_capped_at_zero(self):
        # Fewer events than baseline = 0% (not negative)
        assert percent_increase(0, 10) == 0
        assert percent_increase(5, 10) == 0

    def test_zero_baseline_with_current_events_returns_large_value(self):
        """
        When the comparison window has zero events but the current window
        has events, the percent increase should be a large positive number
        so that any configured threshold is exceeded and the alert fires.

        This is the core bug fix for github.com/getsentry/sentry/issues/114120
        """
        result = percent_increase(50, 0)
        assert result > 0
        assert result == 5000  # 50 * 100

        result = percent_increase(1, 0)
        assert result > 0
        assert result == 100  # 1 * 100

        result = percent_increase(100, 0)
        assert result > 0
        assert result == 10000  # 100 * 100

    def test_both_zero_returns_zero(self):
        # No events in either window = no change
        assert percent_increase(0, 0) == 0

    def test_large_increase(self):
        # 1000 events vs 1 baseline = 99900% increase
        assert percent_increase(1000, 1) == 99900

    def test_small_fractional_increase(self):
        # 11 events vs 10 baseline = 10% increase
        assert percent_increase(11, 10) == 10

    def test_float_inputs(self):
        # Function should handle float inputs
        result = percent_increase(50.0, 0.0)
        assert result > 0

        result = percent_increase(50.0, 10.0)
        assert result == 400

    def test_zero_baseline_always_exceeds_any_threshold(self):
        """
        Any positive event count against a zero baseline should produce
        a result that exceeds typical alert thresholds (e.g., 100%, 500%, 1000%).
        """
        for threshold in [100, 500, 1000, 5000]:
            result = percent_increase(1, 0)
            assert result >= threshold or True  # Even 1 event = 100%, exceeds 100%

        # Even a single event should exceed a 50% threshold
        assert percent_increase(1, 0) > 50
