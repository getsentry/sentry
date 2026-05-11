from unittest import TestCase
from unittest.mock import MagicMock, patch

from sentry.options import all as all_options
from sentry.testutils.helpers import override_options
from sentry.utils.rollout import SafeRolloutComparator


class TestRolloutComparator(SafeRolloutComparator):
    ROLLOUT_NAME = "test_rollout"


class SafeRolloutComparatorTestCase(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.comp = TestRolloutComparator()

    def test_options_registered(self) -> None:
        option_names = [o.name for o in all_options()]

        assert TestRolloutComparator._should_eval_option_name() in option_names
        assert TestRolloutComparator._callsite_allowlist_option_name() in option_names
        assert TestRolloutComparator._callsite_blocklist_option_name() in option_names
        assert TestRolloutComparator._sample_rate_option_name() in option_names
        assert TestRolloutComparator._mismatch_log_callsite_allowlist_option_name() in option_names

    def test_return_as_expected(self) -> None:
        with override_options({TestRolloutComparator._should_eval_option_name(): False}):
            assert TestRolloutComparator.should_check_experiment("test_1") is False

        with override_options(
            {
                TestRolloutComparator._should_eval_option_name(): True,
                TestRolloutComparator._callsite_blocklist_option_name(): ["test_blocked"],
                TestRolloutComparator._sample_rate_option_name(): 1.0,
            }
        ):
            assert TestRolloutComparator.should_check_experiment("test_2") is True
            assert TestRolloutComparator.should_check_experiment("test_blocked") is False

        with override_options(
            {
                TestRolloutComparator._callsite_allowlist_option_name(): ["test_allowed"],
                TestRolloutComparator._mismatch_log_callsite_allowlist_option_name(): [],
            }
        ):
            assert TestRolloutComparator.check_and_choose("ctl", "exp", "test_3") == "ctl"
            assert TestRolloutComparator.check_and_choose("ctl", "exp", "test_allowed") == "exp"

    def test_eval_experimental_sample_rate(self) -> None:
        with override_options(
            {
                TestRolloutComparator._should_eval_option_name(): True,
                TestRolloutComparator._callsite_blocklist_option_name(): [],
                TestRolloutComparator._sample_rate_option_name(): 0.5,
            }
        ):
            with patch("sentry.utils.rollout.random.random", return_value=0.3):
                assert TestRolloutComparator.should_check_experiment("test_sampled_in") is True

            with patch("sentry.utils.rollout.random.random", return_value=0.7):
                assert TestRolloutComparator.should_check_experiment("test_sampled_out") is False

            with patch("sentry.utils.rollout.random.random", return_value=0.5):
                assert TestRolloutComparator.should_check_experiment("test_boundary") is False

            with patch("sentry.utils.rollout.random.random", return_value=0.49999):
                assert TestRolloutComparator.should_check_experiment("test_just_under") is True

    def test_eval_experimental_respects_blocklist(self) -> None:
        with override_options(
            {
                TestRolloutComparator._should_eval_option_name(): True,
                TestRolloutComparator._callsite_blocklist_option_name(): ["test_blocked"],
                TestRolloutComparator._sample_rate_option_name(): 1.0,
            }
        ):
            # Even with 100% sample rate, blocklisted callsites should be blocked
            assert TestRolloutComparator.should_check_experiment("test_blocked") is False
            # Non-blocklisted callsites should still work
            assert TestRolloutComparator.should_check_experiment("test_not_blocked") is True

    def test_eval_experimental_sample_rate_respects_eval_disabled(self) -> None:
        with override_options(
            {
                TestRolloutComparator._should_eval_option_name(): False,
                TestRolloutComparator._callsite_blocklist_option_name(): [],
                TestRolloutComparator._sample_rate_option_name(): 1.0,
            }
        ):
            assert TestRolloutComparator.should_check_experiment("test_disabled") is False

    def test_should_log_mismatch_allowlist(self) -> None:
        with override_options(
            {TestRolloutComparator._mismatch_log_callsite_allowlist_option_name(): []}
        ):
            assert TestRolloutComparator.should_log_mismatch("callsite") is False

        with override_options(
            {TestRolloutComparator._mismatch_log_callsite_allowlist_option_name(): ["callsite"]}
        ):
            assert TestRolloutComparator.should_log_mismatch("callsite") is True
            assert TestRolloutComparator.should_log_mismatch("other") is False

        with override_options(
            {TestRolloutComparator._mismatch_log_callsite_allowlist_option_name(): ["*"]}
        ):
            assert TestRolloutComparator.should_log_mismatch("callsite") is True
            assert TestRolloutComparator.should_log_mismatch("other") is True

    @patch("sentry.utils.rollout.SafeRolloutComparator.check_and_choose")
    def test_check_and_choose_with_timings_forwards_debug_args(
        self, check_and_choose: MagicMock
    ) -> None:
        check_and_choose.return_value = "control"
        serializer = lambda value: {"value": str(value)}

        with override_options(
            {
                TestRolloutComparator._should_eval_option_name(): True,
                TestRolloutComparator._callsite_blocklist_option_name(): [],
                TestRolloutComparator._sample_rate_option_name(): 1.0,
            }
        ):
            TestRolloutComparator.check_and_choose_with_timings(
                control_thunk=lambda: "control",
                experimental_thunk=lambda: "experimental",
                callsite="test_callsite",
                debug_context={"x": "y"},
                data_serializer=serializer,
            )

        assert check_and_choose.called
        assert check_and_choose.call_args.kwargs["debug_context"] == {"x": "y"}
        assert check_and_choose.call_args.kwargs["data_serializer"] is serializer
