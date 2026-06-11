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
        has events, the percent increase should be a very large number
        so that any configured threshold is exceeded and the alert fires.

        This is the core bug fix for github.com/getsentry/sentry/issues/114120
        """
        assert percent_increase(50, 0) == 10_000_000
        assert percent_increase(1, 0) == 10_000_000
        assert percent_increase(100, 0) == 10_000_000

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
        assert percent_increase(50.0, 0.0) == 10_000_000
        assert percent_increase(50.0, 10.0) == 400

    def test_zero_baseline_always_exceeds_any_threshold(self):
        """
        Any positive event count against a zero baseline should produce
        a result that exceeds any configured threshold.
        """
        for threshold in [50, 100, 500, 1000, 5000, 100000]:
            result = percent_increase(1, 0)
            assert result >= threshold, f"Expected {result} >= {threshold}"

        assert percent_increase(1, 0) > 1_000_000
